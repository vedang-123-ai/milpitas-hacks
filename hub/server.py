#!/usr/bin/env python3
"""
hub/server.py — DotRace hardware hub (UDP from ESP32  ->  WebSocket to browser)

The ESP32 touch boards broadcast UDP packets shaped like:

    P1:1,0,0,1,0,0          (player 1; dots 1..6, 1 = touched, 0 = not)
    P2:0,0,0,1,0,0          (player 2)

This hub:
  1. listens for those UDP packets (port 4210),
  2. converts each CHANGE in a pad's state into a Contract-1 event:
         {"player": 1, "dot": 4, "event": "down"}   (0 -> 1)
         {"player": 1, "dot": 4, "event": "up"}      (1 -> 0)
     (edge detection — a finger held down is ONE "down", not a flood), and
  3. broadcasts that JSON to every connected browser over WebSocket (port 8080).

The browser's web/input/hub-source.js already connects to ws://<this-host>:8080
and feeds these exact messages into the game — so no game code changes between
keyboard-mock mode and real hardware. This is the whole point of Contract 1.

RUN:
    cd hub
    python3 -m pip install -r requirements.txt      # one time
    python3 server.py

Then open the web app WITHOUT ?mock=1 so it uses the hub:
    http://localhost:8000/index.html
(serve web/ separately, e.g.  cd web && python3 -m http.server 8000)

TEST WITHOUT HARDWARE (fake a touch from another terminal):
    python3 -c "import socket; socket.socket(2,2).sendto(b'P1:1,0,0,0,0,0',('127.0.0.1',4210))"
    # then the same with all zeros to send the matching 'up'.
"""
import asyncio
import json
import websockets  # pip install websockets

UDP_IP = "0.0.0.0"      # listen on every network interface
UDP_PORT = 4210         # must match the port the ESP32 firmware sends to
WS_HOST = "0.0.0.0"
WS_PORT = 8080          # must match CONFIG.HUB_URL in web/config.js

clients = set()                  # connected browsers
last_state = {}                  # player -> [s1..s6] previous pad states


async def broadcast(message: dict):
    """Send one Contract-1 message to every connected browser."""
    if not clients:
        return
    data = json.dumps(message)
    await asyncio.gather(
        *(ws.send(data) for ws in list(clients)),
        return_exceptions=True,   # a dead socket must not kill the others
    )


def diff_to_events(player: int, states: list[int]):
    """Yield a Contract-1 event for each pad whose state changed."""
    prev = last_state.get(player, [0, 0, 0, 0, 0, 0])
    for i in range(min(6, len(states))):
        was = prev[i] if i < len(prev) else 0
        now = states[i]
        if now != was:
            yield {"player": player, "dot": i + 1,
                   "event": "down" if now == 1 else "up"}
    last_state[player] = (states + [0] * 6)[:6]


class TouchProtocol(asyncio.DatagramProtocol):
    """Parses incoming UDP packets and schedules WebSocket broadcasts."""

    def __init__(self, loop):
        self.loop = loop

    def datagram_received(self, data, addr):
        try:
            text = data.decode("utf-8").strip()
            player_id, touches = text.split(":")
            player = int(player_id.strip().lstrip("Pp"))
            states = [1 if t.strip() == "1" else 0 for t in touches.split(",")]
        except Exception as exc:
            print(f"  ! ignoring bad packet from {addr}: {data!r} ({exc})")
            return

        for event in diff_to_events(player, states):
            print(f"  -> {event}")
            # datagram_received runs on the event loop, so create_task is safe.
            self.loop.create_task(broadcast(event))


async def ws_handler(websocket, *_):
    """Track a browser connection until it closes (*_ tolerates ws lib versions)."""
    clients.add(websocket)
    print(f"  + browser connected ({len(clients)} total)")
    try:
        await websocket.wait_closed()
    finally:
        clients.discard(websocket)
        print(f"  - browser disconnected ({len(clients)} total)")


async def main():
    loop = asyncio.get_running_loop()
    await loop.create_datagram_endpoint(
        lambda: TouchProtocol(loop), local_addr=(UDP_IP, UDP_PORT)
    )
    print(f"DotRace hub up:")
    print(f"  UDP  in : {UDP_IP}:{UDP_PORT}   (ESP32 touch packets)")
    print(f"  WS   out: ws://{WS_HOST}:{WS_PORT}  (browser)")
    print("-" * 48)
    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nhub stopped.")
