#!/usr/bin/env python3
"""
web/serve.py — serves the DotRace web app AND provides reliable text-to-speech
using the native macOS `say` command (bypasses the flaky browser SpeechSynthesis).

Use this INSTEAD of `python3 -m http.server`:
    cd web
    python3 serve.py
    # open http://localhost:8000/index.html?mock=1

How it works: the browser's Speak.say() does GET /say?text=...  and this server
runs `say` on your Mac. Native TTS always works, offline, no browser quirks.

CHANGE THE VOICE: edit TTS_VOICE below (default "Samantha"). See the list of
installed voices with:   say -v '?'
(System voices can be added in System Settings > Accessibility > Spoken Content.)
"""
import http.server
import socketserver
import subprocess
import urllib.parse
import os

PORT = 8000
TTS_VOICE = "Samantha"   # <-- change to any voice from `say -v '?'`  (or "" for system default)
TTS_RATE = 180           # words per minute

_current = {"proc": None}  # the in-flight `say` process, so we can interrupt it


def speak(text, voice, rate):
    if not text:
        return
    # interrupt any current speech (matches the browser's interrupt=true behaviour)
    p = _current["proc"]
    if p and p.poll() is None:
        try:
            p.terminate()
        except Exception:
            pass
    args = ["say"]
    if voice:
        args += ["-v", voice]
    if rate:
        args += ["-r", str(rate)]
    args += ["--", text]
    try:
        _current["proc"] = subprocess.Popen(args)
    except FileNotFoundError:
        print("  ! `say` not found — native TTS needs macOS. Browser will fall back.")


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/say":
            qs = urllib.parse.parse_qs(parsed.query)
            text = (qs.get("text") or [""])[0]
            voice = (qs.get("voice") or [TTS_VOICE])[0]
            rate = (qs.get("rate") or [TTS_RATE])[0]
            speak(text, voice, rate)
            self.send_response(204)  # no content; the request itself triggers speech
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            return
        return super().do_GET()

    def log_message(self, *args):
        pass  # keep the console quiet


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))  # serve web/
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
        print(f"DotRace web + native TTS:  http://localhost:{PORT}/index.html?mock=1")
        print(f"  voice: {TTS_VOICE or '(system default)'}   (change in serve.py / config.js)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped.")
