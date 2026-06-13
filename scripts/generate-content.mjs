/**
 * scripts/generate-content.mjs — BUILD-TIME LLM curriculum generator
 * Owner: P4 (Content, AI & Integration)
 *
 * Uses the OpenAI API to generate practice WORDS players are asked to trace, then
 * bakes the validated set into web/content.json. Run on a dev machine, commit output.
 *
 * WHY build-time (not in the browser): the running demo stays fully OFFLINE — no
 * venue Wi-Fi, no latency, no API key in the browser or repo. (Hackathon: reliability
 * over features.)
 *
 * KEY HANDLING: read from a local, git-ignored scripts/.env (see scripts/.env.example).
 * NEVER hardcoded, never committed.
 *
 * USAGE:
 *   cd scripts
 *   cp .env.example .env        # then paste your real OPENAI_API_KEY
 *   npm install
 *   npm run generate            # writes ../web/content.json
 *   npm run generate -- --dry-run   # preview only, write nothing
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH = resolve(__dirname, '../web/content.json');
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DRY_RUN = process.argv.includes('--dry-run');

// --- 1. Fail loudly if the key is missing -----------------------------------
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || apiKey.startsWith('sk-paste')) {
  console.error(
    '\n  ✖ No OPENAI_API_KEY found.\n' +
      '    1. cd scripts && cp .env.example .env\n' +
      '    2. paste your real key into scripts/.env\n' +
      '    3. npm run generate\n'
  );
  process.exit(1);
}

// --- 2. Load existing curriculum (Contract 3) -------------------------------
const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf8'));
const available = Object.keys(content.letters); // e.g. A,B,C,D,E,F,H,I,K,L,M
console.log(`Available letters the cells can form: ${available.join(', ')}`);

// --- 3. Ask the model for candidate words -----------------------------------
const openai = new OpenAI({ apiKey });

const prompt =
  `You generate practice words for a Braille-readiness game for blind children.\n` +
  `STRICT RULE: every word may ONLY use these letters: ${available.join(', ')}.\n` +
  `No other letters allowed. Words must be real, common, kid-friendly English words,\n` +
  `2 to 5 letters long. Favour short, concrete, easy words.\n` +
  `Return JSON exactly like: { "words": ["CAB", "BAD", ...] } with 20-30 words.`;

console.log(`Asking ${MODEL} for candidate words...`);
let resp;
try {
  resp = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });
} catch (err) {
  // Friendly guidance instead of a raw stack trace — common hackathon snags.
  if (err.status === 401) {
    console.error('\n  ✖ 401 Unauthorized — the key in scripts/.env is wrong or revoked.');
    console.error('    Re-copy it from https://platform.openai.com/api-keys (no spaces, one line).\n');
  } else if (err.status === 429) {
    console.error('\n  ✖ 429 Insufficient quota — the key is valid but the account has no credit.');
    console.error('    Add a payment method / balance: https://platform.openai.com/settings/organization/billing');
    console.error('    (content.json already has the seed words, so the demo still runs without this.)\n');
  } else {
    console.error(`\n  ✖ OpenAI request failed (${err.status || 'network'}): ${err.message}\n`);
  }
  process.exit(1);
}

let candidates = [];
try {
  candidates = JSON.parse(resp.choices[0].message.content).words || [];
} catch {
  console.error('✖ Model did not return valid JSON. Raw:', resp.choices[0].message.content);
  process.exit(1);
}
console.log(`Model proposed ${candidates.length} words.`);

// --- 4. VALIDATE: drop anything the cells cannot physically form -------------
// This guard is mandatory — never ship raw model output into a live demo.
const allowed = new Set(available);
const valid = [];
const rejected = [];
for (const raw of candidates) {
  const word = String(raw).toUpperCase().trim();
  if (word.length < 2) continue;
  const ok = [...word].every((ch) => allowed.has(ch));
  (ok ? valid : rejected).push(word);
}
// dedupe + keep prior hand-authored words (e.g. AB, CAB from the seed)
const merged = [...new Set([...(content.difficulty.hard.words || []), ...valid])];

console.log(`\n✓ ${valid.length} valid:   ${valid.join(', ') || '(none)'}`);
if (rejected.length) console.log(`✗ ${rejected.length} rejected (unformable): ${rejected.join(', ')}`);
console.log(`\nFinal hard-tier word bank (${merged.length}): ${merged.join(', ')}`);

// --- 5. Merge back, preserving the frozen Contract-3 shape ------------------
// We only ADD to difficulty.hard.words — no existing field changed or removed.
content.difficulty.hard.words = merged;

if (DRY_RUN) {
  console.log('\n--dry-run: content.json NOT written.');
} else {
  writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2) + '\n');
  console.log(`\nWrote ${CONTENT_PATH}`);
}
