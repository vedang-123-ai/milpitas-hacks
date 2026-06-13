# Pitch & Demo Script (P4)

> The touchable device is the hook — lead with it, keep talk tight.

## One-liner
DotRace — an audio-first, two-player tactile game that teaches blind early learners the
spatial coordinate system Braille literacy is built on, years before formal Braille.

## The problem
Spatial awareness (top/bottom, left/right, the cell grid) is the foundation literacy sits
on — and it's hard to teach without sight. Most ed-tech here is screen-based and useless to
this audience. Blind kids need to build the mental map *by touch and sound* before any
letters mean anything.

## Why us / the edge
A **working physical device a judge can touch blindfolded.** Almost every other team ships a
pure web/mobile app. Spatialized audio (a bird chirps from the correct side of the
headphones) makes the invisible game legible; LEDs let sighted judges watch it too. The
pedagogy is real: top/bottom → pitch, left/right → stereo pan is an established cross-modal
mapping, not a gimmick.

## How it works (10-second architecture)
Physical touch pads (ESP32) → laptop hub → browser. The board is a dumb sensor; all the
game, audio, and voice live in the browser. That split means it runs **fully offline** on a
laptop hotspot — no venue Wi-Fi, nothing to fail live.

## Live demo (≈90s)
1. Hand a judge the headphones + cell; have them close their eyes.
2. **Free explore** — they feel a pad, hear its position earcon (pitch = row, pan = column).
   The map clicks.
3. **Find-target** — "find the top right"; reward chirp on success.
4. **1v1 race** — two people trace a letter; first to complete the dot-set wins, panned win
   sting + spoken score.
5. Note the **difficulty ramp**: positions → 2-dot letters → 3-dot letters + words.

## Resilience (say this if a pad misfires)
The browser runs identically on **keyboard mock mode** (`?mock=1`) — if a pad acts up on the
venue table, we demo the exact same game from the laptop with zero loss. Nothing in the demo
depends on venue Wi-Fi or any cloud service.

## The build (team of 4, ~8 hours)
Four frozen contracts let us build in parallel with zero merge conflicts: hardware/transport,
game engine, sensory (audio + voice), and content/integration. Practice words are
**AI-generated at build time** and validated against the cell's letters, then baked in — so
the live demo carries no API key and needs no internet.

## TODO before demo
- [ ] Final talking points / who says what
- [ ] Recalibrate capacitive baselines on the venue table; test headphones
- [ ] Confirm mock-mode fallback is one keystroke away on the demo laptop
- [ ] (Optional) add OpenAI credit + run `scripts/generate-content.mjs` for a richer word bank
