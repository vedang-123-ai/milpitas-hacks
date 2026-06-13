/**
 * mocks/race.test.mjs — automated tests for the 1v1 RACE feature (web/game/*)
 *
 * Loads the REAL game-logic lane (state + modes + engine) into a mocked browser
 * with stubbed Contract-2 (Audio/Speak), a deterministic RNG, and SYNCHRONOUS
 * timers (so a whole race resolves in-line). Drives races exactly as the engine
 * would from voice/keyboard and asserts the structure the feature promises:
 *
 *   - voice "best of N" sets the race length (and clamps)
 *   - a race runs a FIXED number of questions, then declares Player 1 or Player 2
 *   - easy = letters, medium/hard = words spelled letter-by-letter
 *   - both players progress INDEPENDENTLY; first to finish the word takes the point
 *   - a tie after the set questions forces sudden-death until someone leads
 *
 * Run:  node mocks/race.test.mjs
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// deterministic RNG (steer which letter/word randItem picks: 0 => first item)
let RAND = 0;
const sandbox = {
  console,
  setTimeout: (fn) => { fn(); return 0; },  // synchronous: a race resolves in-line
  clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
  URLSearchParams, location: { search: '' },
  Math: Object.assign(Object.create(Math), { random: () => RAND }),
};
vm.createContext(sandbox);
sandbox.window = sandbox;

// Contract-2 stubs (we assert game STATE, not sound)
const spoken = [];
sandbox.Audio = { playDot() {}, win() {}, buzz() {} };
sandbox.Speak = { say: (t) => spoken.push(String(t)), cancel() {}, prime() {} };
sandbox.Voice = { onCommand() {}, setGrammar() {}, parse() { return null; }, _dispatch() {} };

for (const f of [
  'web/config.js', 'web/game/state.js',
  'web/game/modes/free-explore.js', 'web/game/modes/find-target.js',
  'web/game/modes/race.js', 'web/game/modes/rapid-fire.js', 'web/game/engine.js',
]) vm.runInContext(read(f), sandbox, { filename: f });

const { Engine, GameState } = sandbox;
const content = JSON.parse(read('web/content.json'));
content.words_medium = ['CAT'];           // deterministic banks (normally from words.txt)
content.words_hard = ['DOG'];
Engine.init(content);

const scores = () => [GameState.players[1].score, GameState.players[2].score];

// Trace a letter-sequence for `player` using the real held-set model: release
// held dots not in the next letter, press the ones that are. An exact match
// scores the letter and advances that player.
function spell(player, letters) {
  const held = new Set();
  for (const { dots } of letters) {
    for (const d of [...held]) if (!dots.includes(d)) { Engine.handleTouch(player, d, 'up'); held.delete(d); }
    for (const d of dots) if (!held.has(d)) { Engine.handleTouch(player, d, 'down'); held.add(d); }
  }
}
const winCurrent = (p) => spell(p, GameState.letters); // win whatever the current question is

let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.log(`  ✗ ${name}\n      ${e.message}`); }
};

console.log('Voice config — "best of N"');
test('"five words" / "seven words" set + override the race length', () => {
  Engine.handleCommand('five words');
  assert.equal(GameState.raceQuestionsOverride, 5);
  Engine.handleCommand('seven words');
  assert.equal(GameState.raceQuestionsOverride, 7);
});
test('count is clamped to content.race.maxQuestions', () => {
  GameState.setRaceQuestions(999);
  assert.equal(GameState.raceQuestionsOverride, content.race.maxQuestions);
  GameState.raceQuestionsOverride = null; // reset for default-length tests
});

console.log('Easy race (letters) — fixed length, declares a winner');
test('"two player" starts a race of the easy default length (5), Q1 loaded', () => {
  Engine.handleCommand('easy');
  Engine.handleCommand('two player');
  assert.equal(GameState.race.active, true);
  assert.equal(GameState.race.total, 5);
  assert.equal(GameState.race.asked, 1);
  assert.equal(GameState.currentType, 'letter');
});
test('points accrue per question and advance through exactly 5 questions', () => {
  winCurrent(1);                       // Q1 -> P1
  assert.deepEqual(scores(), [1, 0]);
  assert.equal(GameState.race.asked, 2);
  winCurrent(1); winCurrent(1);        // Q2,Q3 -> P1
  winCurrent(2);                       // Q4 -> P2
  assert.deepEqual(scores(), [3, 1]);
  assert.equal(GameState.race.asked, 5);
});
test('after the set questions the higher score wins (Player 1, 4-1)', () => {
  winCurrent(1);                       // Q5 -> P1, match ends
  assert.equal(GameState.race.over, true);
  assert.equal(GameState.race.winner, 1);
  assert.deepEqual(scores(), [4, 1]);
});
test('input is ignored once the match is over', () => {
  const before = scores().join();
  Engine.handleTouch(1, 1, 'down');
  Engine.handleTouch(2, 1, 'down');
  assert.equal(scores().join(), before);
});

console.log('Word race (hard) — independent spelling, first to finish wins');
test('hard race targets a WORD, both players start at letter 0', () => {
  RAND = 0;                            // words_hard[0] = DOG
  Engine.handleCommand('hard');
  Engine.handleCommand('two player');
  assert.equal(GameState.currentType, 'word');
  assert.equal(GameState.currentLabel, 'DOG');
  assert.equal(GameState.players[1].pos, 0);
  assert.equal(GameState.players[2].pos, 0);
});
test('a partial speller earns no point; the first to finish the word does', () => {
  const seq = GameState.wordToLetters('DOG');
  spell(2, seq.slice(0, 1));           // P2 traces only "D"
  assert.equal(GameState.players[2].pos, 1);
  assert.deepEqual(scores(), [0, 0]);
  spell(1, seq);                       // P1 spells D-O-G first
  assert.equal(scores()[0], 1);        // P1 takes the question
});

console.log('Tie -> sudden death always yields a winner');
test('a level score after the set questions plays sudden-death until someone leads', () => {
  GameState.raceQuestionsOverride = null;
  Engine.handleCommand('two words');   // best of 2 (engine parses typed counts too)
  Engine.handleCommand('easy');
  Engine.handleCommand('two player');
  assert.equal(GameState.race.total, 2);
  winCurrent(1);                       // 1-0
  winCurrent(2);                       // 1-1 -> tie -> sudden death question
  assert.ok(GameState.race.asked > GameState.race.total);
  assert.equal(GameState.race.over, false);
  assert.equal(GameState.race.sudden, true);
  winCurrent(2);                       // P2 wins the decider
  assert.equal(GameState.race.over, true);
  assert.equal(GameState.race.winner, 2);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
