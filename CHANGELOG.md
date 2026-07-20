# Changelog

## 0.4.0

- Raw 16-bit PCM support: `.pcm_8000` files play as headerless signed
  little-endian PCM at 8000 Hz mono (the common voice-server cache format).

## 0.3.0

- Drag the waveform to scrub: playback pauses, the playhead follows the
  mouse, and release leaves it where you dropped it.
- Digit keys 0–9 jump the playhead to tenths of the clip (0 = start),
  preserving the current play/pause state.

## 0.2.0

- A-law support: `.alaw` and `.alaw_8000` files now decode with the G.711
  A-law expansion (chosen by file extension).
- Renamed to "ulaw_8000 and alaw Audio Player".

## 0.1.0

- Initial release: waveform player for raw G.711 μ-law 8 kHz mono files
  (`.ulaw_8000`, `.ulaw`, `.mulaw`) with click-to-seek and space to play/pause.
