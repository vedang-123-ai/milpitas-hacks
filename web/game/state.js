/**
 * web/game/state.js — the single game-state model (browser-only)
 * Owner: P2 (Game Logic)
 */
(function () {
  const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function makePlayers() {
    return {
      // `pos` is each player's INDEPENDENT position in the current race word
      // (which letter of the word they're tracing). Unused outside race mode.
      1: { touched: new Set(), score: 0, pos: 0 },
      2: { touched: new Set(), score: 0, pos: 0 },
    };
  }

  function sameSet(a, b) {
    if (a.size !== b.length) return false;
    return b.every((dot) => a.has(dot));
  }

  function formatPrompt(template, values) {
    return String(template || "").replace(/\{([A-Z0-9]+)\}/g, (_, key) => {
      return values[key] == null ? "" : values[key];
    });
  }

  const state = {
    content: null,
    mode: "find-target",
    difficulty: "easy",
    players: makePlayers(),
    currentPrompt: "",
    currentLabel: "",
    currentType: "letter",
    targetDots: [],
    letters: [],        // sequence of { letter, dots } for the current challenge
    letterIndex: 0,     // which letter of that sequence is the active target
    activePlayers: 1,
    deadline: 0,
    round: 0,
    lastResult: "Ready",

    // 1v1 race match state. `active` while a race is in progress, `over` once a
    // winner is declared. `asked` counts questions shown; once asked >= total and
    // scores differ the match ends (a tie triggers sudden-death questions).
    race: { active: false, total: 0, asked: 0, over: false, winner: 0, sudden: false, dismissed: false },
    raceQuestionsOverride: null, // voice-set "best of N"; null = use difficulty default
    practiceLetters: null,       // when set, the curriculum is biased to these weak letters

    init(content) {
      this.content = content;
      this.resetScores();
      this.newTurn();
    },

    resetScores() {
      this.players = makePlayers();
    },

    resetTouches() {
      Object.values(this.players).forEach((player) => player.touched.clear());
    },

    setMode(mode) {
      this.mode = mode;
      this.resetTouches();
      // Leaving race mode tears down any in-flight match so a stale race banner
      // or pending question can't bleed into another mode.
      if (mode !== "race") this.race.active = false;
    },

    setDifficulty(difficulty) {
      if (!this.content || !this.content.difficulty[difficulty]) return false;
      this.difficulty = difficulty;
      this.resetTouches();
      return true;
    },

    setActivePlayers(count) {
      this.activePlayers = count === 2 ? 2 : 1;
    },

    newTurn(challenge) {
      this.resetTouches();
      if (challenge) {
        this.round += 1;
        this.letters = challenge.letters || [];
        this.letterIndex = 0;
        this.currentPrompt = challenge.prompt;
        this.currentLabel = challenge.label;
        this.currentType = challenge.type;
        this.targetDots = this.letters.length
          ? this.letters[0].dots.slice()
          : (challenge.dots || []).slice();
        this.lastResult = "New target";
      }
    },

    // Advance to the next letter in a multi-letter challenge (word/sentence).
    // Returns { done:true } when the whole word/sentence is finished, else
    // { done:false, letter } for the next letter to trace.
    advanceLetter() {
      this.letterIndex += 1;
      if (this.letterIndex < this.letters.length) {
        // Do NOT reset the held set here. On real hardware the player keeps pads
        // pressed across letters (a dot shared by two letters stays down and never
        // re-fires a "down"). Resetting would desync the software set from the
        // physical pads and make multi-letter words impossible to finish.
        const cur = this.letters[this.letterIndex];
        this.targetDots = cur.dots.slice();
        this.lastResult = `Next letter ${cur.letter}`;
        return { done: false, letter: cur.letter };
      }
      return { done: true };
    },

    format(key, values) {
      return formatPrompt((this.content.prompts && this.content.prompts[key]) || "", values);
    },

    wordToLetters(word) {
      return String(word)
        .toUpperCase()
        .split("")
        .map((ch) => ({ letter: ch, dots: (this.content.letters[ch] || []).slice() }))
        .filter((x) => x.dots.length);
    },

    // The letter a player is currently trying to form (race uses their own pos,
    // every other mode uses the shared letterIndex). Used by analytics to blame
    // a wrong-dot miss on the right letter. "" when no letter is loaded.
    currentLetterFor(player) {
      const seq = this.letters;
      if (!seq || !seq.length) return "";
      const idx = this.race && this.race.active
        ? (this.players[player] && this.players[player].pos) || 0
        : this.letterIndex;
      const cur = seq[idx];
      return cur ? cur.letter : "";
    },

    // ── Practice targeting ────────────────────────────────────────────────────
    // When practiceLetters is set, bias the curriculum toward those letters.
    // Both helpers fall back to the full pool when practice is off OR when no
    // candidate matches, so they NEVER break normal play or starve a difficulty.
    setPracticeLetters(letters) {
      this.practiceLetters = letters && letters.length ? letters.slice() : null;
    },
    practiceLetterPool(all) {
      const p = this.practiceLetters;
      if (!p || !p.length) return all;
      const avail = p.filter((L) => this.content.letters[L]);
      return avail.length ? avail : all;
    },
    practiceWordPool(list) {
      const p = this.practiceLetters;
      if (!p || !p.length || !list || !list.length) return list;
      const set = new Set(p);
      const hit = list.filter((w) => {
        for (const ch of String(w)) if (set.has(ch)) return true;
        return false;
      });
      return hit.length ? hit : list;
    },

    // Build the next challenge. Difficulty decides the SHAPE:
    //   easy   -> a random single letter
    //   medium -> a random word (traced letter by letter)
    //   hard   -> a sentence of random words (traced letter by letter)
    // Race & rapid-fire always use a single letter, because their shared target
    // can't track each player's position through a multi-letter word.
    nextChallenge() {
      const allLetters = Object.keys(this.content.letters);
      const tier = (this.content.difficulty && this.content.difficulty[this.difficulty]) || { kind: "letter" };
      const kind = tier.kind || "letter";
      const soloWords = this.mode === "find-target";

      if (!soloWords || kind === "letter") {
        const L = randItem(this.practiceLetterPool(allLetters));
        return {
          type: "letter",
          label: L,
          letters: [{ letter: L, dots: this.content.letters[L].slice() }],
          prompt: this.format("trace_letter", { LETTER: L }),
        };
      }

      if (kind === "word") {
        // medium / hard read from length-bucketed banks loaded from words.txt;
        // fall back to the seed list, then to letters, if a bank is empty.
        const bank =
          tier.bank === "hard" ? this.content.words_hard
          : tier.bank === "medium" ? this.content.words_medium
          : null;
        const list =
          bank && bank.length ? bank
          : this.content.words && this.content.words.length ? this.content.words
          : allLetters;
        const word = randItem(this.practiceWordPool(list));
        const seq = this.wordToLetters(word);
        if (!seq.length) {
          const L = randItem(allLetters);
          return { type: "letter", label: L, letters: [{ letter: L, dots: this.content.letters[L].slice() }],
                   prompt: this.format("trace_letter", { LETTER: L }) };
        }
        return {
          type: "word",
          label: word,
          letters: seq,
          prompt: this.format("spell_word", { WORD: word, LETTER: seq[0].letter }),
        };
      }

      // sentence
      const n = tier.wordsPerSentence || 3;
      const words = [];
      for (let i = 0; i < n; i++) words.push(randItem(this.content.words || allLetters));
      const sentence = words.join(" ");
      const seq = words.flatMap((w) => this.wordToLetters(w));
      return {
        type: "sentence",
        label: sentence,
        letters: seq,
        prompt: this.format("spell_sentence", { SENTENCE: sentence, LETTER: seq[0].letter }),
      };
    },

    // ── 1v1 RACE ────────────────────────────────────────────────────────────
    // A race is a fixed number of questions; each question is one letter (easy)
    // or one word (medium/hard, spelled letter-by-letter). Both players race the
    // SAME question on their own cells and progress INDEPENDENTLY (players[p].pos),
    // so the first to finish the whole word takes the point. After the set number
    // of questions the higher score wins; a tie forces sudden-death questions.

    // How many questions this race runs: a voice override wins, else the
    // per-difficulty default from content.json, else the CONFIG fallback.
    raceQuestionCount() {
      const fallback = (window.CONFIG && window.CONFIG.RACE_QUESTIONS) || 5;
      const byDiff = this.content && this.content.race && this.content.race.questions;
      const base = this.raceQuestionsOverride
        || (byDiff && byDiff[this.difficulty])
        || fallback;
      return this.clampQuestions(base);
    },

    clampQuestions(n) {
      const cfg = (this.content && this.content.race) || {};
      const min = cfg.minQuestions || 1;
      const max = cfg.maxQuestions || 15;
      n = Math.round(Number(n) || 0);
      return Math.max(min, Math.min(max, n));
    },

    // Voice-configurable "best of N". Returns the clamped value actually stored.
    setRaceQuestions(n) {
      this.raceQuestionsOverride = this.clampQuestions(n);
      return this.raceQuestionsOverride;
    },

    // Begin a fresh match: zero scores, no question loaded yet (the mode narrates
    // an intro first, then calls loadRaceQuestion for question 1).
    startRace() {
      this.resetScores();
      this.resetTouches();
      this.players[1].pos = 0;
      this.players[2].pos = 0;
      this.letters = [];
      this.targetDots = [];
      this.race = {
        active: true,
        total: this.raceQuestionCount(),
        asked: 0,
        over: false,
        winner: 0,
        sudden: false,
        dismissed: false,
      };
    },

    // Like a race-flavoured nextChallenge, but ALWAYS a single letter or single
    // word (never a sentence) so both players share one tracable target.
    nextRaceChallenge() {
      const allLetters = Object.keys(this.content.letters);
      const tier = (this.content.difficulty && this.content.difficulty[this.difficulty]) || { kind: "letter" };
      const asLetter = () => {
        const L = randItem(this.practiceLetterPool(allLetters));
        return { type: "letter", label: L, letters: [{ letter: L, dots: this.content.letters[L].slice() }] };
      };

      if ((tier.kind || "letter") !== "word") return asLetter();

      const bank =
        tier.bank === "hard" ? this.content.words_hard
        : tier.bank === "medium" ? this.content.words_medium
        : null;
      const list =
        bank && bank.length ? bank
        : this.content.words && this.content.words.length ? this.content.words
        : null;
      if (!list) return asLetter();

      const word = randItem(this.practiceWordPool(list));
      const seq = this.wordToLetters(word);
      if (!seq.length) return asLetter();
      return { type: "word", label: word, letters: seq };
    },

    // Load the next race question. Increments `asked`, resets both players to the
    // start of the new word. The mode sets currentPrompt (it wants the spoken
    // question number); we just stage the target data here.
    loadRaceQuestion(challenge) {
      this.race.asked += 1;
      this.round += 1;
      this.letters = challenge.letters || [];
      this.players[1].pos = 0;
      this.players[2].pos = 0;
      this.resetTouches();
      this.currentLabel = challenge.label;
      this.currentType = challenge.type;
      this.targetDots = this.letters.length ? this.letters[0].dots.slice() : [];
      this.lastResult = `Question ${this.race.asked} of ${this.race.total}`;
    },

    // The dots a given player needs RIGHT NOW: the letter at their own position
    // in the race word (race mode), else the shared target (other modes).
    targetDotsFor(player) {
      if (!this.race.active) return this.targetDots.slice();
      const seq = this.letters;
      const p = this.players[player];
      if (!seq || !seq.length || !p || p.pos >= seq.length) return [];
      return seq[p.pos].dots.slice();
    },

    // Has this player's held set EXACTLY matched their current letter?
    letterCompleteFor(player) {
      const target = this.targetDotsFor(player);
      const p = this.players[player];
      return Boolean(target.length && p && sameSet(p.touched, target));
    },

    // Move a player to the next letter of the race word. Returns { wordDone:true }
    // when they've just finished the final letter (i.e. won the question).
    advanceRacePlayer(player) {
      const p = this.players[player];
      if (!p) return { wordDone: true };
      p.pos += 1;
      if (p.pos < this.letters.length) {
        return { wordDone: false, letter: this.letters[p.pos].letter };
      }
      return { wordDone: true };
    },

    raceFinish(winner) {
      this.race.over = true;
      this.race.winner = winner;
    },

    // Tear DOWN the on-screen leftovers of a finished race (win banner, the last
    // question's dot highlights) and return to a neutral menu prompt — WITHOUT
    // erasing the result (over/winner/scores stay, so the match is still "over"
    // and further pad input is ignored). `dismissed` tells the mirror to stop
    // drawing the banner. Say "two player" to race again, or switch modes.
    raceTeardown() {
      this.race.active = false;
      this.race.dismissed = true;
      this.resetTouches();
      this.players[1].pos = 0;
      this.players[2].pos = 0;
      this.letters = [];
      this.targetDots = [];
      this.currentLabel = "";
      this.currentType = "letter";
      this.currentPrompt = this.format("menu", {});
      this.lastResult = "";
    },

    // `touched` is the set of dots currently HELD DOWN (press adds, release removes).
    // A letter is complete only when this set EXACTLY equals targetDots — so a
    // subset (just dot 1) or a superset (1,4,5) does not count. See hasCompleted.
    addTouch(player, dot) {
      const playerState = this.players[player];
      if (!playerState) return false;
      playerState.touched.add(dot);
      return true;
    },

    removeTouch(player, dot) {
      const playerState = this.players[player];
      if (!playerState) return false;
      playerState.touched.delete(dot);
      return true;
    },

    hasTouched(player, dot) {
      const playerState = this.players[player];
      return Boolean(playerState && playerState.touched.has(dot));
    },

    hasCompleted(player) {
      const playerState = this.players[player];
      return Boolean(playerState && sameSet(playerState.touched, this.targetDots));
    },

    remainingDots(player) {
      const playerState = this.players[player];
      if (!playerState) return this.targetDots.slice();
      return this.targetDots.filter((dot) => !playerState.touched.has(dot));
    },

    score(player, points = 1) {
      if (!this.players[player]) return;
      this.players[player].score += points;
    },

    markResult(text) {
      this.lastResult = text;
    },

    scoreText(player) {
      return formatPrompt(this.content.prompts.win, {
        PLAYER: player,
        S1: this.players[1].score,
        S2: this.players[2].score,
      });
    },

    snapshot() {
      return {
        mode: this.mode,
        difficulty: this.difficulty,
        activePlayers: this.activePlayers,
        round: this.round,
        prompt: this.currentPrompt,
        label: this.currentLabel,
        type: this.currentType,
        targetDots: this.targetDots.slice(),
        scores: {
          1: this.players[1].score,
          2: this.players[2].score,
        },
        touched: {
          1: Array.from(this.players[1].touched),
          2: Array.from(this.players[2].touched),
        },
        // per-player target so the mirror can show each player's OWN current
        // letter during a word race (equals targetDots in every other mode).
        targetByPlayer: { 1: this.targetDotsFor(1), 2: this.targetDotsFor(2) },
        posByPlayer: { 1: this.players[1].pos, 2: this.players[2].pos },
        wordLen: this.letters.length,
        race: {
          active: this.race.active,
          total: this.race.total,
          asked: this.race.asked,
          over: this.race.over,
          winner: this.race.winner,
          sudden: this.race.sudden,
          dismissed: this.race.dismissed,
        },
        lastResult: this.lastResult,
        secondsLeft: Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000)),
      };
    },
  };

  window.GameState = state;
})();
