/**
 * web/voice/recognition.js — Contract 2 voice-in surface (global `Voice`)
 * Owner: P3 (Sensory Layer)
 *
 * Voice IN, primary path — Web Speech API SpeechRecognition (Chrome/Edge). Free,
 * no account, no network dependency at the app layer. Matches utterances against
 * the content.json `commands` grammar and fires registered callbacks.
 *
 * Contract 2: Voice.onCommand(callback).
 * Additive (append-only) helpers used by integration (P4) and wispr-hook.js:
 *   Voice.setGrammar(commands)   // feed content.json.commands
 *   Voice.start() / Voice.stop()
 *   Voice.suppress(on)           // ignore results while TTS is speaking (echo guard)
 *   Voice.parse(text) -> command|null
 *   Voice._dispatch(command)     // fan out to callbacks (shared with Wispr input)
 *
 * Requires a secure context (https or http://localhost) + mic permission, and a
 * user gesture to begin — we auto-start on the first interaction.
 */

const Voice = (() => {
  // Default grammar: a copy of the known commands so the layer works standalone
  // (e.g. in mocks/audio-test.html). P4 overrides via setGrammar(content.commands).
  let grammar = [
    'one player', 'two player', 'race', 'easy', 'medium', 'hard',
    'rapid fire', 'start', 'repeat', 'quit',
    'three words', 'four words', 'five words', 'six words',
    'seven words', 'eight words', 'nine words', 'ten words',
  ];

  const callbacks = [];
  let suppressed = false;     // true while TTS is speaking
  let wantListening = false;  // user intent: should we be listening?
  let restartTimer = null;

  const norm = (s) =>
    String(s).toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

  // Map a free-form transcript to a grammar command, or null.
  function parse(text) {
    const t = norm(text);
    if (!t) return null;
    const tNoSpace = t.replace(/\s/g, '');

    let best = null;
    let bestScore = 0;
    for (const cmd of grammar) {
      const c = norm(cmd);
      // 1) direct phrase inclusion (strongest)
      if (t.includes(c)) return cmd;
      // 2) despaced inclusion ("rapidfire" -> "rapid fire")
      if (tNoSpace.includes(c.replace(/\s/g, ''))) return cmd;
      // 3) token overlap — fraction of command words present in the transcript
      const words = c.split(' ');
      const present = words.filter((w) => t.split(' ').includes(w)).length;
      const score = present / words.length;
      if (score > bestScore) { bestScore = score; best = cmd; }
    }
    return bestScore >= 0.5 ? best : null;
  }

  function _dispatch(cmd) {
    if (!cmd) return;
    callbacks.forEach((cb) => { try { cb(cmd); } catch (e) { console.error(e); } });
  }

  function onCommand(cb) {
    if (typeof cb === 'function') callbacks.push(cb);
  }

  function setGrammar(cmds) {
    if (Array.isArray(cmds) && cmds.length) grammar = cmds.slice();
  }

  function suppress(on) { suppressed = !!on; }

  // ---- SpeechRecognition engine -------------------------------------------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let warned = false;

  function build() {
    if (!SR) return null;
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = 'en-US';
    r.maxAlternatives = 3;

    r.onresult = (ev) => {
      if (suppressed) return; // don't transcribe our own TTS
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (!res.isFinal) continue;
        // try each alternative; first that maps to a command wins
        for (let a = 0; a < res.length; a++) {
          const cmd = parse(res[a].transcript);
          if (cmd) { _dispatch(cmd); return; }
        }
      }
    };

    // Recognition naturally ends (timeouts, pauses) — restart if still wanted.
    r.onend = () => { if (wantListening) scheduleRestart(250); };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantListening = false; // permission denied — stop hammering
        console.warn('[Voice] mic permission denied; voice commands disabled.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        scheduleRestart(600);
      }
    };
    return r;
  }

  function scheduleRestart(ms) {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => { if (wantListening) safeStart(); }, ms);
  }

  function safeStart() {
    if (!rec) rec = build();
    if (!rec) return;
    try { rec.start(); } catch (_) { /* already started — ignore */ }
  }

  function start() {
    if (!SR) {
      if (!warned) { warned = true; console.warn('[Voice] SpeechRecognition unavailable — use Chrome/Edge.'); }
      return;
    }
    wantListening = true;
    safeStart();
  }

  function stop() {
    wantListening = false;
    clearTimeout(restartTimer);
    try { rec && rec.stop(); } catch (_) {}
  }

  // Auto-start on the first user gesture (mic needs a gesture + secure context).
  const kick = () => start();
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, kick, { once: true, passive: true })
  );

  return { onCommand, setGrammar, start, stop, suppress, parse, _dispatch };
})();

window.Voice = Voice;
