# DotRace

A two-player, **audio-first Braille-readiness game** for blind early learners. Kids feel two
physical 3×2 capacitive-touch cells (the Braille cell layout) and "trace" letters by touch.
The UI is entirely voice (TTS out, voice commands in); correct touches are rewarded with
spatialized audio. Play solo or race 1v1. Built for an 8-hour, 4-person hackathon.

> The physical device is the demo edge. **Reliability beats features. No venue Wi-Fi.**

## Start here (read order — for humans AND their AI assistants)
1. **`docs/PROJECT_BRIEF.md`** — the complete original spec; full context for the whole project.
2. **`docs/ROLES.md`** — who owns which folder + the build phases. **← team starts here.**
3. **`docs/CONTRACTS.md`** — the three frozen interfaces between layers.
4. **`docs/HARDWARE.md`** — board options, pad layout, calibration.
5. **`docs/PITCH.md`** — demo script.

> `CLAUDE.md` is a condensed, AI-facing summary that Claude Code auto-loads — but it is
> **git-ignored, so it is NOT shared on push.** This README + everything in `docs/` are the
> committed, shareable context. A teammate's AI gets the full picture from `docs/PROJECT_BRIEF.md`.

## Architecture (three layers, each testable in isolation)

```
[ESP32 sensor node(s)] ──WS──> [Node hub on laptop] ──WS──> [Browser web app]
   firmware/  (dumb pads)        hub/  (tag+relay+serve)      web/  (all logic, audio, voice)
```

## Repo layout

```
firmware/   P1  ESP32 touch sensing + WS client      (config.h = on-site settings)
hub/        P1  Node WS relay + static server         (lib/ = tagger, relay)
web/
  game/     P2  state, engine, modes/ (one file per mode)
  audio/    P3  Audio.* (Web Audio pan+pitch) + earcon tables
  voice/    P3  Speak.* / Voice.* (SpeechSynthesis + SpeechRecognition + Wispr hook)
  input/    P4  hub-source vs mock-source (the mock toggle)
  content.json  P4  curriculum (Contract 3)
  main.js / index.html / config.js  P4  thin integration seam
mocks/      shared test harnesses (one per lane) + keyboard emitter
docs/       contracts, roles/phases, hardware, pitch
```

## Run

**No hardware (mock mode) — develop the whole app on a keyboard:**
1. `cd hub && npm install` (one-time)
2. `node server.js` (from `hub/`) to serve the app
3. open the served `web/index.html` with **`?mock=1`**
4. press `1`–`6` = Player 1 dots, `Q W E R T Y` = Player 2 dots

**With hardware:** bring up the laptop hotspot, flash `firmware/` (set `config.h`), run the hub,
open the web app without `?mock=1`. Verify the transport first with `mocks/message-logger.html`.

> Audio needs **headphones** — pan/pitch are inaudible on laptop speakers.

## Status
Scaffold stage: structure + frozen contracts + mock harnesses are in place; the lane files are
stubs with owner/contract headers and TODOs. See `docs/ROLES.md` to claim a lane and start.
