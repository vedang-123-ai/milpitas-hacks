/**
 * web/game/engine.js — mode dispatcher + public game API
 * Owner: P2 (Game Logic). Consumes Contract 3 (content.json) and Contract 2 (Audio/Speak/Voice).
 *
 * The façade main.js talks to. Holds NO mode-specific rules — it routes touches
 * and commands to the active mode module and owns mode switching.
 *
 * SCAFFOLD STUB — TODO expose: Engine.init(content), Engine.handleTouch(player,dot,event),
 *   Engine.handleCommand(cmd), Engine.setMode(name), Engine.setDifficulty(level)
 *  - load content into state; default to menu
 *  - delegate handleTouch/handleCommand to the active mode (modes/*.js)
 *  - call Speak.say for narration; never touch audio internals directly
 */
