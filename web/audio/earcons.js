/**
 * web/audio/earcons.js — earcon + tone parameter tables (data, no logic)
 * Owner: P3 (Sensory Layer)
 *
 * Separated from audio.js so the sound design can be tuned without touching the
 * Web Audio plumbing. audio.js reads these tables.
 *
 * SCAFFOLD STUB — TODO define (as a global EARCONS object):
 *  - ROW_PITCH   : { top, mid, bottom } frequencies (Hz)
 *  - COL_PAN     : { left:-x, right:+x }
 *  - dot -> {row,col} lookup (1,4=top · 2,5=mid · 3,6=bottom · 1,2,3=left · 4,5,6=right)
 *  - per-earcon: waveform, duration, gain for explore/correct/win/buzz
 */
