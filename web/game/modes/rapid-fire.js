/**
 * web/game/modes/rapid-fire.js — Mode 4: rapid fire
 * Owner: P2 (Game Logic)
 *
 * A stream of prompts inside a 30/60s window; count correct. Solo (beat best)
 * or 1v1 (most correct). Reuses find-target scoring under a timer.
 *
 * SCAFFOLD STUB — TODO expose: { enter(), onTouch(player,dot,event), onCommand(cmd) }
 *  - start timer (CONFIG.RAPID_FIRE_SEC); feed prompts until time out
 *  - tally correct per player; announce final via Speak.say
 */
