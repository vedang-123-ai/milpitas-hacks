# DotRace — Project Brief (complete spec)

> This is the full original project brief — the single source of complete context for
> the whole project. Any teammate (or their AI assistant) should read this to understand
> the *why* behind every part of the repo. The scaffold described in §9 has already been
> built; see `docs/ROLES.md` for current ownership and `docs/CONTRACTS.md` for the frozen
> interfaces.

---

## 0. What we are building (one paragraph)

DotRace is a two-player, audio-first **Braille-readiness learning game for blind early
learners**, built for an 8-hour hackathon by a 4-person team. Two physical 3×2
capacitive-touch cells (the Braille cell layout) let kids feel for positions and "trace"
letters by touch. The entire UI is voice — text-to-speech narration out, voice commands in
— because the users can't see the screen. Correct touches are rewarded with **spatialized
audio** (a bird chirps from the correct side of the headphones). Kids can play solo or
**race 1v1** to trace letters fastest. The pedagogy: spatial awareness (top/bottom,
left/right, the cell coordinate system) is the foundation literacy sits on, taught years
before formal Braille.

The hardware is the differentiator — almost every other hackathon team ships a pure
web/mobile app. A working physical device that a judge can touch (blindfolded) is the demo
edge.

---

## 1. Hardware

Available parts: ESP32, resistors, LEDs, breadboard, relays, jumper wires. Headphones
(bring over-ear).

**Touch pads:** 6 per cell, arranged in the Braille 3×2 grid. Two cells = **12
capacitive-touch inputs total.** Pads are identical in texture, different only in position
(screw heads / copper-tape squares / dome bolts), because *location discrimination is the
skill*. Each cell gets a **raised tactile border** to anchor the hand and a **notch/bump
marking "top"** so the board self-orients without sight.

**Braille dot numbering (memorize — used everywhere):**
```
1 ● ● 4
2 ● ● 5
3 ● ● 6
```
Left column = dots 1,2,3. Right column = dots 4,5,6. Top row = 1,4. Middle row = 2,5.
Bottom row = 3,6.

**Board fork (the team picks ONE at kickoff; the software supports both identically because
of the hub architecture in §2):**
- **Option A — one ESP32-S3** (14 capacitive-touch channels): all 12 pads on one board.
  Preferred if available.
- **Option B — two classic ESP32s** (10 touch channels each): one board per player, 6 pads
  each. Better physical separation for the 1v1; software treats them as two clients.
- Do NOT try to fit 12 pads on a single classic ESP32 — it has only 10 touch channels.

**Critical firmware reality — boot calibration:** capacitive baselines drift with humidity,
hand size, and the table surface. On boot, read each pad's untouched baseline and trigger
relative to it. Re-calibrate on the actual demo table.

**LEDs:** mirror the touched/active pads so *sighted judges can see the invisible game*.
**Relay (optional):** a satisfying physical click on a scored point.

---

## 2. Architecture — "dumb pads, smart browser," with a laptop hub

```
[ESP32 #1] --WiFi/WS--\
                        >--> [Node hub on laptop] --WS--> [Browser web app]
[ESP32 #2] --WiFi/WS--/        (merges + tags players,        (game logic, audio,
                                serves static web app)          TTS, voice input)
```

- **ESP32(s):** pure sensors. Read capacitive touch, drive LEDs/relay, send touch events
  over WebSocket. Hold ZERO game logic. Connect as WiFi **stations** to a laptop-hosted
  hotspot (laptop's Internet Sharing, a phone hotspot, or a cheap travel router — **never
  the venue Wi-Fi**, that's where demos die).
- **Node hub (laptop):** one WebSocket server. Accepts connections from one or both ESP32s,
  tags events by player, relays them to the browser, and serves the static web app. This
  single hub is why one-board and two-board setups need no code branching.
- **Browser (laptop/tablet):** all game logic, Web Audio sonification, SpeechSynthesis TTS,
  and voice input. Connects to the hub via WebSocket.

This separation means each layer is testable in isolation against a mock (see §5 workflow).

---

## 3. The THREE FROZEN CONTRACTS (do not change after kickoff)

Everything parallelizes because these interfaces are locked. If a change is truly needed,
**add fields, don't change existing ones.**

### Contract 1 — Touch message (Hardware/Hub → Game)
JSON over WebSocket:
```json
{ "player": 1, "dot": 4, "event": "down" }
```
- `player`: 1 or 2
- `dot`: 1–6 (Braille numbering above)
- `event`: "down" | "up"

### Contract 2 — Sensory API (Game → Audio/Voice layer)
The game calls these and never reaches inside the implementation:
```js
Audio.playDot(player, dot, isCorrect) // pan (L/R column) + pitch (row) earcon
Audio.win(player)                     // triumphant panned sting on that player's side
Audio.buzz(player)                    // gentle, non-punishing wrong-answer tone
Speak.say(text)                       // SpeechSynthesis TTS narration
Voice.onCommand(callback)             // fires callback("two player"), callback("hard"), ...
```

### Contract 3 — Content file (Curriculum → Game)
A single imported `content.json`:
```json
{
  "letters": {
    "A": [1], "B": [1,2], "C": [1,4], "E": [1,5], "I": [2,4], "K": [1,3],
    "D": [1,4,5], "F": [1,2,4], "H": [1,2,5], "L": [1,2,3], "M": [1,3,4]
  },
  "difficulty": {
    "easy":   { "positions": true, "letters": ["A"] },
    "medium": { "positions": false, "letters": ["B","C","E","I","K"] },
    "hard":   { "positions": false, "letters": ["D","F","H","L","M"], "words": ["AB","CAB"] }
  },
  "prompts": {
    "find_dot_1": "Can you find the top left?",
    "find_dot_4": "Can you find the top right?",
    "find_dot_3": "Can you find the bottom left?",
    "find_dot_6": "Can you find the bottom right?",
    "trace_letter": "Touch the letter {LETTER}.",
    "win": "Player {PLAYER} wins the point. The score is {S1} to {S2}.",
    "menu": "Main menu. Say one player, or two player. Say difficulty to change level."
  },
  "commands": ["one player","two player","easy","medium","hard","rapid fire","start","repeat","quit"]
}
```

---

## 4. Audio / sonification design (for `audio.js`)

- **Horizontal axis → stereo pan** (`StereoPannerNode`): left column (1,2,3) pans left,
  right column (4,5,6) pans right.
- **Vertical axis → pitch:** top row (1,4) = high tone, middle (2,5) = mid, bottom (3,6) =
  low. (Panning physically cannot place a sound "above," so elevation is encoded as pitch —
  this is deliberate, established cross-modal mapping, not a workaround.)
- Distinct earcons for: free-explore touch, correct, win, wrong (gentle buzz — never harsh;
  young blind kids disengage from aversive feedback).
- Requires headphones; dead on laptop speakers.

---

## 5. Voice layer (for `voice.js`)

- **Voice OUT (the UI):** browser `SpeechSynthesis`. Free, offline, zero setup. Every
  screen/menu/prompt/score is narrated so the screen is never needed.
- **Voice IN (commands):** build **Web Speech API `SpeechRecognition` FIRST** — free, no
  account, no network dependency — wired to a small command grammar (the `commands` array in
  content.json). Then add an optional **Wispr Flow** hook as a "premium" input: Wispr Flow
  is a system-level dictation app that types into the focused field (cloud-only, needs
  internet), so expose a single always-focused text input the user can dictate into, and
  parse the injected text with the same grammar. **The demo must not depend on Wispr Flow or
  venue Wi-Fi** — Web Speech is the reliable path.

---

## 6. Game modes (for `game.js`)

A letter = a fixed dot-set (from content.json). "Tracing a letter" = touching exactly that
set.

1. **Free explore** — touch any dot, hear its position earcon. No wrong answers. Builds the
   mental map.
2. **Find-target (core loop)** — TTS prompts a position or letter; correct touch → reward
   earcon. *Build this first.*
3. **1v1 Race (headline mode)** — one prompt to both players; both cells live; a player
   scores when they've touched the *complete correct dot-set*; wrong dot → buzz + no score
   (do NOT end their turn); first to complete wins the point + panned win sting; TTS
   announces score; first to N wins.
4. **Rapid fire** — stream of prompts, 30/60s window, count correct; solo (beat best) or 1v1
   (most correct).
5. **Difficulty tiers** (voice-selectable): easy = positions + 1-dot (A); medium = 2-dot
   letters; hard = 3-dot letters + short words.

**Game state to track (browser only):** mode, difficulty, current prompt + target dot-set,
each player's touched-set this turn, scores, timer. The ESP32 never knows the rules.

---

## 7. Repo structure (as scaffolded)

> The brief's original flat layout was expanded into folders (one owner per folder) to
> further reduce merge conflicts. See `docs/ROLES.md` → "Full file inventory" for the
> as-built tree. Mapping of brief files → as-built:
> `web/game.js` → `web/game/` (state, engine, modes/*) ·
> `web/audio.js` → `web/audio/` · `web/voice.js` → `web/voice/` ·
> the mock toggle lives in `web/input/` + `web/config.js`.

```
firmware/   ESP32: touch calibration + debounce + WS client + LED/relay
hub/        Node WS hub: accepts ESP32(s), tags players, relays to browser, serves /web
web/        game logic, audio, voice, content, integration
mocks/      keyboard emitter + per-lane test harnesses
docs/       this brief, contracts, roles/phases, hardware, pitch
```

**Tech stack (build-step-free for hackathon speed):**
- Firmware: **Arduino framework** (`.ino`), library `arduinoWebSockets` (links2004) for the
  WS client, `touchRead()` for capacitive sensing.
- Hub: **Node.js**, `ws` package for WebSocket, plain `http`/`express` to serve `/web`.
- Web: **vanilla HTML/CSS/JS**, no bundler, no framework. Web Audio API, Web Speech API.

**Mock toggle:** a flag or `?mock=1` query param swaps the real hub WebSocket for the
keyboard emitter, so the game runs with no hardware. This is the key to parallel work.

---

## 8. Four-person parallel workflow

After a 30-min kickoff that freezes the three contracts, four independent lanes run against
mocks until a single integration window:

- **P1 — Hardware/firmware/transport:** `firmware/`, `hub/`. Tests against
  `mocks/message-logger.html`.
- **P2 — Game logic:** `web/game/`. Tests against the keyboard emitter +
  `mocks/game-harness.html` (stubbed Audio/Speak/Voice).
- **P3 — Sensory layer:** `web/audio/`, `web/voice/`. Tests against `mocks/audio-test.html`.
- **P4 — Content/pitch/integration:** `web/content.json`, then owns the integration window
  (swap mocks for real implementations — they share the contract interfaces, so it's a
  drop-in).

Zero file overlap by design. (Full current ownership table + phases live in `docs/ROLES.md`.)

---

## 9. Scaffolding task — DONE

The repo has been scaffolded: full directory tree, placeholder stubs (owner + contract +
TODO headers), the frozen `content.json`, `package.json`, mock harnesses, and these docs.
The remaining work is implementation, lane by lane, per `docs/ROLES.md`.

**Vertical-slice acceptance (the integration target):** with `?mock=1`, pressing keyboard
key `4` (P1, dot 4) routes a Contract-1 message → `game/` find-target loop scores it →
`audio/` plays a high-pitched right-panned earcon → `Speak.say` announces "correct." If that
round-trips, the scaffold is correct and the team builds out from there.

**Constraints:** 8-hour total budget, reliability over features, demo-critical. Favor simple
and robust over clever. Keep the three contracts frozen.
