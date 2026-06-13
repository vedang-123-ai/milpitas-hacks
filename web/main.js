/**
 * web/main.js — integration entry point (THIN wiring only, no game logic)
 * Owner: P4 (Integration)
 *
 * The single seam where the layers meet. Everything it touches is a frozen
 * contract or a global defined in another lane's file:
 *   - Engine.*  (P2, web/game/engine.js)    Contract: init/handleTouch/handleCommand
 *   - Voice.*   (P3, web/voice/recognition.js)
 *   - Speak.*   (P3, web/voice/speak.js)
 *   - MockSource / HubSource (P4, web/input/*) start(onMessage)
 *
 * Calls to other lanes are wrapped in safe() so that while P2/P3 are still
 * stubs, P4 can be tested in isolation — the routed messages still print to the
 * on-screen #log. Remove the noise but KEEP the wiring once the lanes land.
 */
(function () {
  const logEl = document.getElementById('log');
  function log(line) {
    console.log(line);
    if (logEl) logEl.textContent = (line + '\n' + logEl.textContent).slice(0, 4000);
  }

  // Call into another lane only if it has landed; otherwise log that it's pending.
  // Keeps the demo alive when a single lane isn't wired yet.
  function safe(label, fn) {
    try {
      if (fn() === false) log(`[pending] ${label} — global not defined yet`);
    } catch (err) {
      log(`[error] ${label}: ${err.message}`);
    }
  }

  async function boot() {
    // 1. Contract 3 — load curriculum and hand it to the game engine.
    const content = await fetch('content.json').then((r) => r.json());
    log(`[content] loaded: ${Object.keys(content.letters).length} letters`);
    safe('Engine.init', () => (typeof Engine !== 'undefined' ? Engine.init(content) : false));

    // 2. Pick the input source (mock keyboard vs real hub) — identical surface.
    const Source = CONFIG.MOCK ? window.MockSource : window.HubSource;
    log(`[input] ${CONFIG.MOCK ? 'MOCK (keyboard)' : 'HUB (' + CONFIG.HUB_URL + ')'}`);

    // 3. Contract 1 in -> route every touch to the engine (P2).
    Source.start((msg) => {
      log(`[touch] P${msg.player} dot ${msg.dot} ${msg.event}`);
      safe('Engine.handleTouch', () =>
        typeof Engine !== 'undefined'
          ? Engine.handleTouch(msg.player, msg.dot, msg.event)
          : false
      );
    });

    // 4. Voice commands (P3) -> engine command handling (P2).
    safe('Voice.onCommand', () =>
      typeof Voice !== 'undefined'
        ? Voice.onCommand((cmd) => {
            log(`[command] "${cmd}"`);
            safe('Engine.handleCommand', () =>
              typeof Engine !== 'undefined' ? Engine.handleCommand(cmd) : false
            );
          })
        : false
    );

    // 5. Narrate the menu so the screen is never needed (P3).
    safe('Speak.say(menu)', () =>
      typeof Speak !== 'undefined' ? Speak.say(content.prompts.menu) : false
    );
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
