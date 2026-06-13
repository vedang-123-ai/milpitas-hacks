/**
 * web/input/mock-source.js — fake input: wraps mocks/keyboard-emitter.js
 * Owner: P4 (Integration)
 *
 * The other half of the mock toggle. Exposes the SAME surface as hub-source.js
 * — start(onMessage) — so main.js swaps the two with no other change. Enables
 * full game dev with NO board attached (?mock=1).
 */
(function () {
  function start(onMessage) {
    // KeyboardEmitter is defined in mocks/keyboard-emitter.js (loaded before us).
    if (typeof KeyboardEmitter === 'undefined') {
      console.error('[mock-source] KeyboardEmitter missing — check index.html load order');
      return;
    }
    KeyboardEmitter.start(onMessage);
    console.info('[mock-source] keyboard emitter active — keys 1-6 = P1, QWERTY = P2');
  }

  window.MockSource = { start };
})();
