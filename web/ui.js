/**
 * web/ui.js — facilitator/judge display driver ("see the invisible game")
 * Owner: P4 (Integration)
 *
 * PURELY PRESENTATIONAL. Reads GameState.snapshot() (P2) every frame and paints
 * the two Braille cells, prompt, scores, mode/difficulty, and timer. It NEVER
 * mutates game state and is not part of any contract — the real interface is the
 * audio. main.js feeds it raw touches/commands for transient flashes via the
 * optional UI.onTouch / UI.onCommand hooks (both guarded, so removing this file
 * changes nothing about how the game plays).
 *
 * Everything is null-safe: if the DOM or GameState isn't present (e.g. a headless
 * test), the driver simply no-ops.
 */
(function () {
  // DOM order for a Braille cell grid: row-major over (col-major numbering)
  //   1 4 / 2 5 / 3 6  -> laid out left-to-right, top-to-bottom
  const GRID_ORDER = [1, 4, 2, 5, 3, 6];

  const MODE_LABEL = {
    "free-explore": "Free Explore",
    "find-target": "Find Target",
    race: "1v1 Race",
    "rapid-fire": "Rapid Fire",
  };
  const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };

  const $ = (id) => document.getElementById(id);
  const el = {};        // cached element refs
  const dotEls = { 1: {}, 2: {} }; // dotEls[player][dot] -> .dot element
  let prev = null;      // last rendered snapshot (for diff-driven animations)

  // Re-trigger a CSS animation class even if it's already applied.
  function flash(node, cls) {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth; // force reflow so the animation restarts
    node.classList.add(cls);
  }

  function buildGrid(player) {
    const grid = $(`grid-${player}`);
    if (!grid) return;
    grid.innerHTML = "";
    for (const dot of GRID_ORDER) {
      const d = document.createElement("div");
      d.className = "dot";
      d.dataset.dot = String(dot);
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(dot);
      d.appendChild(num);
      grid.appendChild(d);
      dotEls[player][dot] = d;
    }
  }

  function snapshot() {
    try {
      return window.GameState && GameState.content ? GameState.snapshot() : null;
    } catch (_) {
      return null;
    }
  }

  function render() {
    const s = snapshot();
    if (s) paint(s);
    requestAnimationFrame(render);
  }

  function paint(s) {
    // prompt + target (crossfade only when it actually changes)
    if (!prev || s.prompt !== prev.prompt) {
      if (el.prompt) {
        el.prompt.textContent = s.prompt || "Put on headphones — press a key or say a command.";
        flash(el.prompt, "enter");
      }
    }
    if (el.targetGlyph) el.targetGlyph.textContent = s.label || "—";

    // mode + difficulty pills
    if (el.mode) el.mode.textContent = MODE_LABEL[s.mode] || s.mode;
    if (el.diff) el.diff.textContent = DIFF_LABEL[s.difficulty] || s.difficulty;

    // timer pill — only meaningful in rapid-fire
    if (el.timer) {
      const show = s.mode === "rapid-fire";
      el.timer.hidden = !show;
      if (show && el.timerVal) el.timerVal.textContent = `${s.secondsLeft}s`;
    }

    // per-player: scores, lit/target dots, active state
    for (const p of [1, 2]) {
      const cell = el.cell[p];
      const touched = new Set(s.touched[p] || []);
      const targets = new Set(s.targetDots || []);

      // score (bump on increase)
      const score = s.scores[p] | 0;
      if (el.score[p]) {
        if (!prev || score !== (prev.scores[p] | 0)) {
          el.score[p].textContent = String(score);
          if (prev && score > (prev.scores[p] | 0)) {
            flash(el.score[p], "bump");
            if (s.mode === "race") flash(cell, "win");
          }
        }
      }

      // dots
      for (const dot of GRID_ORDER) {
        const node = dotEls[p][dot];
        if (!node) continue;
        node.classList.toggle("lit", touched.has(dot));
        node.classList.toggle("target", !touched.has(dot) && targets.has(dot));
      }

      // dim Player 2 when only one cell is in play
      if (cell) cell.classList.toggle("inactive", p === 2 && s.activePlayers < 2);
    }

    // status ticker
    if (el.ticker && s.lastResult) {
      el.ticker.innerHTML = `round <b>${s.round}</b> · ${s.lastResult}`;
    }

    prev = s;
  }

  // ── public hooks (called by main.js; both optional + guarded there) ───────
  const UI = {
    // called on every raw touch BEFORE the engine processes it, so we can
    // classify the dot against the still-current target/touched sets.
    onTouch(msg) {
      if (!msg || msg.event !== "down") return;
      const node = dotEls[msg.player] && dotEls[msg.player][msg.dot];
      if (!node) return;
      const s = snapshot();
      if (!s || msg.player > s.activePlayers) return;
      const isTarget = (s.targetDots || []).includes(msg.dot);
      const already = (s.touched[msg.player] || []).includes(msg.dot);
      flash(node, isTarget && !already ? "flash-correct" : "flash-wrong");
    },

    onCommand() {
      flash(el.cmdbar, "flash");
    },
  };

  function init() {
    el.prompt = $("prompt");
    el.targetGlyph = $("target-glyph");
    el.mode = $("mode-val");
    el.diff = $("diff-val");
    el.timer = $("timer-pill");
    el.timerVal = $("timer-val");
    el.ticker = $("ticker");
    el.cmdbar = $("cmdbar");
    el.cell = { 1: $("cell-1"), 2: $("cell-2") };
    el.score = { 1: $("score-1"), 2: $("score-2") };

    buildGrid(1);
    buildGrid(2);
    requestAnimationFrame(render);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.UI = UI;
})();
