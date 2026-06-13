/**
 * web/game/engine.js — mode dispatcher + public game API
 * Owner: P2 (Game Logic). Consumes Contract 3 (content.json) and Contract 2 (Audio/Speak/Voice).
 */
(function () {
  const modes = {
    "free-explore": () => window.FreeExploreMode,
    "find-target": () => window.FindTargetMode,
    race: () => window.RaceMode,
    "rapid-fire": () => window.RapidFireMode,
  };

  function currentMode() {
    const getMode = modes[GameState.mode] || modes["find-target"];
    return getMode();
  }

  function normalizeMode(name) {
    const value = String(name || "").toLowerCase();
    if (value === "free explore" || value === "explore") return "free-explore";
    if (value === "find target" || value === "find-target" || value === "start") return "find-target";
    if (value === "two player" || value === "race") return "race";
    if (value === "rapid fire" || value === "rapid-fire") return "rapid-fire";
    return "";
  }

  const NUMBER_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  };

  // Parse a race-length command like "five words", "3 questions", "best of seven".
  // Returns the number, or 0 if it isn't a count command.
  function parseRaceCount(cmd) {
    const m = cmd.match(/^(?:best of\s+)?([a-z]+|\d+)\s+(?:words?|questions?|rounds?)$/);
    if (!m) return 0;
    const token = m[1];
    const n = /^\d+$/.test(token) ? parseInt(token, 10) : NUMBER_WORDS[token];
    return n || 0;
  }

  window.Engine = {
    init(content) {
      GameState.init(content);
      Speak.say(content.prompts.menu);
      this.setMode("find-target");
    },

    handleTouch(player, dot, event) {
      const normalizedPlayer = Number(player);
      const normalizedDot = Number(dot);
      const normalizedEvent = String(event || "").toLowerCase();

      if (!Number.isInteger(normalizedPlayer) || !Number.isInteger(normalizedDot)) return;
      if (normalizedPlayer < 1 || normalizedPlayer > 2 || normalizedDot < 1 || normalizedDot > 6) return;
      if (normalizedEvent !== "down" && normalizedEvent !== "up") return;

      currentMode().onTouch(normalizedPlayer, normalizedDot, normalizedEvent);
    },

    handleMessage(message) {
      if (!message || typeof message !== "object") return;
      this.handleTouch(message.player, message.dot, message.event);
    },

    handleCommand(command) {
      const cmd = String(command || "").trim().toLowerCase();
      if (!cmd) return;

      if (cmd === "one player") {
        GameState.setActivePlayers(1);
        GameState.resetScores();
        this.setMode("find-target");
        return;
      }

      if (cmd === "two player") {
        GameState.setActivePlayers(2);
        GameState.resetScores();
        this.setMode("race");
        return;
      }

      // "best of N" / "N words" / "N questions" -> set race length (applies to
      // the next race; say "race" to begin). Checked before difficulty/mode.
      const count = parseRaceCount(cmd);
      if (count) {
        this.setRaceQuestions(count);
        return;
      }

      if (GameState.content && GameState.content.difficulty[cmd]) {
        this.setDifficulty(cmd);
        return;
      }

      const mode = normalizeMode(cmd);
      if (mode) {
        this.setMode(mode);
        return;
      }

      if (cmd === "quit") {
        Speak.say(GameState.content.prompts.menu);
        return;
      }

      currentMode().onCommand(cmd);
    },

    setMode(name) {
      const mode = normalizeMode(name) || name;
      if (!modes[mode]) return false;
      if (mode === "race") GameState.setActivePlayers(2);
      GameState.setMode(mode);
      currentMode().enter();
      return true;
    },

    setDifficulty(level) {
      if (!GameState.setDifficulty(level)) return false;
      Speak.say(`${level} difficulty.`);
      currentMode().enter();
      return true;
    },

    // Voice-configurable race length ("best of N"). Stored for the NEXT race; if
    // a race is already running it keeps going — say "race" to restart with N.
    setRaceQuestions(n) {
      const total = GameState.setRaceQuestions(n);
      Speak.say(GameState.format("race_questions_set", { TOTAL: total }));
      return total;
    },
  };
})();
