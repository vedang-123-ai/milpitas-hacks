/**
 * web/game/modes/find-target.js — Mode 2: find-target (CORE LOOP — build first)
 * Owner: P2 (Game Logic)
 */
(function () {
  function promptNext() {
    GameState.newTurn(GameState.nextChallenge());
    Speak.say(GameState.currentPrompt);
  }

  window.FindTargetMode = {
    enter() {
      GameState.setMode("find-target");
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
        Speak.say("already found");
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
        Speak.say("keep going");
      }
    },

    onCommand(command) {
      if (command === "repeat") Speak.say(GameState.currentPrompt);
      if (command === "start") promptNext();
    },
  };
})();
