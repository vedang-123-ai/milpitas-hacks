/**
 * web/voice/wispr-hook.js — OPTIONAL "premium" voice-in via Wispr Flow
 * Owner: P3 (Sensory Layer)
 *
 * Wispr Flow is a system-level dictation app that types into the focused field
 * (cloud-only, needs internet). We expose the always-focused #voice-input and
 * parse injected text with the SAME grammar/matcher as recognition.js, feeding
 * matched commands through the same Voice callbacks.
 *
 * MUST NOT be a demo dependency — venue Wi-Fi/cloud can fail. Web Speech wins.
 * This is intentionally thin: it reuses Voice.parse + Voice._dispatch so there is
 * zero duplicated logic. Polish (debounce/visual feedback) only if time remains.
 */

(() => {
  const input = document.getElementById('voice-input');
  if (!input || !window.Voice) return;

  function handle() {
    const cmd = window.Voice.parse(input.value);
    if (cmd) {
      window.Voice._dispatch(cmd);
      input.value = '';
    }
  }

  // Dictation lands as an 'input' event; Enter also submits explicitly.
  input.addEventListener('change', handle);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handle(); });

  // NOTE (P4 integration): the box no longer AUTO-grabs/holds focus. The previous
  // always-refocus stole focus from the keyboard mock (so number-key "touches"
  // and even button clicks broke) and isn't needed — Wispr types into whatever is
  // focused, so the user just clicks the field when they want to dictate. Flagged
  // for P3. (Was: refocus() on load + setTimeout refocus on every blur.)
})();
