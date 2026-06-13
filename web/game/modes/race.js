/**
 * web/game/modes/race.js — Mode 3: 1v1 Race (HEADLINE demo mode)
 * Owner: P2 (Game Logic)
 *
 * One prompt to both players; both cells live. A player scores when they've
 * touched the COMPLETE correct dot-set. Wrong dot -> buzz + no score, but the
 * turn does NOT end. First to complete wins the point + panned win sting; TTS
 * announces score; first to N points wins.
 *
 * SCAFFOLD STUB — TODO expose: { enter(), onTouch(player,dot,event), onCommand(cmd) }
 *  - track each player's touchedDots vs targetDots
 *  - award on full-set match -> Audio.win(player), Speak.say(score), next round
 */
