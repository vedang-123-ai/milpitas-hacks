/**
 * hub/fake-esp32.cjs — a SOFTWARE stand-in for the real ESP32 board
 * Owner: P1 (Hardware / Transport)
 *
 * Connects to the hub like a real board and emits Contract-1 touch frames, so
 * the ENTIRE product (hub -> browser -> game -> sound) can be driven and demoed
 * with NO hardware. When the real ESP32 is wired in, it sends the exact same
 * frames and this script is simply not run — i.e. real sensor data is the only
 * thing this is substituting for.
 *
 * Usage:
 *   node hub/fake-esp32.cjs           # player 1, random touches
 *   node hub/fake-esp32.cjs 2         # player 2
 *   HUB_URL=ws://192.168.4.1:8080 node hub/fake-esp32.cjs   # custom hub
 */
const WebSocket = require('ws');

const URL = process.env.HUB_URL || 'ws://localhost:8080';
const PLAYER = Number(process.argv[2]) || 1;
const PERIOD_MS = 1200; // time between touches
const HOLD_MS = 250;    // finger-down duration

const ws = new WebSocket(URL);

ws.on('open', () => {
  console.log(`[fake-esp32] player ${PLAYER} connected to ${URL} — emitting touches (Ctrl-C to stop)`);
  tick();
});
ws.on('close', () => console.log('[fake-esp32] disconnected'));
ws.on('error', (e) => console.error('[fake-esp32] error:', e.message));

function send(dot, event) {
  const frame = { player: PLAYER, dot, event };
  ws.send(JSON.stringify(frame));
  console.log('  ->', JSON.stringify(frame));
}

function tick() {
  if (ws.readyState !== WebSocket.OPEN) return;
  const dot = 1 + Math.floor(Math.random() * 6); // pads 1..6
  send(dot, 'down');
  setTimeout(() => send(dot, 'up'), HOLD_MS);
  setTimeout(tick, PERIOD_MS);
}
