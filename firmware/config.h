/**
 * firmware/config.h — isolated hardware/environment configuration
 * Owner: P1
 *
 * Keep ALL board- and venue-specific values here so dotrace_firmware.ino stays
 * untouched between boards and demo sites. This is the only file you edit on-site.
 *
 * SCAFFOLD STUB — fill in at kickoff / on the demo table. TODO define:
 *  - PLAYER          : 1 or 2 (which player this board reports as)
 *  - HOTSPOT_SSID    : laptop/router hotspot name (NEVER venue Wi-Fi)
 *  - HOTSPOT_PASS    : hotspot password
 *  - HUB_HOST / PORT : Node hub WebSocket address
 *  - PAD_GPIOS[6]    : touch-pin per Braille dot, index 0..5 -> dots 1..6
 *  - LED_GPIOS[6]    : mirror LED per pad (optional)
 *  - RELAY_GPIO      : optional click on score
 *  - TOUCH_MARGIN    : relative trigger delta below calibrated baseline
 *  - DEBOUNCE_MS     : debounce window
 */
