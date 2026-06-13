/**
 * mocks/integration.test.mjs — END-TO-END mock-mode test of the whole app stack
 *
 * Loads the REAL files from every software lane into one mocked browser
 * (window === global, like a real browser) and wires them exactly as web/main.js
 * does, then drives real keyboard events through:
 *
 *   keyboard-emitter (P4) -> mock-source (P4) -> Engine (P2) -> modes + GameState (P2)
 *                                                         -> Audio/Speak/Voice (P3)
 *
 * This is the project's "vertical slice" acceptance, automated: pressing a key
 * routes a Contract-1 message that the game scores and narrates. No browser, no
 * hardware, no hub needed (mock mode).
 *
 * Run:  node mocks/integration.test.mjs
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const content = JSON.parse(read('web/content.json'));

// ---- mocked browser globals --------------------------------------------------
// DOM-ish event registry (honours { once: true } like a real target).
const listeners = {};
function addEventListener(type, fn, opts) {
  (listeners[type] ||= []).push({ fn, once: !!(opts && opts.once) });
}
function dispatch(type, ev) {
  const arr = listeners[type] || [];
  for (const l of [...arr]) {
    l.fn(ev);
    if (l.once) listeners[type] = listeners[type].filter((x) => x !== l);
  }
}
const key = (type, code, repeat = false) =>
  dispatch(type, { code, repeat, preventDefault() {} });

function MockAudioContext() {
  this.currentTime = 0; this.state = 'running'; this.destination = {};
  const gain = () => ({ gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} });
  this.createGain = gain;
  this.createOscillator = () => ({ type: 'sine', frequency: { value: 0 }, connect() { return this; }, start() {}, stop() {}, onended: null });
  this.createStereoPanner = () => ({ pan: { value: 0 }, connect() {}, disconnect() {} });
  this.resume = () => Promise.resolve();
}
const mockSynth = { getVoices: () => [], addEventListener: () => {}, cancel: () => {}, speak: (u) => { u.onstart && u.onstart(); u.onend && u.onend(); } };
function MockUtterance(text) { this.text = text; }
function MockSpeechRecognition() { this.start = () => {}; this.stop = () => {}; }

// sandbox IS the global, and window points at it (mirrors a real browser).
const sandbox = {
  console, setTimeout, clearTimeout, URLSearchParams,
  location: { search: '?mock=1' },
  document: { getElementById: () => null, addEventListener },
  addEventListener,
  AudioContext: MockAudioContext, webkitAudioContext: MockAudioContext,
  speechSynthesis: mockSynth, SpeechSynthesisUtterance: MockUtterance,
  SpeechRecognition: MockSpeechRecognition, webkitSpeechRecognition: MockSpeechRecognition,
};
vm.createContext(sandbox);
sandbox.window = sandbox; // window === globalThis

// ---- load every lane in web/index.html order (+ keyboard emitter) ------------
[
  'web/config.js',
  'web/audio/earcons.js', 'web/audio/audio.js',
  'web/voice/speak.js', 'web/voice/recognition.js', 'web/voice/wispr-hook.js',
  'web/game/state.js',
  'web/game/modes/free-explore.js', 'web/game/modes/find-target.js',
  'web/game/modes/race.js', 'web/game/modes/rapid-fire.js',
  'web/game/engine.js',
  'mocks/keyboard-emitter.js', 'web/input/mock-source.js',
].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));

const { Engine, GameState, Voice, MockSource, KeyboardEmitter, CONFIG } = sandbox;

// ---- spies on the sensory surface (game calls these) -------------------------
const spy = { playDot: 0, win: 0, buzz: 0, say: [] };
for (const m of ['playDot', 'win', 'buzz']) {
  const orig = sandbox.Audio[m];
  sandbox.Audio[m] = (...a) => { spy[m]++; return orig(...a); };
}
const origSay = sandbox.Speak.say;
sandbox.Speak.say = (t, ...r) => { spy.say.push(String(t)); return origSay(t, ...r); };
const resetSpy = () => { spy.playDot = 0; spy.win = 0; spy.buzz = 0; spy.say.length = 0; };

// ---- tiny runner -------------------------------------------------------------
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}

// =============================================================================
console.log('Config / mock toggle');
test('?mock=1 selects mock input; WIN_SCORE & RAPID_FIRE_SEC present', () => {
  assert.equal(CONFIG.MOCK, true);
  assert.equal(CONFIG.WIN_SCORE, 3);
  assert.ok(CONFIG.RAPID_FIRE_SEC > 0);
});

console.log('keyboard-emitter — Contract-1 mapping (1-6=P1, QWERTY=P2)');
test('keys map to the right player/dot; auto-repeat ignored; keyup=up', () => {
  const cap = [];
  KeyboardEmitter.start((m) => cap.push({ player: m.player, dot: m.dot, event: m.event }));
  key('keydown', 'Digit1');      // P1 dot1 down
  key('keydown', 'KeyT');        // P2 dot5 down
  key('keydown', 'Digit2', true);// auto-repeat -> ignored
  key('keyup', 'Digit1');        // P1 dot1 up
  assert.equal(cap.length, 3, 'auto-repeat keydown produced no message');
  assert.deepEqual(cap[0], { player: 1, dot: 1, event: 'down' });
  assert.deepEqual(cap[1], { player: 2, dot: 5, event: 'down' });
  assert.deepEqual(cap[2], { player: 1, dot: 1, event: 'up' });
});

// ---- wire the app exactly like web/main.js (steps 1,3,4) --------------------
Engine.init(content);
MockSource.start((msg) => Engine.handleTouch(msg.player, msg.dot, msg.event));
Voice.onCommand((cmd) => Engine.handleCommand(cmd));

console.log('Boot — find-target starts on letter A (easy)');
test('after init: find-target mode, single player, target A=[1]', () => {
  assert.equal(GameState.mode, 'find-target');
  assert.equal(GameState.currentLabel, 'A');
  assert.deepEqual(GameState.targetDots, [1]);
});

console.log('VERTICAL SLICE — keypress scores a correct touch + narrates');
test('press "1" -> dot 1 scores letter A, plays reward, says "correct", advances to B', () => {
  resetSpy();
  key('keydown', 'Digit1');
  assert.equal(GameState.players[1].score, 1, 'score should increment');
  assert.ok(spy.playDot >= 1, 'reward earcon played');
  assert.ok(spy.say.some((s) => /correct/i.test(s)), 'narrated "correct"');
  assert.equal(GameState.currentLabel, 'B');          // advanced
  assert.deepEqual(GameState.targetDots, [1, 2]);
});
test('keyup does not double-count (event "up" ignored)', () => {
  const before = GameState.players[1].score;
  key('keyup', 'Digit1');
  assert.equal(GameState.players[1].score, before);
});

console.log('Wrong + multi-dot letter handling');
test('wrong dot buzzes, no score, no advance', () => {
  resetSpy();
  key('keydown', 'Digit3');               // 3 is not in B=[1,2]
  assert.equal(spy.buzz, 1, 'gentle buzz on wrong dot');
  assert.equal(GameState.players[1].score, 1, 'no score');
  assert.equal(GameState.currentLabel, 'B', 'no advance');
});
test('completing 2-dot letter B (1 then 2) scores and advances to C=[1,4]', () => {
  resetSpy();
  key('keydown', 'Digit1');               // partial
  assert.equal(GameState.players[1].score, 1);
  key('keydown', 'Digit2');               // completes B
  assert.equal(GameState.players[1].score, 2);
  assert.equal(GameState.currentLabel, 'C');
  assert.deepEqual(GameState.targetDots, [1, 4]);
});

console.log('Voice command -> two-player race (headline mode)');
test('"two player" switches to race, resets scores, both cells live', () => {
  Voice._dispatch('two player');
  assert.equal(GameState.mode, 'race');
  assert.equal(GameState.activePlayers, 2);
  assert.equal(GameState.players[1].score, 0);
  assert.equal(GameState.players[2].score, 0);
});
test('Player 2 completes the target -> win sting + point', () => {
  resetSpy();
  const target = GameState.targetDots.slice();      // current race letter
  const P2KEY = { 1: 'KeyQ', 2: 'KeyW', 3: 'KeyE', 4: 'KeyR', 5: 'KeyT', 6: 'KeyY' };
  target.forEach((d) => key('keydown', P2KEY[d]));  // player 2 traces it
  assert.equal(GameState.players[2].score, 1, 'P2 earns the point');
  assert.equal(spy.win, 1, 'win sting played');
});

console.log('Difficulty command + input validation');
test('"hard" raises difficulty and re-prompts with a 3-dot letter', () => {
  Voice._dispatch('hard');
  assert.equal(GameState.difficulty, 'hard');
  assert.equal(GameState.targetDots.length, 3); // D/F/H/L/M are all 3-dot
});
test('Engine.handleTouch rejects out-of-range player/dot without throwing', () => {
  const snap = JSON.stringify(GameState.snapshot());
  Engine.handleTouch(3, 1, 'down');   // invalid player
  Engine.handleTouch(1, 9, 'down');   // invalid dot
  Engine.handleTouch(1, 1, 'sideways'); // invalid event
  assert.equal(JSON.stringify(GameState.snapshot()), snap, 'no state change on invalid input');
});

console.log('Curriculum integrity (Contract 3)');
test('every letter dot-set and every hard-tier word uses only formable letters', () => {
  for (const [ltr, dots] of Object.entries(content.letters)) {
    assert.ok(dots.every((d) => d >= 1 && d <= 6), `${ltr} has out-of-range dot`);
  }
  const formable = new Set(Object.keys(content.letters));
  for (const w of content.difficulty.hard.words) {
    assert.ok([...w].every((ch) => formable.has(ch)), `word "${w}" uses an unformable letter`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
