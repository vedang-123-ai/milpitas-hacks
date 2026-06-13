/**
 * web/main.js — integration entry point (THIN wiring only, no game logic)
 * Owner: P4 (Integration)
 *
 * The single seam where the layers meet. Everything it touches is a frozen
 * contract or a global defined elsewhere, so this file rarely conflicts.
 *
 * SCAFFOLD STUB — TODO:
 *  1. fetch content.json (Contract 3) and hand it to the game engine
 *  2. pick the input source: CONFIG.MOCK ? mock-source : hub-source
 *  3. subscribe to Contract-1 touch messages -> engine.handleTouch(player,dot,event)
 *  4. wire Voice.onCommand(...) -> engine command handling
 *  5. kick off the menu via Speak.say(...)
 *
 * Keep this < ~40 lines. If it grows, push logic down into the owning module.
 */
