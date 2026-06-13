# Hardware Notes (P1)

## Board fork — pick ONE at kickoff (software supports both identically)

- **Option A — one ESP32-S3** (14 touch channels): all 12 pads on one board. Preferred if available. Firmware can report both players.
- **Option B — two classic ESP32s** (10 touch channels each): one board per player, 6 pads each. Better physical separation for 1v1; the hub tags each connection as a player.
- **Do NOT** put 12 pads on one classic ESP32 — it has only 10 touch channels.

The hub (`hub/server.js` + `lib/player-tagger.js`) hides this choice from the rest of the app — no other code branches on it.

## Pad layout (Braille 3×2, both cells)

```
1 ● ● 4      Left column  = dots 1,2,3
2 ● ● 5      Right column = dots 4,5,6
3 ● ● 6      Top 1,4 · Mid 2,5 · Bottom 3,6
```

- 6 pads/cell, identical texture, different only by **position** (location discrimination is the skill).
- **Raised tactile border** around each cell to anchor the hand.
- **Notch/bump marking "top"** so the board self-orients without sight.
- **LEDs** mirror touched/active pads so sighted judges see the invisible game.
- **Relay** (optional): physical click on a scored point.

## Firmware essentials (`firmware/`)

- Connect as a WiFi **station** to the laptop hotspot — **never venue Wi-Fi**.
- **Boot calibration is critical:** capacitive baselines drift with humidity, hand size, and table surface. On boot, read each pad's untouched baseline and trigger relative to it.
- Debounce touches; emit Contract-1 JSON (`{player,dot,event}`) over WebSocket.
- All pins/SSID/thresholds live in `firmware/config.h` — the only file edited on-site.
- **RE-CALIBRATE on the actual demo table.**

## Transport (`hub/`)

ESP32(s) → WiFi/WS → Node hub (laptop) → WS → browser. Hub serves `/web` and relays. Run with `node hub/server.js` (after `npm install` in `hub/`). Verify the pipe with `mocks/message-logger.html` before the game app exists.
