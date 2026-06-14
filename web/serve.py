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

VOICE: leave TTS_VOICE = "auto" and the server picks the BEST installed English
voice — it prefers a downloaded Premium / Enhanced / Siri voice (much less
robotic), and falls back to Samantha, then the system default. So it never breaks;
it just sounds better the moment a nicer voice is installed.

  Get a nicer voice (free, ~1 min): System Settings → Accessibility →
  Spoken Content → System Voice → Manage Voices… → download e.g. "Ava (Premium)"
  or an English "Siri" voice, then restart this server.

  List what you have:  say -v '?'
  To pin a specific one, set TTS_VOICE = "Ava (Premium)" (exact name from that list).
"""
import http.server
import socketserver
import subprocess
import urllib.parse
import os
import re

PORT = 8000
TTS_VOICE = "auto"   # "auto" = best installed English voice; or an exact `say -v '?'` name
TTS_RATE = 178       # words per minute (a touch slower reads clearer for learners)

_current = {"proc": None}  # the in-flight `say` process, so we can interrupt it


def list_voices():
    """[(name, lang), ...] from `say -v '?'` — empty if not macOS."""
    try:
        out = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, timeout=5).stdout
    except Exception:
        return []
    voices = []
    for line in out.splitlines():
        parts = re.split(r"\s{2,}", line.strip())  # name may contain spaces
        if len(parts) >= 2 and re.match(r"^[a-z]{2}([_-][A-Za-z]+)?$", parts[1]):
            voices.append((parts[0], parts[1]))
    return voices


VOICES = list_voices()
NAMES = {n for n, _ in VOICES}


def pick_best_voice():
    """Prefer a downloaded Premium/Enhanced/Siri English voice; else a known-good
    standard voice; else any English voice; else the system default ("")."""
    en = [n for n, l in VOICES if l.lower().startswith("en")]
    low = {n: n.lower() for n in en}

    def first(pred):
        return next((n for n in en if pred(low[n])), None)

    return (
        first(lambda s: "premium" in s)
        or first(lambda s: "enhanced" in s)
        or first(lambda s: "siri" in s)
        or next((n for n in ("Ava", "Allison", "Susan", "Samantha", "Alex", "Daniel") if n in NAMES), None)
        or (en[0] if en else "")
    )


# The voice we actually use: auto-pick, a valid pinned name, or auto if the pin is missing.
if TTS_VOICE in ("", "auto"):
    RESOLVED_VOICE = pick_best_voice()
elif TTS_VOICE in NAMES:
    RESOLVED_VOICE = TTS_VOICE
else:
    RESOLVED_VOICE = pick_best_voice()


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
    # honour an explicit, installed voice from the request; otherwise use our best pick
    use = voice if (voice and voice in NAMES) else RESOLVED_VOICE
    args = ["say"]
    if use:
        args += ["-v", use]
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
            voice = (qs.get("voice") or [""])[0]
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
        print(f"  voice: {RESOLVED_VOICE or '(system default)'}")
        if not any('premium' in n.lower() or 'siri' in n.lower() or 'enhanced' in n.lower()
                   for n, _ in VOICES):
            print("  tip: download a 'Premium' or 'Siri' English voice for a much nicer sound")
            print("       (System Settings > Accessibility > Spoken Content > System Voice).")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped.")
