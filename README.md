# ulaw_8000 and alaw Audio Player

Play raw **G.711 μ-law and A-law** telephone audio directly in VS Code — with a waveform, click-to-seek, and keyboard play/pause.

Raw G.711 files (`.ulaw_8000`, `.ulaw`, `.mulaw`, `.alaw`, `.alaw_8000`) are headerless: they're just 8-bit companded samples at 8000 Hz, mono — the format telephony systems (e.g. Twilio media streams) speak natively. μ-law is the North American / Japanese variant, A-law the European one. Nothing on a normal desktop opens them, and even `ffplay` needs the format spelled out. This extension makes them click-to-play.

## Features

- Opens `*.ulaw_8000`, `*.ulaw`, `*.mulaw`, `*.alaw`, and `*.alaw_8000` files in an audio player (as the default editor)
- Waveform rendering with played/unplayed coloring, using your editor theme's colors
- Click the waveform to seek, drag to scrub, digits <kbd>0</kbd>–<kbd>9</kbd> to jump to tenths, <kbd>Space</kbd> to play/pause
- Zero dependencies, no build step — the G.711 decoding happens in ~25 lines of JavaScript

## How it works

The file's bytes are decoded with the standard ITU-T G.711 expansion (μ-law or A-law, chosen by file extension) into PCM, loaded into a Web Audio `AudioBuffer` at 8000 Hz, and played in the editor webview. Since the format is fixed by convention (8-bit companded, 8 kHz, mono), no header is needed — the file extension is the format declaration.

## Development

No install step. Open this folder in VS Code and press <kbd>F5</kbd> — a development host window opens on the `samples/` folder; click `tone-440hz.ulaw_8000` or `tone-440hz.alaw`.

To regenerate the sample files: `python3 scripts/make_test_tone.py`.

## Packaging & publishing

Requires Node.js:

```bash
npx @vscode/vsce package    # produces ulaw-8000-audio-player-x.y.z.vsix
npx @vscode/vsce publish    # after `npx @vscode/vsce login <publisher>`
```

Before first publish, set `publisher` and `repository` in `package.json`.

## License

[MIT](LICENSE)
