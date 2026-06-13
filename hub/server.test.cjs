/**
 * hub/server.test.cjs — automated hub tests over REAL WebSockets (no hardware)
 *
 * Starts the real hub on an ephemeral port and verifies:
 *   1. Relay correctness — valid frames reach the consumer, the sender gets no
 *      echo, malformed/non-JSON frames are dropped, sloppy types are normalized.
 *   2. Browser receive path — the real web/input/hub-source.js (loaded in a tiny
 *      mocked browser, using the `ws` client as window.WebSocket) actually
 *      receives a frame the hub relays. This is the exact code path the browser
 *      runs, so it proves the link the firmware will plug into.
 *
 * Run:  node hub/server.test.cjs
 */
const assert = require('assert');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { createHub } = require('./server.js');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// open a ws client that records parsed frames; resolves when open
function client(url) {
  const ws = new WebSocket(url);
  const frames = [];
  ws.on('message', (d) => { try { frames.push(JSON.parse(d.toString())); } catch (_) {} });
  const open = new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  return { ws, frames, open };
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}

(async () => {
  const hub = await createHub({ port: 0, log: false });
  const URL = `ws://localhost:${hub.port}`;
  console.log(`hub up on ${URL}`);

  console.log('Relay correctness');

  await test('valid frame reaches consumer, normalized; sender gets no echo', async () => {
    const consumer = client(URL); const producer = client(URL);
    await Promise.all([consumer.open, producer.open]);
    producer.ws.send(JSON.stringify({ player: 1, dot: 4, event: 'down' }));
    await delay(60);
    assert.equal(consumer.frames.length, 1, 'consumer should receive 1 frame');
    assert.deepEqual(consumer.frames[0], { player: 1, dot: 4, event: 'down' });
    assert.equal(producer.frames.length, 0, 'sender must not receive its own frame');
    consumer.ws.close(); producer.ws.close();
  });

  await test('sloppy types normalized ("2"/"3"/"DOWN" -> 2/3/"down")', async () => {
    const consumer = client(URL); const producer = client(URL);
    await Promise.all([consumer.open, producer.open]);
    producer.ws.send(JSON.stringify({ player: '2', dot: '3', event: 'DOWN' }));
    await delay(60);
    assert.deepEqual(consumer.frames[0], { player: 2, dot: 3, event: 'down' });
    consumer.ws.close(); producer.ws.close();
  });

  await test('malformed + non-JSON frames are dropped (never relayed)', async () => {
    const consumer = client(URL); const producer = client(URL);
    await Promise.all([consumer.open, producer.open]);
    producer.ws.send('not json at all');
    producer.ws.send(JSON.stringify({ dot: 99 }));               // bad player+dot
    producer.ws.send(JSON.stringify({ player: 1, dot: 4, event: 'sideways' }));
    producer.ws.send(JSON.stringify({ player: 3, dot: 4, event: 'down' })); // bad player
    await delay(80);
    assert.equal(consumer.frames.length, 0, 'no invalid frame should pass');
    consumer.ws.close(); producer.ws.close();
  });

  await test('two consumers both receive a relayed frame', async () => {
    const a = client(URL); const b = client(URL); const producer = client(URL);
    await Promise.all([a.open, b.open, producer.open]);
    producer.ws.send(JSON.stringify({ player: 2, dot: 6, event: 'down' }));
    await delay(60);
    assert.equal(a.frames.length, 1);
    assert.equal(b.frames.length, 1);
    a.ws.close(); b.ws.close(); producer.ws.close();
  });

  console.log('Browser receive path (real web/input/hub-source.js vs live hub)');

  await test('hub-source.js delivers a hub-relayed frame to its onMessage', async () => {
    // tiny mocked browser; window === global, WebSocket = the ws client class
    const sandbox = {
      console, URLSearchParams, setTimeout, clearTimeout, WebSocket,
      location: { search: '' },
    };
    vm.createContext(sandbox);
    sandbox.window = sandbox;
    vm.runInContext(read('web/config.js'), sandbox, { filename: 'config.js' });
    sandbox.CONFIG.HUB_URL = URL; // point at the ephemeral test hub
    vm.runInContext(read('web/input/hub-source.js'), sandbox, { filename: 'hub-source.js' });

    const got = [];
    sandbox.HubSource.start((m) => got.push(m));
    await delay(120); // allow the WebSocket to connect

    const producer = client(URL);
    await producer.open;
    producer.ws.send(JSON.stringify({ player: 2, dot: 5, event: 'down' }));
    await delay(100);

    assert.equal(got.length, 1, 'hub-source should forward exactly one frame');
    assert.equal(got[0].player, 2);
    assert.equal(got[0].dot, 5);
    assert.equal(got[0].event, 'down');
    producer.ws.close();
  });

  await hub.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
