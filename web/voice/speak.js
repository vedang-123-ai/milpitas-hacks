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
    voice =
      voices.find((v) => /en[-_]US/i.test(v.lang) && /google|samantha|natural/i.test(v.name)) ||
      voices.find((v) => /en[-_]US/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      voices[0];
  }
  if (synth) {
    pickVoice();
    synth.addEventListener?.('voiceschanged', pickVoice);
  }

  function suppressRecognizer(on) {
    try { window.Voice?.suppress?.(on); } catch (_) {}
  }

  // Narrate `text`. By default interrupts any in-progress speech so stale prompts
  // don't pile up; pass { interrupt:false } to queue instead.
  function say(text, { interrupt = true } = {}) {
    if (!synth || !text) return;
    if (interrupt) synth.cancel();

    const u = new SpeechSynthesisUtterance(String(text));
    if (voice) u.voice = voice;
    u.lang = (voice && voice.lang) || 'en-US';
    u.rate = 0.95;   // a touch slower — clearer for young learners
    u.pitch = 1.0;
    u.volume = 1.0;

    u.onstart = () => suppressRecognizer(true);
    u.onend = () => suppressRecognizer(false);
    u.onerror = () => suppressRecognizer(false);

    synth.speak(u);
  }

  function cancel() {
    if (synth) synth.cancel();
    suppressRecognizer(false);
  }

  return { say, cancel };
})();

window.Speak = Speak;
