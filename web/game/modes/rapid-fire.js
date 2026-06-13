/**
 * web/game/modes/rapid-fire.js — Mode 4: rapid fire
 * Owner: P2 (Game Logic)
 */
(function () {
  let timerId = 0;

  function durationMs() {
    const seconds = (window.CONFIG && CONFIG.RAPID_FIRE_SEC) || 30;
    return seconds * 1000;
  }

  function active() {
    return Date.now() < GameState.deadline;
  }

  function promptNext() {
    GameState.newTurn(GameState.nextChallenge());
    Speak.say(GameState.currentPrompt);
  }

  function finish() {
    window.clearTimeout(timerId);
    timerId = 0;
    const s1 = GameState.players[1].score;
    const s2 = GameState.players[2].score;
    Speak.say(`Time. Player 1 scored ${s1}. Player 2 scored ${s2}.`);
  }

  window.RapidFireMode = {
    enter() {
      GameState.setMode("rapid-fire");
      GameState.resetScores();
      GameState.deadline = Date.now() + durationMs();
      window.clearTimeout(timerId);
      timerId = window.setTimeout(finish, durationMs());
      promptNext();
    },

    onTouch(player, dot, event) {
      if (event !== "down" || !active()) return;
      if (player > GameState.activePlayers) return;

      if (!GameState.targetDots.includes(dot)) {
        GameState.markResult(`Player ${player} touched wrong dot ${dot}`);
        Audio.buzz(player);
        return;
      }

      if (GameState.hasTouched(player, dot)) {
        GameState.markResult(`Player ${player} already found dot ${dot}`);
        return;
      }

      GameState.addTouch(player, dot);
      Audio.playDot(player, dot, true);

      if (GameState.hasCompleted(player)) {
        GameState.score(player);
        GameState.markResult(`Player ${player} completed ${GameState.currentLabel}`);
        Speak.say("correct");
        promptNext();
      } else {
        GameState.markResult(`Player ${player} found dot ${dot}`);
      }
    },

    onCommand(command) {
      if (command === "repeat") Speak.say(GameState.currentPrompt);
      if (command === "start") this.enter();
    },
  };
})();
