/**
 * web/config.js — app-level runtime config (no logic)
 * Owner: P4 (Integration)
 *
 * Single place for environment knobs so feature files never edit each other for
 * settings. Read by main.js and the input sources. Exposed as a global CONFIG.
 *
 * MOCK is derived from the URL: append ?mock=1 to run with the keyboard emitter
 * instead of the real hub WebSocket — this is the "no hardware needed" switch.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const mock = params.get('mock');

  window.CONFIG = {
    // ws:// address of P1's hub (hub/server.js). Default matches the hub's
    // documented port; override here on-site if the hub moves.
    HUB_URL: 'ws://localhost:8080',

    // true => use mocks/keyboard-emitter instead of the hub. ?mock=1 (or ?mock).
    MOCK: mock === '1' || mock === 'true' || mock === '',

    // points needed to win a 1v1 race (P2's race mode reads this via content/engine)
    WIN_SCORE: 3,

    // rapid-fire window length in seconds
    RAPID_FIRE_SEC: 30,

    // default number of questions in a 1v1 race when content.json doesn't set a
    // per-difficulty default (and the fallback if a voice override is invalid).
    RACE_QUESTIONS: 5,

    // Text-to-speech voice. Empty string = let serve.py auto-pick the BEST
    // installed voice (prefers a downloaded Premium/Siri voice, else Samantha).
    // Set a specific `say -v '?'` name here to force one (e.g. "Ava (Premium)").
    TTS_VOICE: '',
  };
})();
