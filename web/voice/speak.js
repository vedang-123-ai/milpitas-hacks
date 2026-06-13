/**
 * web/voice/speak.js — Contract 2 TTS surface (global `Speak`)
 * Owner: P3 (Sensory Layer)
 *
 * Voice OUT — the entire visible UI is replaced by narration. Browser
 * SpeechSynthesis: free, offline, zero setup. Every menu/prompt/score routes here.
 *
 * Contract 2: Speak.say(text). Also exposes Speak.cancel().
 *
 * Echo guard: while we're speaking, the speech RECOGNIZER must ignore audio or it
 * hears our own TTS as a command. We toggle Voice.suppress(true/false) around each
 * utterance (Voice is defined in recognition.js, loaded right after this file; we
 * only reference it at call time, so the load order is fine).
 */

const Speak = (() => {
  const synth = window.speechSynthesis;
  let voice = null;

  // Voices populate asynchronously; pick a clear en-US voice when available.
  function pickVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    if (!voices.length) return;
    // NOTE (P4 integration): prefer LOCAL voices. Chrome's "Google …" voices are
    // network voices that fail silently offline (no sound while Web Audio works) —
    // and the demo must run offline. Fall back to any voice only if no local one.
    const local = voices.filter((v) => v.localService);
    const pool = local.length ? local : voices;
    voice =
      pool.find((v) => /en[-_]US/i.test(v.lang) && /samantha|alex|aaron|natural/i.test(v.name)) ||
      pool.find((v) => /en[-_]US/i.test(v.lang)) ||
      pool.find((v) => /^en/i.test(v.lang)) ||
      pool[0];
  }
  if (synth) {
    pickVoice();
    synth.addEventListener?.('voiceschanged', pickVoice);
  }

  function suppressRecognizer(on) {
    try { window.Voice?.suppress?.(on); } catch (_) {}
  }

  // Anti-GC: Chrome garbage-collects the utterance before it speaks unless we keep
  // a live reference. We hold each utterance here until it ends/errors.
  const keepAlive = [];

  // Chrome silently pauses the synth engine after ~15s (and sometimes at random),
  // which makes later prompts go silent. Nudge it awake on an interval.
  if (synth) setInterval(() => { try { if (synth.speaking) synth.resume(); } catch (_) {} }, 5000);

  // Call ONCE from a real user gesture (the Start button). A near-silent warm-up
  // utterance primes the engine so the first *real* prompt isn't swallowed — a
  // well-known Chrome/Safari quirk where the very first speak() produces no sound.
  let primed = false;
  function prime() {
    if (primed || !synth) return;
    primed = true;
    try {
      synth.cancel();
      synth.resume();
      const warm = new SpeechSynthesisUtterance(' ');
      warm.volume = 0;
      synth.speak(warm);
    } catch (_) {}
  }

  // ---- native TTS (preferred): macOS `say` via web/serve.py at GET /say --------
  // The browser SpeechSynthesis engine is unreliable across machines; the native
  // OS voice is not. We try /say first and only fall back to the browser if the
  // app isn't being served by serve.py (so plain `http.server` still works).
  let nativeOK; // undefined = unknown, true/false = learned
  function ttsVoice() { return (window.CONFIG && window.CONFIG.TTS_VOICE) || ''; }
  function nativeSay(text) {
    const v = ttsVoice();
    const url = `/say?text=${encodeURIComponent(text)}` + (v ? `&voice=${encodeURIComponent(v)}` : '');
    return fetch(url).then((r) => { if (!r.ok) throw new Error('no /say'); nativeOK = true; });
  }

  // Public entry — dispatches to native, with a one-time fallback to the browser.
  // Native `say` requests can overlap if two are fired in the same tick (e.g. the
  // engine announces "hard difficulty" and the new prompt together). We coalesce a
  // burst into a single utterance — the LAST call wins — matching interrupt=true.
  let burstTimer = null;
  let pendingText = '';
  function say(text, opts = {}) {
    if (!text) return;
    if (nativeOK === false) return browserSay(text, opts);
    pendingText = text;
    clearTimeout(burstTimer);
    burstTimer = setTimeout(() => {
      const t = pendingText;
      nativeSay(t).catch(() => { nativeOK = false; browserSay(t, opts); });
    }, 30);
  }

  // ---- browser fallback (SpeechSynthesis) -------------------------------------
  // Narrate `text`. By default interrupts any in-progress speech so stale prompts
  // don't pile up; pass { interrupt:false } to queue instead.
  function browserSay(text, { interrupt = true } = {}) {
    if (!synth || !text) return;
    try {
      if (interrupt) synth.cancel();
      synth.resume(); // Chrome sometimes leaves the queue paused -> silent
    } catch (_) {}

    const u = new SpeechSynthesisUtterance(String(text));
    if (voice) u.voice = voice;
    u.lang = (voice && voice.lang) || 'en-US';
    u.rate = 0.95;   // a touch slower — clearer for young learners
    u.pitch = 1.0;
    u.volume = 1.0;

    keepAlive.push(u);
    const done = () => {
      suppressRecognizer(false);
      const i = keepAlive.indexOf(u);
      if (i >= 0) keepAlive.splice(i, 1);
    };
    u.onstart = () => suppressRecognizer(true);
    u.onend = done;
    u.onerror = done;

    // Speak on the next tick: calling speak() in the SAME tick as cancel() makes
    // Chrome drop the utterance. The page already has user activation (Start
    // click), so async speak is still allowed.
    setTimeout(() => { try { synth.speak(u); } catch (_) {} }, 0);
  }

  function cancel() {
    if (synth) synth.cancel();
    suppressRecognizer(false);
  }

  return { say, cancel, prime };
})();

window.Speak = Speak;
