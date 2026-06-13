/**
 * web/game/state.js — the single game-state model (browser-only)
 * Owner: P2 (Game Logic)
 *
 * The ESP32 never knows the rules; all state lives here. Shared, read/written by
 * the mode modules through small helpers so modes don't reach into raw fields.
 *
 * SCAFFOLD STUB — TODO model:
 *  - mode, difficulty
 *  - currentPrompt + targetDots (the correct dot-set)
 *  - perPlayer touchedDots (this turn), scores
 *  - timer / deadline (rapid fire, race)
 *  - reset()/newTurn() helpers
 */
