/**
 * web/game/modes/free-explore.js — Mode 1: free explore
 * Owner: P2 (Game Logic)
 */
(function () {
  window.FreeExploreMode = {
    enter() {
      GameState.setMode("free-explore");
      Speak.say("Free explore.");
    },

    onTouch(player, dot, event) {
      if (event !== "down") return;
      Audio.playDot(player, dot, true);
    },

    onCommand(command) {
      if (command === "repeat") Speak.say("Free explore.");
    },
  };
})();
