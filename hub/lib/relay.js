/**
 * hub/lib/relay.js — fan-out validated Contract-1 messages to the browser client
 * Owner: P1
 *
 * Keeps the socket-routing concern out of server.js. Producers (ESP32s) -> hub
 * -> consumer (browser). Drops/ignores malformed frames so a flaky pad never
 * crashes the demo.
 *
 * SCAFFOLD STUB — TODO:
 *  - track the browser consumer socket(s)
 *  - validate shape { player:1|2, dot:1-6, event:"down"|"up" } before relaying
 *  - broadcast to consumer(s); tolerate disconnects/reconnects
 */
