/**
 * web/audio/earcons.js — earcon + tone parameter tables (data, no logic)
 * Owner: P3 (Sensory Layer)
 *
 * Separated from audio.js so the sound design can be tuned without touching the
 * Web Audio plumbing. audio.js reads this global `EARCONS` table.
 *
 * Sonification (per docs/CONTRACTS.md):
 *   horizontal -> stereo pan:  cols 1,2,3 = left,  4,5,6 = right
 *   vertical   -> pitch:       rows 1,4 = high, 2,5 = mid, 3,6 = low
 * Plus a per-player timbre cue so 1v1 touches are distinguishable.
 */

const EARCONS = {
  // dot (1-6) -> grid position. Drives pan (col) and pitch (row).
  DOT_MAP: {
    1: { col: 'left',  row: 'top'    },
    2: { col: 'left',  row: 'mid'    },
    3: { col: 'left',  row: 'bottom' },
    4: { col: 'right', row: 'top'    },
    5: { col: 'right', row: 'mid'    },
    6: { col: 'right', row: 'bottom' },
  },

  // Row -> pitch. A consonant set (G4 / D5 / G5) so explore never sounds "wrong".
  ROW_PITCH: { top: 783.99, mid: 587.33, bottom: 392.0 },

  // Column -> stereo pan (-1 left .. +1 right). Strong but not hard-panned.
  COL_PAN: { left: -0.85, right: 0.85 },

  // Player -> side for win()/buzz() (which aren't tied to a column).
  PLAYER_PAN: { 1: -0.85, 2: 0.85 },

  // Player -> oscillator waveform. Secondary cue layered on pan+pitch.
  // Flip both to the same value to disable the per-player distinction.
  PLAYER_TIMBRE: { 1: 'sine', 2: 'triangle' },

  // Per-earcon envelope/voicing. Times in ms, gain 0..1, semis = semitone offsets
  // from the base note (used to build chirps/arpeggios via equal temperament).
  explore: { durMs: 180, gain: 0.22, attackMs: 8, releaseMs: 90 },
  correct: {
    // a quick rising two-note "chirp" layered over the position tone (reward)
    durMs: 90, gain: 0.18, attackMs: 4, releaseMs: 70, wave: 'sine',
    chirpSemis: [12, 19], // +1 octave, +octave&fifth — bright bird-like lift
    stepMs: 70,
  },
  win: {
    // triumphant rising arpeggio on the player's side
    durMs: 160, gain: 0.26, attackMs: 6, releaseMs: 140, wave: 'sine',
    baseHz: 523.25,          // C5
    arpeggioSemis: [0, 4, 7, 12], // C E G C — major triad up to the octave
    stepMs: 110,
  },
  buzz: {
    // gentle, non-punishing wrong tone — low, soft, short. NEVER harsh.
    durMs: 220, gain: 0.16, attackMs: 10, releaseMs: 160, wave: 'triangle',
    freqHz: 174.61,          // F3, low and mellow
  },
};

// expose for non-module <script> usage
window.EARCONS = EARCONS;
