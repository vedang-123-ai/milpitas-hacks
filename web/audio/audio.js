/**
 * web/audio/audio.js — Contract 2 audio surface (global `Audio`)
 * Owner: P3 (Sensory Layer)
 *
 * Defines the global `Audio` object the game calls. Intentionally shadows the
 * built-in HTMLAudioElement constructor — the app uses AudioContext, not new Audio().
 * Tone/earcon parameters come from earcons.js (global EARCONS).
 *
 * Contract 2:
 *   Audio.playDot(player, dot, isCorrect)
 *   Audio.win(player)
 *   Audio.buzz(player)
 * Additive lifecycle (safe to ignore; auto-wired): Audio.init(), Audio.resume().
 *
 * REQUIRES HEADPHONES — pan/pitch are inaudible on laptop speakers.
 */

const Audio = (() => {
  const E = window.EARCONS;
  let actx = null;
  let master = null;

  // Lazy AudioContext + a master gain (headroom so layered tones don't clip).
  function ctx() {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain();
      master.gain.value = 0.9;
      master.connect(actx.destination);
    }
    return actx;
  }

  // Browsers start the context suspended until a user gesture. Resume on demand.
  function resume() {
    const c = ctx();
    if (c.state === 'suspended') c.resume().catch(() => {});
    return c;
  }

  // Attach one-time gesture listeners so the first interaction unlocks audio.
  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    const unlock = () => resume();
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
      window.addEventListener(ev, unlock, { once: false, passive: true })
    );
  }

  const semis = (hz, n) => hz * Math.pow(2, n / 12);

  // One scheduled voice: Oscillator -> Gain (ADSR) -> StereoPanner -> master.
  // `when` is an offset in seconds from now (for sequencing notes).
  function tone({ freq, pan = 0, wave = 'sine', durMs = 160, gain = 0.2,
                  attackMs = 6, releaseMs = 120, when = 0 }) {
    const c = resume();
    const t0 = c.currentTime + when;
    const atk = attackMs / 1000;
    const rel = releaseMs / 1000;
    const dur = durMs / 1000;

    const osc = c.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t0 + atk);
    // hold, then exponential release down to silence
    g.gain.setValueAtTime(Math.max(gain, 0.0002), t0 + Math.max(dur, atk));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, atk) + rel);

    const panner = c.createStereoPanner ? c.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    osc.connect(g);
    if (panner) {
      g.connect(panner);
      panner.connect(master);
    } else {
      g.connect(master);
    }

    const stopAt = t0 + Math.max(dur, atk) + rel + 0.02;
    osc.start(t0);
    osc.stop(stopAt);
    osc.onended = () => { try { osc.disconnect(); g.disconnect(); panner && panner.disconnect(); } catch (_) {} };
  }

  // ---- Contract 2 ----------------------------------------------------------

  function playDot(player, dot, isCorrect) {
    const pos = E.DOT_MAP[dot];
    if (!pos) return;
    const freq = E.ROW_PITCH[pos.row];
    const pan = E.COL_PAN[pos.col];
    const wave = E.PLAYER_TIMBRE[player] || 'sine';

    // position tone (the core teaching signal)
    const ex = E.explore;
    tone({ freq, pan, wave, durMs: ex.durMs, gain: ex.gain,
           attackMs: ex.attackMs, releaseMs: ex.releaseMs });

    // reward chirp layered on top when the touch is correct
    if (isCorrect) {
      const ch = E.correct;
      ch.chirpSemis.forEach((n, i) => {
        tone({ freq: semis(freq, n), pan, wave: ch.wave, durMs: ch.durMs,
               gain: ch.gain, attackMs: ch.attackMs, releaseMs: ch.releaseMs,
               when: 0.04 + i * (ch.stepMs / 1000) });
      });
    }
  }

  function win(player) {
    const w = E.win;
    const pan = E.PLAYER_PAN[player] ?? 0;
    w.arpeggioSemis.forEach((n, i) => {
      tone({ freq: semis(w.baseHz, n), pan, wave: w.wave, durMs: w.durMs,
             gain: w.gain, attackMs: w.attackMs, releaseMs: w.releaseMs,
             when: i * (w.stepMs / 1000) });
    });
  }

  function buzz(player) {
    const b = E.buzz;
    const pan = E.PLAYER_PAN[player] ?? 0;
    tone({ freq: b.freqHz, pan, wave: b.wave, durMs: b.durMs, gain: b.gain,
           attackMs: b.attackMs, releaseMs: b.releaseMs });
  }

  init();
  return { playDot, win, buzz, resume, init };
})();

window.Audio = Audio;
