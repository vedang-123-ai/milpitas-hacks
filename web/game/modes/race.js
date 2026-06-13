/**
 * web/game/modes/race.js — Mode 3: 1v1 Race (HEADLINE demo mode)
 * Owner: P2 (Game Logic)
 */
(function () {
  function winScore() {
    return (window.CONFIG && CONFIG.WIN_SCORE) || 3;
  }

  function promptNext() {
    GameState.newTurn(GameState.nextChallenge());
    Speak.say(GameState.currentPrompt);
  }

  window.RaceMode = {
    enter() {
      GameState.setMode("race");
      GameState.setActivePlayers(2);
      promptNext();
    },

    onTouch(player, dot, event) {
      if (event !== "down") return;
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

      if (!GameState.hasCompleted(player)) return;

      GameState.score(player);
      GameState.markResult(`Player ${player} won the point`);
      Audio.win(player);
      Speak.say(GameState.scoreText(player));

      if (GameState.players[player].score >= winScore()) {
        Speak.say(`Player ${player} wins the race.`);
        GameState.resetScores();
      }

      promptNext();
    },

    onCommand(command) {
      if (command === "repeat") Speak.say(GameState.currentPrompt);
      if (command === "start") promptNext();
    },
  };
})();
