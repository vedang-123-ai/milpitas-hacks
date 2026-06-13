/**
 * web/game/state.js — the single game-state model (browser-only)
 * Owner: P2 (Game Logic)
 */
(function () {
  const POSITION_SEQUENCE = [4, 1, 3, 6];
  const DOT_PROMPT_KEYS = {
    1: "find_dot_1",
    3: "find_dot_3",
    4: "find_dot_4",
    6: "find_dot_6",
  };
  const STARTER_LETTERS = ["A", "B", "C", "E", "I", "K"];

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
    activePlayers: 1,
    deadline: 0,
    round: 0,
    lastResult: "Ready",
    sequence: {
      position: 0,
      letter: { easy: 0, medium: 0, hard: 0 },
    },

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
        this.currentPrompt = challenge.prompt;
        this.currentLabel = challenge.label;
        this.currentType = challenge.type;
        this.targetDots = challenge.dots.slice();
        this.lastResult = "New target";
      }
    },

    nextChallenge(options = {}) {
      const tier = this.content.difficulty[this.difficulty];
      const usePositions = options.positions === true && tier.positions;

      if (usePositions) {
        const dot = POSITION_SEQUENCE[this.sequence.position % POSITION_SEQUENCE.length];
        this.sequence.position += 1;
        return {
          type: "position",
          label: `dot ${dot}`,
          dots: [dot],
        prompt: this.content.prompts[DOT_PROMPT_KEYS[dot]],
      };
    }

      const letters = this.lettersForDifficulty(tier);
      const index = this.sequence.letter[this.difficulty] % letters.length;
      const letter = letters[index];
      this.sequence.letter[this.difficulty] += 1;

      return {
        type: "letter",
        label: letter,
        dots: this.content.letters[letter].slice(),
        prompt: formatPrompt(this.content.prompts.trace_letter, { LETTER: letter }),
      };
    },

    lettersForDifficulty(tier) {
      const listed = tier.letters && tier.letters.length ? tier.letters : Object.keys(this.content.letters);
      if (this.difficulty !== "easy" || listed.length > 1) return listed;

      const starters = STARTER_LETTERS.filter((letter) => this.content.letters[letter]);
      return starters.length > 1 ? starters : listed;
    },

    addTouch(player, dot) {
      const playerState = this.players[player];
      if (!playerState) return false;
      playerState.touched.add(dot);
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
