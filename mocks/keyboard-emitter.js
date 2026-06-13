/**
 * mocks/keyboard-emitter.js — fake board: keyboard -> Contract-1 messages
 * Owner: P4 (Integration) — consumed by P2 for game dev with no hardware
 *
 * Lets the whole app run with ?mock=1 and no ESP32. Key map:
 *   1 2 3 4 5 6   -> Player 1, dots 1..6
 *   Q W E R T Y   -> Player 2, dots 1..6
 * keydown -> {event:"down"}, keyup -> {event:"up"}.
 *
 * SCAFFOLD STUB — TODO expose: KeyboardEmitter.start(onMessage)
 *  - map keys per above; emit Contract-1 objects to onMessage
 *  - ignore auto-repeat so a held key isn't a stream of downs
 */
