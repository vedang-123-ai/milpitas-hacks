/**
 * web/game/modes/race.js — Mode 3: 1v1 Race (HEADLINE demo mode)
 * Owner: P2 (Game Logic)
 *
 * Structure: a race is a FIXED number of questions (set by difficulty, or by the
 * player's voice "best of N"). Each question is one letter (easy) or one word
 * (medium = small words, hard = large words), spelled letter-by-letter. Both
 * players race the SAME question on their own cells and progress INDEPENDENTLY —
 * first to finish the whole word takes the point. After the set number of
 * questions the higher score WINS; a tie triggers sudden-death questions until
 * someone leads, so the result is always a definite Player 1 or Player 2.
 *
 * Held-set model (matches find-target): a press adds a held dot, a release
 * removes it; a letter scores only when the held set EXACTLY equals its dots, so
 * a stray/extra dot blocks the match until released. We DON'T clear held dots
 * between letters — on real pads a shared dot stays pressed across letters.
 */
(function () {
  // Pauses so spoken lines aren't cut off (native/Browser TTS interrupts on the
  // next say()). Tuned for demo pacing.
  const INTRO_MS = 2000;   // intro -> first question
  const POINT_MS = 1500;   // point announced -> next question / winner
  const TIE_MS = 1300;     // "sudden death!" -> the extra question
  const TEARDOWN_MS = 4500; // winner shown this long, then the screen clears

  // `gen` invalidates timers from a previous race when a new one starts or the
  // mode changes — a queued question must never fire into the wrong match.
  let gen = 0;
  const consumed = { 1: false, 2: false }; // armed-once guard per player

  // Run `fn` later only if we're still in the SAME race (same generation + still
  // in race mode). Prevents stale intro/next-question/winner callbacks firing
  // after a restart or a switch to another mode.
  function later(fn, ms) {
    const my = gen;
    window.setTimeout(() => {
      if (my === gen && GameState.mode === "race") fn();
    }, ms);
  }

  function speak(key, vals) {
    Speak.say(GameState.format(key, vals));
  }

  function questionPrompt() {
    const r = GameState.race;
    const isWord = GameState.currentType !== "letter";
    const sudden = r.asked > r.total;
    const key = sudden
      ? (isWord ? "race_sudden_word" : "race_sudden_letter")
      : (isWord ? "race_word" : "race_letter");
    return GameState.format(key, {
      N: r.asked, TOTAL: r.total, WORD: GameState.currentLabel, LETTER: GameState.currentLabel,
    });
  }

  function askQuestion() {
    GameState.loadRaceQuestion(GameState.nextRaceChallenge());
    consumed[1] = consumed[2] = false;
    GameState.currentPrompt = questionPrompt();
    Speak.say(GameState.currentPrompt);
  }

  function declareWinner() {
    const s1 = GameState.players[1].score;
    const s2 = GameState.players[2].score;
    const winner = s1 > s2 ? 1 : s2 > s1 ? 2 : 0;
    GameState.raceFinish(winner);
    if (winner) {
      GameState.markResult(`Player ${winner} wins the race, ${s1} to ${s2}`);
      Audio.win(winner);
      speak("race_win", { WINNER: winner, S1: s1, S2: s2 });
      // clear the win banner + leftover dots after a beat so nothing lingers
      later(() => { GameState.raceTeardown(); Speak.say(GameState.currentPrompt); }, TEARDOWN_MS);
    } else {
      // Sudden death makes a true tie impossible, but never declare a non-winner.
      GameState.markResult(`Tied ${s1} to ${s2}`);
      speak("race_tie", { S1: s1, S2: s2 });
      later(askQuestion, TIE_MS);
    }
  }

  function onQuestionWon(player) {
    GameState.score(player);
    const r = GameState.race;
    const s1 = GameState.players[1].score;
    const s2 = GameState.players[2].score;
    GameState.markResult(`Player ${player} takes question ${r.asked}`);
    Audio.win(player);
    speak("race_point", { PLAYER: player, N: r.asked, S1: s1, S2: s2 });

    const moreScheduled = r.asked < r.total;
    const tied = s1 === s2;

    if (moreScheduled) {
      later(askQuestion, POINT_MS); // still have planned questions to play
    } else if (tied) {
      r.sudden = true;              // out of questions but level -> sudden death
      later(() => { speak("race_tie", { S1: s1, S2: s2 }); later(askQuestion, TIE_MS); }, POINT_MS);
    } else {
      later(declareWinner, POINT_MS);
    }
  }

  window.RaceMode = {
    enter() {
      gen += 1; // cancel any timers from a previous race
      GameState.setMode("race");
      GameState.setActivePlayers(2);
      GameState.startRace();
      consumed[1] = consumed[2] = false;
      GameState.currentPrompt = GameState.format("race_intro", {
        TOTAL: GameState.race.total, DIFFICULTY: GameState.difficulty,
      });
      GameState.markResult(`Race — best of ${GameState.race.total}`);
      Speak.say(GameState.currentPrompt);
      later(askQuestion, INTRO_MS);
    },

    onTouch(player, dot, event) {
      if (player > GameState.activePlayers) return;
      if (GameState.race.over) return; // match decided — ignore further input

      if (event === "up") {
        GameState.removeTouch(player, dot);
        if (!GameState.letterCompleteFor(player)) consumed[player] = false; // re-arm
        return;
      }
      if (event !== "down") return;

      const target = GameState.targetDotsFor(player);
      if (!target.length) return;                 // between questions / not ready
      if (GameState.hasTouched(player, dot)) return;

      GameState.addTouch(player, dot);            // add EVERY held dot (wrong ones block)
      if (target.includes(dot)) {
        Audio.playDot(player, dot, true);
      } else {
        GameState.markResult(`Player ${player} wrong dot ${dot}`);
        Audio.buzz(player);
      }

      // Re-arm whenever the held set isn't the exact letter (a stray dot, or a
      // release+press for a double letter).
      if (!GameState.letterCompleteFor(player)) { consumed[player] = false; return; }
      if (consumed[player]) return;               // already counted this exact set
      consumed[player] = true;

      const step = GameState.advanceRacePlayer(player);
      if (!step.wordDone) {
        // finished a letter mid-word: stay consumed only if the held set already
        // equals the NEXT letter (a double letter needs a deliberate re-press).
        consumed[player] = GameState.letterCompleteFor(player);
        return;
      }
      onQuestionWon(player); // finished the final letter -> takes the question
    },

    onCommand(command) {
      if (command === "repeat") Speak.say(GameState.currentPrompt);
    },
  };
})();
