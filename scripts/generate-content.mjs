/**
 * scripts/generate-content.mjs — BUILD-TIME LLM curriculum generator
 * Owner: P4 (Content, AI & Integration)
 *
 * Uses an LLM to generate the practice words/sentences players are asked to trace
 * (and that can be shown on screen for sighted facilitators/judges), then writes
 * them into web/content.json. Run on a dev machine, commit the output.
 *
 * WHY build-time (not in the browser at runtime):
 *  - the running demo stays fully OFFLINE — no venue Wi-Fi, no latency, no flakiness
 *  - the API key never ships to the browser and never enters the repo
 *  - reliability over features (hackathon constraint)
 *
 * KEY HANDLING: read the API key from a local, git-ignored `.env` (e.g. via
 * process.env.OPENAI_API_KEY or ANTHROPIC_API_KEY). NEVER hardcode it. The user
 * must create their own `.env`; it is not tracked.
 *
 * Provider: OpenAI or Claude (Anthropic) — pick one in scripts/package.json deps.
 *
 * SCAFFOLD STUB — no implementation yet. TODO:
 *  - load .env; read the key (fail loudly if missing)
 *  - prompt the model for word/sentence sets at each difficulty tier
 *  - VALIDATE every generated word is representable by the available letters/dot-sets
 *    in content.json (drop anything the cells can't form)
 *  - merge into web/content.json (preserve the frozen Contract-3 shape) and write it
 *  - run: `node scripts/generate-content.mjs` (or `npm run generate` in scripts/)
 */
