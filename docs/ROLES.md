# Roles, Lanes & Phases

The repo is partitioned so **each person owns whole folders/files — nobody edits the
same file as anyone else.** That's the merge-conflict strategy: ownership by directory,
communication by the three frozen contracts (see `CONTRACTS.md`). But ownership is only
*where* you work — below is *what* each person actually does and the context they need.

> **New to the project (human or AI)? Read in this order:** `docs/PROJECT_BRIEF.md` (the
> complete original spec) → this file → `docs/CONTRACTS.md`. (`CLAUDE.md` is auto-loaded by
> Claude Code but git-ignored, so it isn't shared on push.) Then open the stub at the top of
> your lane's folder — its header says exactly what to build and which contract to honor.

There are **four people**. One person takes **all** of the hardware (board + firmware + the
laptop hub); the other three are pure software.

| # | Role name | Teammate label | Owns |
|---|-----------|----------------|------|
| **P1** | **Hardware & Transport** | H | `firmware/**`, `hub/**` |
| **P2** | **Game Engine** | SW-A | `web/game/**` |
| **P3** | **Sensory (Audio + Voice)** | SW-B | `web/audio/**`, `web/voice/**` |
| **P4** | **Content, AI & Integration** | SW-C | `web/content.json`, `scripts/**`, `web/main.js`, `web/index.html`, `web/config.js`, `web/input/**` |

---

## What each person does

### P1 — Hardware & Transport (the only hardware person)
**One-liner:** turn touches on physical pads into clean `{player,dot,event}` messages the
browser can trust.

**What you actually build**
- The **physical cells:** two 3×2 pad grids, raised tactile border, a "top" notch so the
  board orients without sight, pads distinguished only by *position* (that's the skill).
  LEDs that mirror active pads so sighted judges see the invisible game; optional relay click.
- The **ESP32 firmware** (`firmware/`): boot calibration (read each pad's untouched baseline,
  trigger relative to it), debounce, and a WebSocket client that emits **Contract 1**. All
  pins/SSID/thresholds live in `firmware/config.h` — the only file you touch on-site.
- The **laptop hub** (`hub/`): one Node WebSocket server that accepts the ESP32(s), tags each
  event by player, relays Contract-1 to the browser, and serves the `web/` app.

**Decisions you own**
- Board option A (one ESP32-S3, 12 pads) vs B (two classic ESP32s, 6 each) — see `HARDWARE.md`.
- The hotspot (laptop Internet Sharing / phone / travel router). **Never venue Wi-Fi.**

**Context / gotchas**
- Capacitive baselines drift with humidity, hand size, and the table — **recalibrate on the
  actual demo table.** Hold ZERO game logic on the ESP32; the board never knows the rules.

**Done when:** `mocks/message-logger.html` shows correct Contract-1 frames as you touch pads.

### P2 — Game Engine
**One-liner:** all the rules — prompts, scoring, modes, difficulty — living only in the browser.

**What you actually build** (`web/game/`)
- `state.js` (mode, difficulty, current target dot-set, each player's touched-set, scores,
  timer) and `engine.js` (the façade `main.js` calls: `handleTouch`, `handleCommand`, `setMode`).
- The four modes in `modes/`: **find-target first** (the core loop), then race (1v1 headline),
  rapid-fire, free-explore. A "letter" is a dot-set from `content.json`; "tracing" = touching
  exactly that set.

**Context / gotchas**
- You call **Contract 2** (`Audio.*`, `Speak.say`, `Voice.onCommand`) and read **Contract 3**
  (`content.json`) — never reach inside either. Wrong touch in race = buzz + no score, but
  **do not end the turn.** Never hardcode letters/prompts; they come from content.

**Done when:** in `mocks/game-harness.html`, keyboard input drives a full find-target round
with stubbed (logged) audio/speech.

### P3 — Sensory (Audio + Voice)
**One-liner:** the entire interface a blind child experiences — spatial sound out, voice in.

**What you actually build**
- `web/audio/` — **Contract 2 `Audio.*`** with Web Audio: horizontal → stereo pan (left col
  1,2,3 left; right col 4,5,6 right), vertical → pitch (top 1,4 high · mid 2,5 · bottom 3,6
  low). Distinct earcons for explore / correct / win / **gentle** wrong-buzz (never harsh).
- `web/voice/` — **`Speak.say`** (SpeechSynthesis, narrates every menu/prompt/score) and
  **`Voice.onCommand`** (Web Speech `SpeechRecognition` matched to the `commands` grammar).
  The optional Wispr Flow dictation hook is last and must never be a demo dependency.

**Context / gotchas**
- **Headphones required** — pan/pitch are dead on laptop speakers. Web Speech recognition is
  the reliable path; build it before Wispr. AudioContext must resume on a user gesture.

**Done when:** `mocks/audio-test.html` buttons produce correct panned/pitched earcons and TTS.

### P4 — Content, AI & Integration
**One-liner:** the curriculum (including AI-generated practice text), the glue that wires the
three layers together, and the pitch.

**What you actually build**
- **Curriculum** (`web/content.json`, Contract 3): letters→dot-sets, difficulty tiers,
  prompts, and the voice `commands` grammar.
- **AI text generation** (`scripts/`): this is the role that uses the **LLM API key** to
  *generate the practice words/sentences players are asked to trace* (and that can be shown
  on screen for sighted facilitators/judges). **Generate at build time, not at runtime:** run
  `scripts/generate-content.mjs` on your machine, bake the output into `content.json`, and
  commit it. This keeps the demo **fully offline** (no venue Wi-Fi, no key in the browser, no
  key in the repo). The key lives in a local, git-ignored `.env` (see Guardrails).
- **Integration glue** (`web/main.js`, `web/index.html`, `web/config.js`, `web/input/`): the
  thin seam that picks the input source (mock vs hub), subscribes to Contract-1, and routes
  touches/commands into the engine and out to the sensory layer.
- **The pitch** (`docs/PITCH.md`) and owning the integration window.

**Context / gotchas**
- You're the only one editing the shared wiring files, on purpose — keep `main.js` thin.
- Validate AI-generated words against the available `letters`/dot-sets so the game can
  actually represent them; never ship raw model output unchecked into a live demo.

---

## Mock / test-harness ownership (confirmed)

**Each lane owns the harness it tests against** — *not* one person owning all of `mocks/`.
Deliberate: if the sensory dev had to edit a harness owned by the integration dev to tweak an
audio test, that re-introduces the exact cross-edit we're avoiding.

| Mock file | Owner | Purpose |
|-----------|-------|---------|
| `mocks/message-logger.html` | **P1** | log raw Contract-1 frames from the hub — proves the transport works |
| `mocks/game-harness.html` | **P2** | run the engine on keyboard input with stubbed sensory — fastest game-logic loop |
| `mocks/audio-test.html` | **P3** | buttons calling `Audio.*`/`Speak.*`/`Voice.*` directly — sensory without game/hardware |
| `mocks/keyboard-emitter.js` | **P4** | shared input emulator (keys → Contract-1); consumed by P2's harness and the real app's mock mode |

Only `keyboard-emitter.js` is shared, and it's frozen by Contract 1, so it rarely changes.

## How the layers connect (no shared code)

```
firmware ──Contract 1──> hub ──Contract 1──> input/ ──> game/ ──Contract 2──> audio/ + voice/
                                                          └── reads Contract 3 (content.json)
scripts/ (P4, build-time LLM) ──writes──> content.json
```

Each arrow is a frozen contract. Honor the contract and you can build your lane in isolation
against a mock; it drops into the real app unchanged.

## Phases (8-hour budget)

### Phase 0 — Kickoff (~30 min, everyone)
- Pick the **board option** (A: one ESP32-S3 / B: two classic ESP32s) — see `HARDWARE.md`.
- **Freeze the three contracts** (`CONTRACTS.md`). After this, contracts are append-only.
- Assign the four people to P1–P4. Bring up the laptop hotspot. Decide the LLM provider/key (P4).

### Phase 1 — Parallel build against mocks (the long stretch, all 4 at once)
- **P1:** boot-calibration + debounce on the ESP32; hub relays Contract-1; verify with `message-logger.html`.
- **P2:** build **find-target (Mode 2) first** in `web/game/`; drive it from `game-harness.html`. Then race / rapid-fire / free-explore.
- **P3:** implement `Audio.*` (pan+pitch) and `Speak.say` fully; `Voice.onCommand` via Web Speech; verify on `audio-test.html`. Wispr hook last.
- **P4:** finalize the seed `content.json`; run the LLM generator to expand the word/sentence bank and bake it in; build the input abstraction + mock toggle; write the pitch.

### Phase 2 — Integration window (P4 leads, others support)
- In `main.js`, swap the mock input source for `hub-source` and the stubbed sensory for the real `Audio/Speak/Voice`. Same contract surfaces → drop-in.
- **Acceptance (vertical slice):** with `?mock=1`, pressing key `4` → Contract-1 msg → find-target scores it → high-pitched right-panned earcon → "correct." Then repeat on real hardware over the hotspot.

### Phase 3 — Polish & demo prep (all)
- Tactile board: raised borders, "top" notch, distinct-position pads, LED mirroring for sighted judges.
- **Re-calibrate capacitive baselines on the actual demo table.**
- Rehearse the blindfolded judge demo. Reliability > features.

## Full file inventory (every file, who owns it)

```
docs/PROJECT_BRIEF.md            (P4) complete original spec — full project context
docs/CONTRACTS.md                (P4) the three frozen interfaces + Braille numbering
docs/ROLES.md                    (P4) this file — roles, ownership, phases, inventory
docs/HARDWARE.md                 (P1) board options, pad layout, calibration
docs/PITCH.md                    (P4) demo script
CLAUDE.md                        (P4) AI-facing architecture summary (auto-loaded, git-ignored)
README.md                        (P4) human entry point / run instructions

firmware/dotrace_firmware.ino    (P1) ESP32 touch sensing + WS client + LED/relay
firmware/config.h                (P1) on-site config: pins, SSID, thresholds, PLAYER id

hub/server.js                    (P1) Node WS relay + static server for /web
hub/lib/player-tagger.js         (P1) assign/normalize player id per connection
hub/lib/relay.js                 (P1) validate + fan-out Contract-1 to the browser
hub/package.json                 (P1) hub deps (ws)

scripts/generate-content.mjs     (P4) build-time LLM generator → writes content.json
scripts/package.json             (P4) generator deps + npm script (provider SDK)

web/index.html                   (P4) app shell + script load order
web/config.js                    (P4) runtime knobs: HUB_URL, MOCK flag, scores, timers
web/main.js                      (P4) thin integration entry (input → game → sensory)
web/content.json                 (P4) Contract 3 curriculum (seed + AI-expanded)
web/input/hub-source.js          (P4) real input: WebSocket → Contract-1
web/input/mock-source.js         (P4) mock input: wraps keyboard-emitter
web/game/state.js                (P2) browser-only game state model
web/game/engine.js               (P2) mode dispatcher + public game API
web/game/modes/free-explore.js   (P2) Mode 1
web/game/modes/find-target.js    (P2) Mode 2 — core loop, build first
web/game/modes/race.js           (P2) Mode 3 — 1v1 headline
web/game/modes/rapid-fire.js     (P2) Mode 4 — timed
web/audio/audio.js               (P3) Contract 2 `Audio.*` (Web Audio pan+pitch)
web/audio/earcons.js             (P3) tone/earcon parameter tables
web/voice/speak.js               (P3) Contract 2 `Speak.say` (SpeechSynthesis)
web/voice/recognition.js         (P3) Contract 2 `Voice.onCommand` (SpeechRecognition)
web/voice/wispr-hook.js          (P3) optional Wispr Flow dictation input

mocks/keyboard-emitter.js        (P4) keys → Contract-1 emulator
mocks/message-logger.html        (P1) hub transport test target
mocks/game-harness.html          (P2) game-logic test target
mocks/audio-test.html            (P3) sensory test target
```

## Guardrails
- Never edit another lane's folder; request a contract change instead (append-only).
- Never put game rules in firmware/hub or sensory files — rules live only in `web/game/`.
- The demo must not depend on venue Wi-Fi or Wispr Flow. Web Speech + laptop hotspot are the reliable paths.
- **API keys live in a local `.env` only** (git-ignored, never committed, never in the
  browser). LLM generation is **build-time** → output committed to `content.json`, so the
  running demo needs no key and no internet. (P4 must create their own `.env`; it is not
  tracked.)
