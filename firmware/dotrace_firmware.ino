/**
 * firmware/dotrace_firmware.ino — ESP32 capacitive-touch sensor node
 * Owner: P1 (Hardware / Firmware / Transport)
 * Emits: Contract 1 — { "player": 1, "dot": 4, "event": "down" } over WebSocket
 *
 * Role: PURE SENSOR. Holds ZERO game logic. Reads touch pads, drives LEDs/relay,
 * and streams touch events to the Node hub. One classic ESP32 = one player
 * (config.h PLAYER); two boards = one per player. The hub merges them.
 *
 * All tunables (GPIO pad map, hotspot SSID/pass, thresholds, PLAYER id) live in
 * config.h — this file is never edited for environment changes.
 *
 * ── LIBRARIES (Arduino IDE → Library Manager) ────────────────────────────────
 *   • "WebSockets" by Markus Sattler  (links2004/arduinoWebSockets)  ≥ 2.4.x
 *   • ESP32 board support (Espressif Systems) via Boards Manager
 * Board: your classic ESP32 dev module.  Upload speed 115200.
 *
 * ── FLASH & GO ───────────────────────────────────────────────────────────────
 *   1. Edit config.h: PLAYER, WIFI_SSID/PASS, HUB_HOST (the laptop's hotspot IP).
 *   2. Start the laptop hotspot, then `node hub/server.js` on the laptop.
 *   3. Upload this sketch. Open Serial Monitor @ 115200.
 *   4. Don't touch the pads for ~1s after reset (boot calibration).
 *   5. Verify frames in the browser at  http://localhost:8080/mocks/message-logger.html
 *
 * RE-CALIBRATE on the actual demo table (baselines drift w/ humidity & surface):
 * just press the reset button with hands off the pads.
 */
#include <WiFi.h>
#include <WebSocketsClient.h>
#include "config.h"

// ── pad / output tables (sized 6, index 0..5 -> Braille dots 1..6) ───────────
static const uint8_t PADS[6] = PAD_GPIOS;
#if USE_LEDS
static const uint8_t LEDS[6] = LED_GPIOS;
#endif

// ── per-pad runtime state ────────────────────────────────────────────────────
static int      baseline[6];        // calibrated untouched reading
static bool     pressed[6]   = {false, false, false, false, false, false};
static bool     candidate[6] = {false, false, false, false, false, false};
static uint32_t candidateSince[6] = {0, 0, 0, 0, 0, 0};

static WebSocketsClient webSocket;
static bool hubConnected = false;

// ─────────────────────────────────────────────────────────────────────────────
// Touch helpers
// ─────────────────────────────────────────────────────────────────────────────

// Read a pad as a positive "deviation from baseline that grows with touch",
// so the rest of the code is identical for classic ESP32 (value drops on touch)
// and S2/S3 (value rises). See TOUCH_ACTIVE_LOW in config.h.
static int touchDeviation(int padIndex) {
  int raw = touchRead(PADS[padIndex]);
#if TOUCH_ACTIVE_LOW
  return baseline[padIndex] - raw;   // classic: touch makes raw smaller
#else
  return raw - baseline[padIndex];   // S2/S3:   touch makes raw larger
#endif
}

// Average a burst of readings to find each pad's untouched baseline.
// HANDS OFF the pads while this runs (first ~1s after reset).
static void calibrate() {
  Serial.println("[calib] hands OFF the pads...");
  for (int i = 0; i < 6; i++) {
    long sum = 0;
    for (int s = 0; s < CALIBRATION_SAMPLES; s++) {
      sum += touchRead(PADS[i]);
      delay(2);
    }
    baseline[i] = (int)(sum / CALIBRATION_SAMPLES);
    Serial.printf("[calib] dot %d  GPIO %2d  baseline=%d\n", i + 1, PADS[i], baseline[i]);
  }
  Serial.printf("[calib] done. TOUCH_MARGIN=%d  HYSTERESIS=%d  DEBOUNCE_MS=%d\n",
                TOUCH_MARGIN, TOUCH_HYSTERESIS, DEBOUNCE_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────

static void setLed(int padIndex, bool on) {
#if USE_LEDS
  digitalWrite(LEDS[padIndex], (on == (bool)LED_ACTIVE_HIGH) ? HIGH : LOW);
#endif
}

static void pulseRelay() {
#if USE_RELAY
  digitalWrite(RELAY_GPIO, RELAY_ACTIVE_HIGH ? HIGH : LOW);
  delay(RELAY_PULSE_MS);
  digitalWrite(RELAY_GPIO, RELAY_ACTIVE_HIGH ? LOW : HIGH);
#endif
}

static void setStatusLed(bool on) {
#if STATUS_LED >= 0
  digitalWrite(STATUS_LED, on ? HIGH : LOW);
#endif
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport — Contract 1 over WebSocket
// ─────────────────────────────────────────────────────────────────────────────

// Build + send { "player":P, "dot":D, "event":"down|up" }. No JSON library
// needed — the contract is tiny and fixed, so a formatted string is robust.
static void emit(int dot, const char *event) {
  char frame[64];
  snprintf(frame, sizeof(frame),
           "{\"player\":%d,\"dot\":%d,\"event\":\"%s\"}", PLAYER, dot, event);
  bool sent = hubConnected && webSocket.sendTXT(frame);
  Serial.printf("[emit%s] %s\n", sent ? "" : " (no hub, dropped)", frame);
}

static void onWsEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      hubConnected = true;
      setStatusLed(true);
      Serial.printf("[ws] connected to hub %s:%d%s\n", HUB_HOST, HUB_PORT, HUB_PATH);
      break;
    case WStype_DISCONNECTED:
      hubConnected = false;
      setStatusLed(false);
      Serial.println("[ws] disconnected — auto-reconnecting...");
      break;
    case WStype_ERROR:
      Serial.println("[ws] error");
      break;
    default:
      // We are a producer; inbound frames (TEXT/BIN/PING) are ignored on purpose.
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WiFi
// ─────────────────────────────────────────────────────────────────────────────

static void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);               // lower latency for snappy touch response
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("[wifi] joining \"%s\"", WIFI_SSID);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
    setStatusLed((millis() / 250) % 2);          // blink while connecting
    if (millis() - start > 20000) {              // 20s: re-kick a stuck join
      Serial.println(" retry");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
      start = millis();
    }
  }
  Serial.printf("\n[wifi] connected. IP=%s  RSSI=%d dBm\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup / loop
// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(300);
  Serial.printf("\n=== DotRace firmware — PLAYER %d ===\n", PLAYER);

#if USE_LEDS
  for (int i = 0; i < 6; i++) { pinMode(LEDS[i], OUTPUT); setLed(i, false); }
#endif
#if USE_RELAY
  pinMode(RELAY_GPIO, OUTPUT);
  digitalWrite(RELAY_GPIO, RELAY_ACTIVE_HIGH ? LOW : HIGH);
#endif
#if STATUS_LED >= 0
  pinMode(STATUS_LED, OUTPUT);
#endif

  calibrate();                        // hands off the pads here!
  connectWifi();

  webSocket.begin(HUB_HOST, HUB_PORT, HUB_PATH);
  webSocket.onEvent(onWsEvent);
  webSocket.setReconnectInterval(2000);   // a flaky link self-heals every 2s
  Serial.println("[ws] connecting to hub...");
}

void loop() {
  webSocket.loop();                   // service the socket + reconnects

  const uint32_t now = millis();
  for (int i = 0; i < 6; i++) {
    const int dev = touchDeviation(i);

    // Threshold WITH hysteresis: a pressed pad must recover well past the margin
    // before it reads as released, so a finger resting on the edge can't chatter.
    bool wantPressed = pressed[i]
        ? (dev > (TOUCH_MARGIN - TOUCH_HYSTERESIS))   // stay pressed
        : (dev > TOUCH_MARGIN);                       // become pressed

    if (wantPressed != pressed[i]) {
      // a change is proposed — start/continue the debounce window
      if (wantPressed != candidate[i]) { candidate[i] = wantPressed; candidateSince[i] = now; }
      else if (now - candidateSince[i] >= DEBOUNCE_MS) {
        pressed[i] = wantPressed;                      // commit the transition
        const int dot = i + 1;                         // index 0..5 -> dots 1..6
        setLed(i, pressed[i]);
        if (pressed[i]) { emit(dot, "down"); pulseRelay(); }
        else            { emit(dot, "up"); }
      }
    } else {
      candidate[i] = pressed[i];                        // proposal withdrawn
    }
  }
}
