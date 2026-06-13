/**
 * web/voice/recognition.js — Contract 2 voice-in surface (global `Voice`)
 * Owner: P3 (Sensory Layer)
 *
 * Voice IN, primary path — Web Speech API SpeechRecognition. Free, no account,
 * no network dependency. Matches utterances against the content.json `commands`
 * grammar. THIS is the reliable demo path (Wispr is only a bonus).
 *
 * SCAFFOLD STUB — TODO implement global Voice = { onCommand(callback) }
 *  - start SpeechRecognition (continuous, interim off)
 *  - fuzzy-match results to the commands grammar; fire callback(command)
 *  - auto-restart on end; tolerate mic permission prompts
 */
