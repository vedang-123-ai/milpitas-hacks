/**
 * web/analytics.js — per-letter miss tracking + weak-letter targeting.
 * Owner: P4. Purely ADDITIVE and self-contained: it records a "miss" every time a
 * wrong dot is pressed while forming a letter (i.e. every buzz), and exposes the
 * letters a player struggles with so Practice mode can bias the curriculum toward
 * them. Nothing here changes how the game plays unless Practice is switched on.
 *
 * "Doing badly" on a letter = missed it MORE than twice (count > 2).
 *
 * Persisted in localStorage so progress survives a refresh; falls back to
 * in-memory if storage is unavailable (private mode, file://, etc.).
 */
(function () {
  const KEY = "dotrace_misses_v1";
  const THRESHOLD = 2; // strictly MORE than twice

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; }
  }
  let misses = load();
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(misses)); } catch (_) {} }

  // Record a wrong-dot miss against the letter the player was trying to form.
  function recordMiss(letter) {
    if (!letter) return;
    const L = String(letter).toUpperCase();
    if (!/^[A-Z]$/.test(L)) return;
    misses[L] = (misses[L] || 0) + 1;
    persist();
  }

  // Letters missed MORE than the threshold (default > 2), worst first.
  function weakLetters(threshold = THRESHOLD) {
    return Object.keys(misses)
      .filter((L) => misses[L] > threshold)
      .sort((a, b) => misses[b] - misses[a]);
  }

  // [["R",4],["S",3],...] worst first — for the on-screen panel.
  function summary() {
    return Object.entries(misses).sort((a, b) => b[1] - a[1]);
  }
  function count(letter) { return misses[String(letter || "").toUpperCase()] || 0; }
  function reset() { misses = {}; persist(); }

  window.Analytics = { recordMiss, weakLetters, summary, count, reset, THRESHOLD };
})();
