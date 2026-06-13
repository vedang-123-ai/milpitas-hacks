/**
 * firmware/config.h — isolated hardware/environment configuration
 * Owner: P1
 *
 * Keep ALL board- and venue-specific values here so dotrace_firmware.ino stays
 * untouched between boards and demo sites. This is the only file you edit on-site.
 *
 * Everything below has a sensible default for a CLASSIC ESP32 (one board = one
 * player, 6 pads). Change three things at kickoff, two more on the demo table:
 *   kickoff:   PLAYER, WIFI_SSID/WIFI_PASS, HUB_HOST
 *   demo table: TOUCH_MARGIN (touch sensitivity), maybe PAD_GPIOS to match wiring
 */
#ifndef DOTRACE_CONFIG_H
#define DOTRACE_CONFIG_H

// ── 1. WHICH PLAYER IS THIS BOARD ────────────────────────────────────────────
// Two-board setup (Option B): flash one board with 1, the other with 2.
// One-board setup (Option A, ESP32-S3 12 pads): see the §PADS note below.
#define PLAYER            1

// ── 2. NETWORK: join the LAPTOP HOTSPOT, never venue Wi-Fi ────────────────────
#define WIFI_SSID         "DotRace-Hotspot"   // the laptop/phone/router hotspot name
#define WIFI_PASS         "dotrace123"        // hotspot password (>=8 chars)

// The Node hub (hub/server.js) runs on the laptop. HUB_HOST is the laptop's IP
// ON THE HOTSPOT NETWORK — find it after starting the hotspot:
//   macOS Internet Sharing:  usually 192.168.2.1   (System Settings → Sharing)
//   iPhone hotspot:          usually 172.20.10.1
//   travel router:           the laptop's DHCP lease, e.g. 192.168.0.123
// The hub prints "socket ws://localhost:8080" — use the laptop's hotspot IP here.
#define HUB_HOST          "192.168.2.1"
#define HUB_PORT          8080
#define HUB_PATH          "/"

// ── 3. PADS: touchRead() GPIO per Braille dot ────────────────────────────────
// Index 0..5  ->  Braille dots 1..6:   1 ● ● 4
//                                       2 ● ● 5
//                                       3 ● ● 6
// CLASSIC ESP32 touch-capable GPIOs: 4, 13, 14, 27, 32, 33 (all safe, no
// strapping conflicts). AVOID GPIO 0/2/12/15 (strapping pins — flaky on boot).
// Set these to MATCH YOUR ACTUAL WIRING.
#define PAD_GPIOS         { 4, 13, 14, 27, 32, 33 }

// ESP32-S3 one-board (Option A): S3 touch values RISE on touch — set
// TOUCH_ACTIVE_LOW to 0 below, list its touch GPIOs here, and report both
// players from one board (advanced — two classic boards is the simpler path).

// ── 4. TOUCH SENSING ─────────────────────────────────────────────────────────
// Classic ESP32: untouched reads HIGH (~60-90), DROPS when touched. So "active
// low" = a touch makes the value go DOWN. (ESP32-S2/S3 are the opposite → 0.)
#define TOUCH_ACTIVE_LOW  1

// How far the reading must move from its calibrated baseline to count as a
// touch. BIGGER = less sensitive (fewer false triggers), SMALLER = more
// sensitive. Tune on the demo table: watch the serial monitor's per-pad
// "dev" values when you touch vs. not, and pick a margin between them.
#define TOUCH_MARGIN      18

// Release hysteresis: must recover this much past the margin to count as "up".
// Stops chatter when a finger rests right at the threshold. Keep < TOUCH_MARGIN.
#define TOUCH_HYSTERESIS  6

// A state must hold this long (ms) before we emit down/up. Kills jitter/spikes.
#define DEBOUNCE_MS       35

// Boot calibration: number of samples averaged per pad to find its untouched
// baseline. DO NOT TOUCH THE PADS during the first ~1s after reset/power-up.
#define CALIBRATION_SAMPLES 64

// ── 5. OUTPUTS (optional, for sighted judges + tactile feedback) ─────────────
// LEDs mirror active pads. Set USE_LEDS 0 to skip (or if you're short on pins).
#define USE_LEDS          1
#define LED_GPIOS         { 16, 17, 18, 19, 21, 22 }   // index 0..5 -> dots 1..6
#define LED_ACTIVE_HIGH   1     // 1 = LED on when pin HIGH (typical)

// Relay: a satisfying physical click. Pulsed on each fresh touch-down.
#define USE_RELAY         0
#define RELAY_GPIO        23
#define RELAY_ACTIVE_HIGH 1
#define RELAY_PULSE_MS    40

// Status LED: solid = WiFi+hub connected, blinking = connecting. -1 to disable.
// (Avoid a pin already used by a pad/LED above. GPIO 2 is the on-board LED on
// many dev boards but is ALSO a touch pin — only use it if it's not a pad.)
#define STATUS_LED        2

// ── 6. SERIAL DEBUG ──────────────────────────────────────────────────────────
#define SERIAL_BAUD       115200

#endif // DOTRACE_CONFIG_H
