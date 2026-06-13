/**
 * web/main.js — integration entry point (thin wiring + sighted-judge mirror)
 * Owner: P4 (Integration)
 *
 * The single seam where the layers meet. Everything it calls is a frozen contract
 * or a global from another lane:
 *   - Engine.*  (P2)  init / handleTouch / handleCommand
 *   - Audio.*, Speak.*, Voice.* (P3)
 *   - MockSource / HubSource (P4)  start(onMessage)
 *   - GameState.snapshot() (P2)  READ-ONLY, for the on-screen mirror
 *
 * No game RULES live here — only wiring and presentation. The render() panel is
 * the screen equivalent of the hardware LEDs: it shows what the audio is conveying.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const logEl = $('log');
  function log(line) {
    if (logEl) logEl.textContent = (line + '\n' + logEl.textContent).slice(0, 4000);
  }
  // Call into another lane only if it has landed (keeps the app alive mid-integration).
  function safe(label, fn) {
    try { if (fn() === false) log(`[pending] ${label}`); }
    catch (err) { log(`[error] ${label}: ${err.message}`); }
  }

  // ---- shared touch router: ONE path for keyboard, hub, and clicks ----
  function routeTouch(player, dot, event) {
    log(`[touch] P${player} dot ${dot} ${event}`);
    safe('Engine.handleTouch', () =>
      typeof Engine !== 'undefined' ? Engine.handleTouch(player, dot, event) : false);
    render();
  }

  // ---- on-screen mirror of game state (sighted judges / debugging) ----
  // The dots are ALSO clickable — the most reliable input for testing, with no
  // keyboard-focus gotchas. A click = a down+up touch for that player's pad.
  const DOT_ORDER = [1, 4, 2, 5, 3, 6]; // visual Braille layout: cols then rows
  function buildGrid(el, player) {
    if (!el) return;
    el.innerHTML = '';
    for (const n of DOT_ORDER) {
      const d = document.createElement('div');
      d.className = 'dot'; d.dataset.dot = n;
      d.innerHTML = `<span class="num">${n}</span>`;
      // Click TOGGLES the dot: first click presses (down/hold), second releases
      // (up). This mirrors holding a physical pad, so you can build the exact
      // combination — e.g. select 1 and 4, deselect a stray 5 — before it scores.
      d.addEventListener('click', () => {
        unlockAudio();
        const held = (typeof GameState !== 'undefined' && GameState.players[player])
          ? GameState.players[player].touched : null;
        const isDown = held && held.has(n);
        routeTouch(player, n, isDown ? 'up' : 'down');
      });
      el.appendChild(d);
    }
  }
  function paintCell(gridEl, touched, target) {
    if (!gridEl) return;
    for (const dotEl of gridEl.children) {
      const n = Number(dotEl.dataset.dot);
      const inTarget = target.includes(n);
      const isHeld = touched.includes(n);
      dotEl.classList.toggle('target', inTarget);          // dashed ring = needed
      dotEl.classList.toggle('on', isHeld && inTarget);    // green = correct & held
      dotEl.classList.toggle('wrong', isHeld && !inTarget); // red = wrong dot held
    }
  }
  // ---- audio diagnostics + guaranteed unlock --------------------------------
  // Browsers gate Web Audio AND speechSynthesis behind a user gesture, and Chrome
  // sometimes leaves speechSynthesis "paused". This forces both awake and reports
  // state on-screen so we can SEE whether audio is actually running.
  function unlockAudio() {
    let ctxState = 'no-AudioContext';
    try { if (typeof Audio !== 'undefined') ctxState = (Audio.resume() || {}).state || '?'; } catch (e) { ctxState = 'err'; }
    let voices = 0;
    try { window.speechSynthesis && window.speechSynthesis.resume(); voices = (window.speechSynthesis?.getVoices() || []).length; } catch (_) {}
    safe('Speak.prime', () => (typeof Speak !== 'undefined' && Speak.prime ? Speak.prime() : false));
    const chip = $('a-status');
    if (chip) chip.textContent = `🔊 ctx:${ctxState} · voices:${voices}`;
    return { ctxState, voices };
  }

  // Tee every spoken line to an on-screen caption so the demo NEVER depends on
  // TTS actually producing sound (accessibility + flaky-audio insurance).
  function installCaptionTee() {
    if (typeof Speak === 'undefined' || !Speak.say || Speak._teed) return;
    const original = Speak.say.bind(Speak);
    Speak.say = (text, opts) => {
      const cap = $('caption');
      if (cap && text) cap.textContent = String(text);
      return original(text, opts);
    };
    Speak._teed = true;
  }
  function testSound() {
    const { ctxState, voices } = unlockAudio();
    safe('Audio.win(test)', () => (typeof Audio !== 'undefined' ? Audio.win(1) : false)); // audible arpeggio
    safe('Speak.test', () => (typeof Speak !== 'undefined' ? Speak.say('Audio test. One. Two. Three.') : false));
    log(`[audio] test fired — context ${ctxState}, ${voices} TTS voices`);
  }

  function render() {
    if (typeof GameState === 'undefined' || !GameState.content) return;
    const s = GameState.snapshot();
    $('s-mode').textContent = s.mode;
    $('s-diff').textContent = s.difficulty;
    $('s-score1').textContent = s.scores[1];
    $('s-score2').textContent = s.scores[2];
    $('prompt').textContent = s.prompt || '—';
    $('result').textContent = s.lastResult || '';
    paintCell($('grid1'), s.touched[1], s.targetDots);
    paintCell($('grid2'), s.touched[2], s.targetDots);
    const fmt = (arr) => (arr && arr.length ? arr.slice().sort().join(', ') : '—');
    const need = fmt(s.targetDots);
    if ($('read1')) $('read1').innerHTML = `need <b>${need}</b> · holding <b>${fmt(s.touched[1])}</b>`;
    if ($('read2')) $('read2').innerHTML = `need <b>${need}</b> · holding <b>${fmt(s.touched[2])}</b>`;
  }

  // Fire an engine command (used by the on-screen control buttons).
  function sendCommand(cmd) {
    unlockAudio();
    log(`[command] "${cmd}"`);
    safe('Engine.handleCommand', () =>
      typeof Engine !== 'undefined' ? Engine.handleCommand(cmd) : false);
    render();
  }

  async function boot() {
    installCaptionTee();
    buildGrid($('grid1'), 1);
    buildGrid($('grid2'), 2);

    // 1. Contract 3 — load curriculum, hand to engine (engine narrates on init).
    const content = await fetch('content.json').then((r) => r.json());
    log(`[content] loaded: ${Object.keys(content.letters).length} letters`);
    safe('Engine.init', () => (typeof Engine !== 'undefined' ? Engine.init(content) : false));

    // 2. Pick input source (mock keyboard vs real hub) — identical surface.
    const Source = CONFIG.MOCK ? window.MockSource : window.HubSource;
    log(`[input] ${CONFIG.MOCK ? 'MOCK (keyboard)' : 'HUB (' + CONFIG.HUB_URL + ')'}`);
    const iChip = $('i-status');
    if (iChip) iChip.textContent = CONFIG.MOCK ? '⌨ click / keys' : '🔌 hub: connecting…';

    // 3. Contract 1 in -> route each touch through the shared router. The 2nd arg
    //    (hub only) reports the hardware connection state to the on-screen chip.
    Source.start(
      (msg) => routeTouch(msg.player, msg.dot, msg.event),
      (state) => { if (iChip) iChip.textContent = `🔌 hub: ${state}`; }
    );

    // 4. Voice commands -> engine, then refresh.
    safe('Voice.onCommand', () =>
      typeof Voice !== 'undefined'
        ? Voice.onCommand((cmd) => {
            log(`[command] "${cmd}"`);
            safe('Engine.handleCommand', () =>
              typeof Engine !== 'undefined' ? Engine.handleCommand(cmd) : false);
            render();
          })
        : false);

    // 5. Start gesture — browsers block audio/TTS until a user interaction.
    //    The click unlocks Web Audio and re-speaks the current prompt via the
    //    engine's public "repeat" command (no game logic leaks into main.js).
    const overlay = $('start-overlay');
    $('start-btn').addEventListener('click', () => {
      unlockAudio();
      // immediate audible confirmation so you know audio works, then the prompt
      safe('Audio.win(start)', () => (typeof Audio !== 'undefined' ? Audio.win(1) : false));
      safe('Engine.handleCommand(repeat)', () =>
        typeof Engine !== 'undefined' ? Engine.handleCommand('repeat') : false);
      if (overlay) overlay.style.display = 'none';
      render();
    });
    $('test-btn').addEventListener('click', testSound);
    $('repeat-btn').addEventListener('click', () => sendCommand('repeat'));

    // On-screen command buttons — reliable control with no keyboard/voice needed.
    const CMD_BTNS = {
      'cmd-1p': 'one player', 'cmd-2p': 'two player',
      'cmd-easy': 'easy', 'cmd-medium': 'medium', 'cmd-hard': 'hard',
    };
    for (const [id, cmd] of Object.entries(CMD_BTNS)) {
      const b = $(id);
      if (b) b.addEventListener('click', () => sendCommand(cmd));
    }

    render();
    setInterval(render, 250); // keep timers/scores fresh in race & rapid-fire
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
