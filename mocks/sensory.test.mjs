/**
 * mocks/sensory.test.mjs — unit tests for the Sensory layer (P3)
 * Owner: P3 (Sensory Layer)
 *
 * Runs the real web/audio + web/voice modules in a mocked browser (node:vm) so
 * the contract-critical LOGIC is verified without a browser:
 *   - sonification mapping: dot -> pan (column) / pitch (row) / timbre (player)
 *   - win/buzz earcon shapes
 *   - Voice.parse grammar matching + setGrammar
 *   - Voice.onCommand / _dispatch fan-out
 *   - Speak.say echo-guard toggles Voice.suppress(true) then (false)
 *
 * Run:  node mocks/sensory.test.mjs
 * NOTE: audible behavior (actual pan/pitch, mic, TTS voice) still needs a manual
 * Chrome + headphones pass via mocks/audio-test.html.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// --- record of Web Audio nodes created, so we can assert freq/pan/type --------
const REC = { osc: [], panner: [] };
const resetRec = () => { REC.osc.length = 0; REC.panner.length = 0; };

function MockAudioContext() {
  this.currentTime = 0;
  this.state = 'running';
  this.destination = { _name: 'destination' };
  this.createGain = () => ({
    gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect() {}, disconnect() {},
  });
  this.createOscillator = () => {
    const node = {
      type: 'sine', frequency: { value: 0 },
      connect() { return this; }, start() {}, stop() {}, onended: null,
    };
    REC.osc.push(node);
    return node;
  };
  this.createStereoPanner = () => {
    const node = { pan: { value: 0 }, connect() {}, disconnect() {} };
    REC.panner.push(node);
    return node;
  };
  this.resume = () => Promise.resolve();
}

// --- mock browser globals -----------------------------------------------------
const spokenUtterances = [];
const mockSynth = {
  getVoices: () => [],
  addEventListener: () => {},
  cancel: () => {},
  speak: (u) => { spokenUtterances.push(u); if (u.onstart) u.onstart(); if (u.onend) u.onend(); },
};
function MockUtterance(text) { this.text = text; this.onstart = null; this.onend = null; this.onerror = null; }
function MockSpeechRecognition() { this.start = () => {}; this.stop = () => {}; }

const win = {
  addEventListener: () => {},
  AudioContext: MockAudioContext,
  webkitAudioContext: undefined,
  speechSynthesis: mockSynth,
  SpeechRecognition: MockSpeechRecognition,
};
const sandbox = {
  window: win,
  document: { getElementById: () => null, addEventListener: () => {} },
  AudioContext: MockAudioContext,
  SpeechSynthesisUtterance: MockUtterance,
  console,
  setTimeout, clearTimeout,
};
vm.createContext(sandbox);

// --- load the real modules in browser load order ------------------------------
for (const f of [
  'web/audio/earcons.js',
  'web/audio/audio.js',
  'web/voice/speak.js',
  'web/voice/recognition.js',
  'web/voice/wispr-hook.js',
]) {
  vm.runInContext(read(f), sandbox, { filename: f });
}
const { Audio, Speak, Voice, EARCONS } = win;

// --- tiny test runner ---------------------------------------------------------
let passed = 0, failed = 0;
const close = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}

console.log('EARCONS data (matches Contract sonification map)');
test('dots 1,2,3 are left column; 4,5,6 right', () => {
  [1, 2, 3].forEach((d) => assert.equal(EARCONS.DOT_MAP[d].col, 'left'));
  [4, 5, 6].forEach((d) => assert.equal(EARCONS.DOT_MAP[d].col, 'right'));
});
test('rows: 1,4 top · 2,5 mid · 3,6 bottom', () => {
  assert.equal(EARCONS.DOT_MAP[1].row, 'top');
  assert.equal(EARCONS.DOT_MAP[4].row, 'top');
  assert.equal(EARCONS.DOT_MAP[2].row, 'mid');
  assert.equal(EARCONS.DOT_MAP[5].row, 'mid');
  assert.equal(EARCONS.DOT_MAP[3].row, 'bottom');
  assert.equal(EARCONS.DOT_MAP[6].row, 'bottom');
});
test('pitch high>mid>low and pan left<0<right', () => {
  assert.ok(EARCONS.ROW_PITCH.top > EARCONS.ROW_PITCH.mid);
  assert.ok(EARCONS.ROW_PITCH.mid > EARCONS.ROW_PITCH.bottom);
  assert.ok(EARCONS.COL_PAN.left < 0 && EARCONS.COL_PAN.right > 0);
});

console.log('Audio.playDot — pan(column) + pitch(row) + timbre(player)');
test('playDot(1,1): high pitch, panned left, sine (player 1)', () => {
  resetRec(); Audio.playDot(1, 1, false);
  assert.equal(REC.osc.length, 1);
  assert.ok(close(REC.osc[0].frequency.value, EARCONS.ROW_PITCH.top));
  assert.equal(REC.osc[0].type, 'sine');
  assert.ok(close(REC.panner[0].pan.value, EARCONS.COL_PAN.left, 0.01));
});
test('playDot(2,6): low pitch, panned right, triangle (player 2)', () => {
  resetRec(); Audio.playDot(2, 6, false);
  assert.equal(REC.osc.length, 1);
  assert.ok(close(REC.osc[0].frequency.value, EARCONS.ROW_PITCH.bottom));
  assert.equal(REC.osc[0].type, 'triangle');
  assert.ok(close(REC.panner[0].pan.value, EARCONS.COL_PAN.right, 0.01));
});
test('playDot(.,2,.): middle row -> mid pitch', () => {
  resetRec(); Audio.playDot(1, 2, false);
  assert.ok(close(REC.osc[0].frequency.value, EARCONS.ROW_PITCH.mid));
});
test('playDot(...,isCorrect=true) layers reward chirp (3 tones, all left)', () => {
  resetRec(); Audio.playDot(1, 1, true);
  assert.equal(REC.osc.length, 1 + EARCONS.correct.chirpSemis.length);
  assert.ok(REC.panner.every((p) => close(p.pan.value, EARCONS.COL_PAN.left, 0.01)));
  // chirp notes are higher than the base position tone
  assert.ok(REC.osc[1].frequency.value > REC.osc[0].frequency.value);
});
test('playDot ignores invalid dot (no sound)', () => {
  resetRec(); Audio.playDot(1, 9, false);
  assert.equal(REC.osc.length, 0);
});

console.log('Audio.win / Audio.buzz');
test('win(1): 4-note arpeggio panned left', () => {
  resetRec(); Audio.win(1);
  assert.equal(REC.osc.length, EARCONS.win.arpeggioSemis.length);
  assert.ok(REC.panner.every((p) => close(p.pan.value, EARCONS.PLAYER_PAN[1], 0.01)));
  assert.ok(close(REC.osc[0].frequency.value, EARCONS.win.baseHz));
});
test('win(2): panned right', () => {
  resetRec(); Audio.win(2);
  assert.ok(REC.panner.every((p) => close(p.pan.value, EARCONS.PLAYER_PAN[2], 0.01)));
});
test('buzz(1): single gentle low tone, triangle, panned left', () => {
  resetRec(); Audio.buzz(1);
  assert.equal(REC.osc.length, 1);
  assert.ok(close(REC.osc[0].frequency.value, EARCONS.buzz.freqHz));
  assert.equal(REC.osc[0].type, EARCONS.buzz.wave);
  assert.ok(close(REC.panner[0].pan.value, EARCONS.PLAYER_PAN[1], 0.01));
});

console.log('Voice.parse — grammar matching');
test('exact command', () => assert.equal(Voice.parse('two player'), 'two player'));
test('embedded in a phrase', () => assert.equal(Voice.parse("let's go two player please"), 'two player'));
test('despaced ("rapidfire" -> "rapid fire")', () => assert.equal(Voice.parse('rapidfire'), 'rapid fire'));
test('token overlap ("make it hard" -> "hard")', () => assert.equal(Voice.parse('make it hard'), 'hard'));
test('case/punctuation insensitive', () => assert.equal(Voice.parse('  EASY! '), 'easy'));
test('no match -> null', () => assert.equal(Voice.parse('banana'), null));
test('empty -> null', () => assert.equal(Voice.parse(''), null));

console.log('Voice.onCommand / _dispatch / setGrammar');
test('onCommand callbacks fire on dispatch', () => {
  const got = [];
  Voice.onCommand((c) => got.push(c));
  Voice._dispatch('start');
  assert.deepEqual(got, ['start']);
});
test('setGrammar replaces the grammar', () => {
  Voice.setGrammar(['foo bar']);
  assert.equal(Voice.parse('foo bar'), 'foo bar');
  assert.equal(Voice.parse('start'), null);
  Voice.setGrammar(['one player', 'two player', 'easy', 'medium', 'hard', 'rapid fire', 'start', 'repeat', 'quit']);
});

console.log('Speak.say — echo guard toggles Voice.suppress');
test('say() suppresses recognizer during speech, releases after', () => {
  const calls = [];
  const real = Voice.suppress;
  Voice.suppress = (v) => { calls.push(v); real(v); };
  spokenUtterances.length = 0;
  Speak.say('Touch the letter C');
  Voice.suppress = real;
  assert.equal(spokenUtterances.length, 1);
  assert.equal(spokenUtterances[0].text, 'Touch the letter C');
  assert.deepEqual(calls, [true, false]); // suppressed while speaking, then released
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
