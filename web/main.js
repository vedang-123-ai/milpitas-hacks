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

  // Tee every wrong-dot buzz to Analytics, blaming it on the letter the player was
  // forming. Wrapping Audio.buzz keeps this entirely in the integration layer — no
  // game-logic file is touched. Misses are what Practice mode targets.
  function installBuzzTracker() {
    if (typeof Audio === 'undefined' || !Audio.buzz || Audio._tracked) return;
    const original = Audio.buzz.bind(Audio);
    Audio.buzz = (player) => {
      try {
        if (typeof GameState !== 'undefined' && typeof Analytics !== 'undefined') {
          Analytics.recordMiss(GameState.currentLetterFor(player));
        }
      } catch (_) {}
      return original(player);
    };
    Audio._tracked = true;
  }

  // Turn practice mode off (a normal mode/difficulty command leaves practice).
  function exitPractice() {
    if (typeof GameState !== 'undefined' && GameState.setPracticeLetters) GameState.setPracticeLetters(null);
  }

  // Coach panel: which letters you've missed + the weak ones Practice targets.
  function renderCoach() {
    if (typeof Analytics === 'undefined') return;
    const statsEl = $('coach-stats');
    if (statsEl) {
      const summary = Analytics.summary();
      if (!summary.length) {
        statsEl.textContent = 'no misses yet — play a round';
      } else {
        const top = summary.slice(0, 8).map(([L, c]) => `${L}×${c}`).join('  ');
        const weak = Analytics.weakLetters();
        statsEl.innerHTML = top + (weak.length ? ` &nbsp;·&nbsp; weak: <b>${weak.join(' ')}</b>` : '');
      }
    }
    const btn = $('practice-btn');
    if (btn) {
      const on = typeof GameState !== 'undefined' && GameState.practiceLetters && GameState.practiceLetters.length;
      btn.classList.toggle('on', !!on);
      btn.textContent = on
        ? `Practicing ${GameState.practiceLetters.join(' ')} — tap for normal`
        : 'Practice weak letters';
    }
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
    const race = s.race || {};
    $('s-mode').textContent = s.mode;
    $('s-diff').textContent = s.difficulty;
    $('s-score1').textContent = s.scores[1];
    $('s-score2').textContent = s.scores[2];

    // prompt + status line: a race shows progress / final, others show lastResult.
    // Once the finished race is dismissed (auto-clears a few seconds after the
    // win) we fall through to the neutral menu so nothing lingers on screen.
    if (race.over && !race.dismissed) {
      $('prompt').textContent = race.winner ? `Player ${race.winner} wins the race!` : 'Race over';
      $('result').textContent = `Final — Player 1: ${s.scores[1]} · Player 2: ${s.scores[2]}`;
    } else if (race.active && !race.over) {
      $('prompt').textContent = s.prompt || '—';
      const head = race.asked < 1 ? 'Get ready…'
        : race.asked > race.total ? 'Sudden death'
        : `Question ${race.asked} of ${race.total}`;
      $('result').textContent = `${head} — P1 ${s.scores[1]} · P2 ${s.scores[2]}`;
    } else {
      $('prompt').textContent = s.prompt || '—';
      $('result').textContent = s.lastResult || '';
    }

    // Per-player target so each cell shows that player's OWN current letter
    // during a word race (equals the shared target in every other mode).
    const t1 = (s.targetByPlayer && s.targetByPlayer[1]) || s.targetDots;
    const t2 = (s.targetByPlayer && s.targetByPlayer[2]) || s.targetDots;
    paintCell($('grid1'), s.touched[1], t1);
    paintCell($('grid2'), s.touched[2], t2);

    // Victory glow on the winner's cell.
    const c1 = document.querySelector('.cell.p1');
    const c2 = document.querySelector('.cell.p2');
    if (c1) c1.classList.toggle('winner', !!(race.over && race.winner === 1));
    if (c2) c2.classList.toggle('winner', !!(race.over && race.winner === 2));

    // Readouts: spelling progress during a word race, else need/holding.
    const fmt = (arr) => (arr && arr.length ? arr.slice().sort().join(', ') : '—');
    const readout = (player, target) => {
      if (race.active && !race.over && s.type !== 'letter' && s.wordLen) {
        const pos = Math.min((s.posByPlayer && s.posByPlayer[player]) || 0, s.wordLen - 1);
        return `${s.label} — letter <b>${pos + 1}</b> of <b>${s.wordLen}</b>`;
      }
      return `need <b>${fmt(target)}</b> · holding <b>${fmt(s.touched[player])}</b>`;
    };
    if ($('read1')) $('read1').innerHTML = readout(1, t1);
    if ($('read2')) $('read2').innerHTML = readout(2, t2);

    renderCoach();
  }

  // Load words.txt and split by length. medium = 2..7 letters, hard = 8+.
  // Only A–Z words (no spaces/punctuation) survive — they have to be traceable.
  const HARD_MIN_LEN = 8;
  async function loadWordBank() {
    try {
      const text = await fetch('words.txt').then((r) => (r.ok ? r.text() : ''));
      const seen = new Set();
      const words = [];
      for (const line of text.split('\n')) {
        const w = line.trim().toUpperCase();
        if (!w || w.startsWith('#') || !/^[A-Z]+$/.test(w) || seen.has(w)) continue;
        seen.add(w);
        words.push(w);
      }
      return {
        total: words.length,
        medium: words.filter((w) => w.length >= 2 && w.length < HARD_MIN_LEN),
        hard: words.filter((w) => w.length >= HARD_MIN_LEN),
      };
    } catch (_) {
      return { total: 0, medium: [], hard: [] };
    }
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
    installBuzzTracker();
    buildGrid($('grid1'), 1);
    buildGrid($('grid2'), 2);

    // 1. Contract 3 — load curriculum, hand to engine (engine narrates on init).
    const content = await fetch('content.json').then((r) => r.json());
    log(`[content] loaded: ${Object.keys(content.letters).length} letters`);

    // 1b. Load the word list (words.txt) and bucket it by LENGTH:
    //     medium = 2..7 letters (the bulk) · hard = 8+ letters (noticeably longer).
    //     easy stays single random letters. Falls back to content.json words.
    const words = await loadWordBank();
    if (words.medium.length) content.words_medium = words.medium;
    if (words.hard.length) content.words_hard = words.hard;
    log(`[words] ${words.total} words — medium ${words.medium.length}, hard ${words.hard.length}`);

    // Feed the voice recognizer the authoritative command grammar from content.
    safe('Voice.setGrammar', () =>
      typeof Voice !== 'undefined' ? Voice.setGrammar(content.commands) : false);

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
      if (b) b.addEventListener('click', () => { exitPractice(); sendCommand(cmd); });
    }

    // Practice weak letters: toggle targeting on/off, then restart the CURRENT
    // mode so the biased (or normal) curriculum takes effect immediately.
    const practiceBtn = $('practice-btn');
    if (practiceBtn) practiceBtn.addEventListener('click', () => {
      unlockAudio();
      if (typeof GameState === 'undefined') return;
      const on = GameState.practiceLetters && GameState.practiceLetters.length;
      if (on) {
        GameState.setPracticeLetters(null);
        log('[coach] practice off — normal curriculum');
      } else {
        const weak = (typeof Analytics !== 'undefined') ? Analytics.weakLetters() : [];
        if (!weak.length) {
          log('[coach] no weak letters yet (need >2 misses on one letter)');
          safe('Speak', () => (typeof Speak !== 'undefined'
            ? Speak.say('No weak letters yet. Keep playing.') : false));
          render();
          return;
        }
        GameState.setPracticeLetters(weak);
        log(`[coach] practice on — targeting ${weak.join(', ')}`);
      }
      safe('Engine restart', () => (typeof Engine !== 'undefined' ? Engine.setMode(GameState.mode) : false));
      render();
    });
    const resetBtn = $('reset-stats-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (typeof Analytics !== 'undefined') Analytics.reset();
      exitPractice();
      log('[coach] miss stats reset');
      render();
    });

    render();
    setInterval(render, 250); // keep timers/scores fresh in race & rapid-fire
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
