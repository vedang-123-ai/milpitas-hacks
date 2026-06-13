/**
 * hub/lib/player-tagger.js — validate + normalize an incoming touch frame
 * Owner: P1
 *
 * Turns whatever an ESP32 sends into a clean Contract-1 frame, or null if it's
 * not valid. Coerces types (string "2" -> 2, "DOWN" -> "down") so slightly
 * sloppy firmware still works. In two-board mode each board hardcodes its own
 * PLAYER, so the frame already carries it; `meta.player` is only a fallback if a
 * frame arrives without a valid player (e.g. a one-board setup that tags by
 * connection).
 */
function tag(raw, meta = {}) {
  if (!raw || typeof raw !== 'object') return null;

  let player = Number(raw.player);
  if (player !== 1 && player !== 2) player = Number(meta.player); // fallback
  const dot = Number(raw.dot);
  const event = String(raw.event || '').toLowerCase();

  if (player !== 1 && player !== 2) return null;
  if (!Number.isInteger(dot) || dot < 1 || dot > 6) return null;
  if (event !== 'down' && event !== 'up') return null;

  return { player, dot, event };
}

module.exports = { tag };
