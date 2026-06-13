/**
 * web/voice/wispr-hook.js — OPTIONAL "premium" voice-in via Wispr Flow
 * Owner: P3 (Sensory Layer)
 *
 * Wispr Flow is a system-level dictation app that types into the focused field
 * (cloud-only, needs internet). We expose the always-focused #voice-input and
 * parse injected text with the SAME command grammar as recognition.js.
 *
 * MUST NOT be a demo dependency — venue Wi-Fi/cloud can fail. Web Speech wins.
 *
 * SCAFFOLD STUB — TODO:
 *  - listen to #voice-input 'input'/'change'; parse against commands grammar
 *  - feed matched commands through the same Voice.onCommand callbacks
 *  - keep the input focused
 */
