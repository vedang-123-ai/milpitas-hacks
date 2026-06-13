/**
 * web/game/modes/find-target.js — Mode 2: find-target (CORE LOOP — build first)
 * Owner: P2 (Game Logic)
 *
 * Held-set model: a press adds a dot to the "held" set, a release removes it.
 * The letter is scored only when the held set EXACTLY matches the target — not a
 * subset (only dot 1) and not a superset (1, 4, AND 5). We evaluate after a short
 * settle window so you can hold/select the full combination before it's judged.
 */
(function () {
  // Wait until you've FINISHED pressing your combination, then judge the whole
  // set at once. Each press/release restarts this timer, so 1 -> 4 -> 5 is judged
  // as {1,4,5} (superset, blocked), not as {1,4} the instant before 5 lands.
  // Long enough to cover a normal click/press pace between dots.
  const SETTLE_MS = 550;
  const NEXT_DELAY_MS = 1300;  // pause after a word so "Correct" is fully heard first
  const evalTimers = {};       // player -> timeout id
  let locked = false;          // true during the post-word pause (blocks re-scoring)

  function promptNext() {
    locked = false;
    GameState.newTurn(GameState.nextChallenge());
    Speak.say(GameState.currentPrompt);
  }

  function scheduleEval(player) {
    window.clearTimeout(evalTimers[player]);
    evalTimers[player] = window.setTimeout(() => evaluate(player), SETTLE_MS);
  }

  function evaluate(player) {
    if (locked) return; // mid-pause after a completed word
    // EXACT match required (held set === target set). A subset or superset fails.
    if (!GameState.hasCompleted(player)) return;

    // the letter the player just finished forming (before advancing)
    const finished = GameState.letters[GameState.letterIndex];
    const step = GameState.advanceLetter();
    if (!step.done) {
      // Confirm the letter just completed (no "touch next" instruction). The
      // settle window before the next letter is accepted gives a natural pause.
      GameState.markResult(`Player ${player}: letter ${finished ? finished.letter : ""} done`);
      if (finished) Speak.say(finished.letter + ".");
      return;
    }

    locked = true;
    GameState.score(player);
    GameState.markResult(`Player ${player} completed ${GameState.currentLabel}`);
    Speak.say(GameState.format("correct_word", { WORD: GameState.currentLabel }));
    // pause before the next prompt so the "Correct" confirmation isn't cut off
    window.setTimeout(promptNext, NEXT_DELAY_MS);
  }

  window.FindTargetMode = {
    enter() {
      GameState.setMode("find-target");
      promptNext();
    },

    onTouch(player, dot, event) {
      if (player > GameState.activePlayers) return;

      if (event === "down") {
        if (GameState.hasTouched(player, dot)) return;   // already held
        GameState.addTouch(player, dot);                 // add EVERY dot (even wrong)
        if (GameState.targetDots.includes(dot)) {
          Audio.playDot(player, dot, true);              // correct dot -> position earcon
        } else {
          Audio.buzz(player);                            // wrong dot -> gentle buzz (no penalty)
        }
      } else if (event === "up") {
        GameState.removeTouch(player, dot);
      } else {
        return;
      }

      const held = Array.from(GameState.players[player].touched).sort().join(",");
      GameState.markResult(`Player ${player} holding [${held}]`);
      scheduleEval(player);
    },

    onCommand(command) {
      if (command === "repeat") Speak.say(GameState.currentPrompt);
      if (command === "start") promptNext();
    },
  };
})();
