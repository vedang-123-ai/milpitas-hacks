/**
 * firmware/dotrace_firmware.ino — ESP32 capacitive-touch sensor node
 * Owner: P1 (Hardware / Firmware / Transport)
 * Emits: Contract 1 — { "player": 1, "dot": 4, "event": "down" } over WebSocket
 *
 * Role: PURE SENSOR. Holds ZERO game logic. Reads touch pads, drives LEDs/relay,
 * and streams touch events to the Node hub. One board = player 1 (and 2 if
 * single ESP32-S3 with 12 pads); two boards = one per player.
 *
 * All tunables (GPIO pad map, hotspot SSID/pass, thresholds, PLAYER id) live in
 * config.h so this file is never edited for environment changes.
 *
 * SCAFFOLD STUB — no implementation yet. TODO:
 *  - WiFi.begin() as a STATION joining the laptop hotspot (see config.h)
 *  - Boot calibration: read each pad's untouched baseline, set relative threshold
 *  - Debounced read loop over the 6 pads (touchRead per pad)
 *  - WebSocket client (arduinoWebSockets / links2004): emit Contract-1 JSON on down/up
 *  - Mirror active pads to LEDs; optional relay click on scored point
 *  - RE-CALIBRATE on the actual demo table (baselines drift w/ humidity & surface)
 */
