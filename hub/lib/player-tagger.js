/**
 * hub/lib/player-tagger.js — assign/normalize the `player` field on touch events
 * Owner: P1
 *
 * Why it exists: in two-board mode each ESP32 connection IS a player, so the
 * player id may need to come from the connection rather than the payload. In
 * one-board mode the firmware already sets player. This module makes both look
 * identical to the browser, so no other layer branches on hardware setup.
 *
 * SCAFFOLD STUB — TODO:
 *  - map a connection -> player id (register on first message / handshake)
 *  - ensure every relayed message has a valid player (1|2) per Contract 1
 */
