/**
 * mocks/keyboard-emitter.js — fake board: keyboard -> Contract-1 messages
 * Owner: P4 (Integration) — consumed by P2's harness AND the real app's mock mode.
 *
 * Lets the whole app run with ?mock=1 and no ESP32. Key map:
 *   1 2 3 4 5 6   -> Player 1, dots 1..6
 *   Q W E R T Y   -> Player 2, dots 1..6
 * keydown -> {event:"down"}, keyup -> {event:"up"}.
 *
 * Emits Contract-1 objects: { player, dot, event }. This is the SAME shape the
 * hub sends (Contract 1), so downstream code can't tell keyboard from hardware.
 */
(function () {
  // event.code -> [player, dot]. Using .code (not .key) so the physical key maps
  // the same regardless of shift/caps/layout quirks.
  const KEY_MAP = {
    Digit1: [1, 1], Digit2: [1, 2], Digit3: [1, 3],
    Digit4: [1, 4], Digit5: [1, 5], Digit6: [1, 6],
    KeyQ: [2, 1], KeyW: [2, 2], KeyE: [2, 3],
    KeyR: [2, 4], KeyT: [2, 5], KeyY: [2, 6],
  };

  // If the user is typing in a text field, let keys through to it instead of
  // treating them as pad touches — otherwise letters/digits get eaten and the
  // (optional) dictation box can never receive a command.
  function typingInField(e) {
    const el = e.target;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  // Player 2 plays on LETTER keys (Q-Y), which are also how you type word-commands
  // into a focused text box — so those yield while typing. Player 1's NUMBER keys
  // never yield (command words contain no digits), so "press 1" always registers
  // a touch even if the dictation box happens to be focused.
  function shouldYield(e, player) {
    return player === 2 && typingInField(e);
  }

  function emit(e, event, onMessage) {
    const hit = KEY_MAP[e.code];
    if (!hit) return;
    if (shouldYield(e, hit[0])) return;
    e.preventDefault();
    onMessage({ player: hit[0], dot: hit[1], event });
  }

  function start(onMessage) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;            // ignore auto-repeat: a held key is ONE down
      emit(e, 'down', onMessage);
    });
    window.addEventListener('keyup', (e) => emit(e, 'up', onMessage));
  }

  window.KeyboardEmitter = { start };
})();
