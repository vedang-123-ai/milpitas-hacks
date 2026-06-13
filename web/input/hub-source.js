/**
 * web/input/hub-source.js — real input: WebSocket to the Node hub
 * Owner: P4 (Integration), shape agreed with P1
 *
 * Connects to CONFIG.HUB_URL and forwards each Contract-1 message to a handler.
 * Mirrors mock-source.js exactly so main.js swaps them with no other changes.
 *
 * SCAFFOLD STUB — TODO expose: HubSource.start(onMessage)
 *  - open WebSocket(CONFIG.HUB_URL)
 *  - JSON.parse frames -> onMessage({player,dot,event})
 *  - log/retry on disconnect (demo resilience)
 */
