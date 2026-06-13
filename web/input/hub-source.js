/**
 * web/input/hub-source.js — real input: WebSocket to the Node hub
 * Owner: P4 (Integration), shape agreed with P1.
 *
 * Connects to CONFIG.HUB_URL and forwards each Contract-1 message to a handler.
 * Mirrors mock-source.js exactly — start(onMessage) — so main.js swaps them with
 * no other changes. Auto-reconnects so a flaky board doesn't kill the demo.
 *
 * >>> CROSS-LANE SEAM (P1 <-> P4) <<<
 * The hub (hub/server.js, owned by P1) is expected to push raw Contract-1 JSON
 * frames: { "player": 1, "dot": 4, "event": "down" }. If P1 wraps frames in an
 * envelope, that gets unwrapped HERE — nothing downstream changes.
 */
(function () {
  function start(onMessage, onStatus) {
    let ws;
    let retryMs = 500; // backoff, capped below
    const status = (s) => { try { onStatus && onStatus(s); } catch (_) {} };

    function connect() {
      console.info('[hub-source] connecting to', CONFIG.HUB_URL);
      status('connecting');
      ws = new WebSocket(CONFIG.HUB_URL);

      ws.addEventListener('open', () => {
        retryMs = 500; // reset backoff on a good connection
        console.info('[hub-source] connected');
        status('connected');
      });

      ws.addEventListener('message', (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch (err) {
          console.warn('[hub-source] dropping non-JSON frame:', ev.data);
          return;
        }
        // Contract-1 sanity check before handing upstream.
        if (typeof msg.player !== 'number' || typeof msg.dot !== 'number' || !msg.event) {
          console.warn('[hub-source] dropping malformed Contract-1 frame:', msg);
          return;
        }
        onMessage(msg);
      });

      ws.addEventListener('close', () => {
        console.warn(`[hub-source] disconnected — retrying in ${retryMs}ms`);
        status('disconnected');
        setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 5000); // exponential backoff, cap 5s
      });

      ws.addEventListener('error', () => ws.close()); // close -> triggers retry
    }

    connect();
  }

  window.HubSource = { start };
})();
