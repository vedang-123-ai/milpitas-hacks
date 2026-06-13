/**
 * web/game/modes/find-target.js — Mode 2: find-target (CORE LOOP — build first)
 * Owner: P2 (Game Logic)
 *
 * TTS prompts a position or letter; a correct touch earns a reward earcon.
 * This is the vertical-slice target: key "4" -> Contract-1 msg -> score here ->
 * Audio.playDot high+right -> Speak.say("correct").
 *
 * SCAFFOLD STUB — TODO expose: { enter(), onTouch(player,dot,event), onCommand(cmd) }
 *  - pick a prompt/target from content (positions for easy, letters otherwise)
 *  - Speak.say(prompt); on correct dot -> Audio.playDot(...,true) + advance
 *  - on wrong -> Audio.buzz (gentle), do not end turn
 */
