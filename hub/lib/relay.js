/**
 * hub/lib/relay.js — fan-out validated Contract-1 frames to the other clients
 * Owner: P1
 *
 * Keeps socket bookkeeping out of server.js. Every connected socket (ESP32
 * producers + the browser consumer) is tracked; a frame from one is broadcast to
 * all the OTHERS. The browser acts on them; other ESP32s simply ignore what they
 * receive. No producer/consumer handshake needed — robust for a flaky demo.
 */
const OPEN = 1; // WebSocket.OPEN

class Relay {
  constructor() {
    this.clients = new Set();
  }

  add(ws) { this.clients.add(ws); }
  remove(ws) { this.clients.delete(ws); }
  get size() { return this.clients.size; }

  // Send `message` to every client except `from`. Returns how many got it.
  broadcast(from, message) {
    const data = JSON.stringify(message);
    let n = 0;
    for (const ws of this.clients) {
      if (ws === from) continue;
      if (ws.readyState === OPEN) { ws.send(data); n++; }
    }
    return n;
  }
}

module.exports = { Relay };
