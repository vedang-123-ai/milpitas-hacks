# The Three Frozen Contracts

> Single source of truth for the interfaces between layers. **Freeze at kickoff.**
> If a change is truly needed, *add fields — never change or remove existing ones.*
> These three boundaries are why four people can work without merge conflicts.

## Contract 1 — Touch message (Hardware/Hub → Game)

JSON over WebSocket:

```json
{ "player": 1, "dot": 4, "event": "down" }
```

- `player`: `1` | `2`
- `dot`: `1`–`6` (Braille numbering below)
- `event`: `"down"` | `"up"`

## Contract 2 — Sensory API (Game → Audio/Voice layer)

The game calls these globals and never reaches inside their implementations:

```js
Audio.playDot(player, dot, isCorrect) // pan (L/R column) + pitch (row) earcon
Audio.win(player)                     // triumphant panned sting on that player's side
Audio.buzz(player)                    // gentle, non-punishing wrong-answer tone
Speak.say(text)                       // SpeechSynthesis TTS narration
Voice.onCommand(callback)             // fires callback("two player"), callback("hard"), ...
```

> `Audio` deliberately shadows the built-in `HTMLAudioElement` constructor; the app uses `AudioContext`, not `new Audio()`.

## Contract 3 — Content file (Curriculum → Game)

A single imported `web/content.json` with top-level keys: `letters` (letter → dot-set),
`difficulty` (tiers), `prompts` (with `{LETTER}`/`{PLAYER}`/`{S1}`/`{S2}` placeholders),
and `commands` (the voice grammar). The game reads ALL curriculum from this file —
never hardcode letters or prompts.

## Braille dot numbering (used everywhere)

```
1 ● ● 4
2 ● ● 5
3 ● ● 6
```

Left column = 1,2,3 · Right column = 4,5,6 · Top row = 1,4 · Middle = 2,5 · Bottom = 3,6.
A letter is the set of dots touched (e.g. `C = [1,4]`); "tracing" a letter = touching exactly that set.

## Sonification mapping (audio.js)

- **Horizontal → stereo pan:** left column (1,2,3) pans left, right column (4,5,6) pans right.
- **Vertical → pitch:** top (1,4) high, middle (2,5) mid, bottom (3,6) low. (Panning can't place sound "above," so elevation = pitch.)
- Wrong-answer tone is **gentle, never harsh.**
