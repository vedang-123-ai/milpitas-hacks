/**
 * hub/server.js — Node WebSocket hub + static web server
 * Owner: P1 (Hardware / Firmware / Transport)
 *
 * The single point that decouples one-board vs two-board hardware from the app:
 *  - Serves the static web app from /web
 *  - Runs ONE WebSocket server accepting ESP32 client(s) AND the browser client
 *  - Tags incoming touch events by player (lib/player-tagger) and relays the
 *    frozen Contract-1 message to the browser (lib/relay)
 *  - Logs everything for debugging
 *
 * SCAFFOLD STUB — no implementation yet. TODO:
 *  - Static file server for ../web (http or express)
 *  - ws.Server: distinguish ESP32 producers from the browser consumer
 *  - Pass-through/normalize Contract-1 messages; never add game logic here
 *  - Start on HUB_PORT; log connects/disconnects/messages
 */
