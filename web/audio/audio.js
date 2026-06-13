/**
 * web/audio/audio.js — Contract 2 audio surface (global `Audio`)
 * Owner: P3 (Sensory Layer)
 *
 * Defines the global `Audio` object the game calls. Intentionally shadows the
 * built-in HTMLAudioElement constructor — the app uses AudioContext, not new Audio().
 * Tone/earcon parameters come from earcons.js so the mapping is tweakable alone.
 *
 * Sonification (per docs/CONTRACTS.md):
 *  - horizontal -> stereo pan: left col (1,2,3) left, right col (4,5,6) right
 *  - vertical   -> pitch: top (1,4) high, mid (2,5) mid, bottom (3,6) low
 *
 * SCAFFOLD STUB — TODO implement the global Audio = {
 *    playDot(player, dot, isCorrect), win(player), buzz(player)
 *  }
 *  - lazy AudioContext, resume() on first user gesture
 *  - StereoPannerNode for pan, OscillatorNode freq for pitch
 *  - distinct earcons: explore / correct / win / gentle-buzz (never harsh)
 *  - REQUIRES HEADPHONES (dead on laptop speakers)
 */
