/**
 * hub/server.js — Node WebSocket hub + static web server
 * Owner: P1 (Hardware / Firmware / Transport)
 *
 * The single point that decouples one-board vs two-board hardware from the app:
 *  - Serves the repo statically so the browser loads the app from localhost
 *    (a secure context, which the mic / SpeechRecognition require):
 *        http://localhost:8080/web/index.html      (the game)
 *        http://localhost:8080/mocks/message-logger.html  (transport viewer)
 *  - Runs ONE WebSocket server (same port) accepting ESP32 producer(s) AND the
 *    browser consumer; relays validated Contract-1 frames between them.
 *  - Holds ZERO game logic.
 *
 * Run:   node hub/server.js        (or: npm start, from hub/)
 * Test:  node hub/server.test.cjs
 * Sim:   node hub/fake-esp32.cjs   (a hardware stand-in)
 *
 * Exposes createHub() so tests can start/stop it on an ephemeral port.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { tag } = require('./lib/player-tagger');
const { Relay } = require('./lib/relay');

const ROOT = path.resolve(__dirname, '..'); // repo root; serves /web and /mocks
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.map': 'application/json',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/web/index.html'; // convenience landing
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

// Start the hub. Returns a Promise of a handle: { port, relay, close() }.
function createHub({ port = 8080, log = true } = {}) {
  const lg = (...a) => { if (log) console.log('[hub]', ...a); };
  const server = http.createServer(serveStatic);
  const wss = new WebSocketServer({ server });
  const relay = new Relay();

  wss.on('connection', (ws, req) => {
    relay.add(ws);
    lg(`+ client (${relay.size} total) ${req.socket.remoteAddress || ''}`);

    ws.on('message', (data) => {
      let raw;
      try { raw = JSON.parse(data.toString()); }
      catch { return lg('drop: non-JSON frame'); }

      const msg = tag(raw);
      if (!msg) return lg('drop: invalid Contract-1 frame', raw);

      const n = relay.broadcast(ws, msg);
      lg(`relay P${msg.player} dot ${msg.dot} ${msg.event} -> ${n} client(s)`);
    });

    ws.on('close', () => { relay.remove(ws); lg(`- client (${relay.size} total)`); });
    ws.on('error', () => { /* a flaky board must never crash the hub */ });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      const actual = server.address().port;
      lg(`serving  http://localhost:${actual}/web/index.html`);
      lg(`socket   ws://localhost:${actual}  (ESP32 -> ws://<laptop-ip>:${actual})`);
      resolve({
        port: actual,
        relay,
        close: () => new Promise((r) => {
          // Force sockets shut so close() always resolves promptly (a lingering
          // auto-reconnecting client must not hang shutdown).
          for (const c of wss.clients) { try { c.terminate(); } catch (_) {} }
          wss.close(() => server.close(() => r()));
        }),
      });
    });
  });
}

if (require.main === module) {
  createHub({ port: process.env.HUB_PORT || 8080 });
}

module.exports = { createHub, serveStatic };
