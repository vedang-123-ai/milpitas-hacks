/**
 * web/game/state.js — the single game-state model (browser-only)
 * Owner: P2 (Game Logic)
 */
(function () {
  const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function makePlayers() {
    return {
      1: { touched: new Set(), score: 0 },
      2: { touched: new Set(), score: 0 },
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
        this.resetTouches();
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
        const L = randItem(allLetters);
        return {
          type: "letter",
          label: L,
          letters: [{ letter: L, dots: this.content.letters[L].slice() }],
          prompt: this.format("trace_letter", { LETTER: L }),
        };
      }

      if (kind === "word") {
        const word = randItem(this.content.words || allLetters);
        const seq = this.wordToLetters(word);
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
        lastResult: this.lastResult,
        secondsLeft: Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000)),
      };
    },
  };

  window.GameState = state;
})();
