# CLAUDE.md

## What this is

A zero-dependency, zero-build VS Code extension that plays raw G.711 telephone
audio: μ-law (`.ulaw_8000`, `.ulaw`, `.mulaw`) and A-law (`.alaw`, `.alaw_8000`),
plus raw linear PCM (`.pcm_8000` — signed 16-bit little-endian). These files
are headerless — 8000 Hz, mono by convention — so the file extension is the
only format declaration, and the player trusts it.

## Architecture

Everything lives in `extension.js`:

- A `CustomReadonlyEditorProvider` registered for the six filename patterns
  (`priority: "default"`, so it IS the editor for these files).
- `resolveCustomEditor` reads the file bytes, picks `mulaw`, `alaw`, or `pcm16`
  from the file extension, and embeds the bytes as base64 into the webview HTML.
- The webview decodes G.711 → Float32 PCM via a 256-entry lookup table (or
  reads `.pcm_8000` bytes directly as s16le), plays through a Web Audio
  `AudioBuffer` at 8000 Hz, and draws a canvas waveform.

Constraints to preserve when editing:

- **No dependencies, no build step.** Plain CommonJS + plain browser JS. This
  is a feature; don't add a bundler, TypeScript, or npm packages.
- The webview HTML is a template literal inside `renderPlayerHtml`. The inline
  webview script **must not contain backticks or `${`** — anything that looks
  like interpolation would be evaluated by the outer template literal. Data is
  passed to the webview via the `<script type="text/plain" id="audio-data">`
  element (content = base64 audio, `data-format` attribute = codec), not via
  string interpolation into the script.
- The webview has a strict CSP: no external resources, inline script allowed
  only via nonce. Keep it self-contained.
- UI text is deliberately minimal — no instruction text beyond the single hint
  line. Interactions (drag-to-scrub, digit jumps) are meant to be discovered.

## G.711 codec details (easy to get wrong)

- μ-law: byte is complemented (`~u & 0xff`); sign bit set = **negative**;
  peak magnitude **32124**.
- A-law: byte is XORed with `0x55`; sign bit set (after XOR) = **positive**;
  peak magnitude **32256**; smallest magnitude is 8 (no true zero).
- The two encoders in `scripts/make_test_tone.py` are the reference
  counterparts of the decoders in `extension.js`. If you touch either side,
  re-verify the round-trip (below).

## Development & verification

- Run: open this folder in VS Code, press F5 — the dev host opens on
  `samples/`. Regenerate samples with `python3 scripts/make_test_tone.py`.
- There is no test framework. Verification is done ad hoc:
  - Syntax-check `extension.js` with macOS JavaScriptCore:
    `jsc` lives at `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc`;
    `load("extension.js")` throwing `ReferenceError: require` means the parse
    succeeded (a `SyntaxError` means it didn't). Extract the inline webview
    script (between `<script nonce="${nonce}">` and `</script>`) and check it
    the same way.
  - Codec changes: run an encode(decode(byte)) round-trip over all 256 byte
    values (port the Python encoder to JS and compare against the decode
    table). μ-law has one benign mismatch: byte 127 (−0) re-encodes as 255
    (+0). A-law must round-trip exactly.
  - Sample files: decode and count zero-crossings to confirm the 440 Hz tone.

## Releasing — TWO marketplaces, always publish to BOTH

The extension is distributed on two independent registries. Real VS Code users
install from the Microsoft Marketplace; Cursor/VSCodium/Windsurf users install
from Open VSX. **A release is not done until both are published** — skipping
ovsx silently strands every VS Code-fork user on the old version.

Checklist for a release:

1. Bump `version` in `package.json` (semver; features = minor).
2. Add a `CHANGELOG.md` entry.
3. Verify (syntax check at minimum; codec round-trip if decode paths changed).
4. Commit and push to GitHub (`gsdv/ulaw-8000-audio-player`).
5. Publish to the **Microsoft Marketplace**:
   `VSCE_PAT=<token> npx @vscode/vsce publish`
   (PAT: dev.azure.com → Personal Access Tokens, organization "All accessible
   organizations", scope Marketplace → Manage.)
6. Publish to **Open VSX**:
   `npx ovsx publish -p <token>`
   (Token: open-vsx.org → Settings → Access Tokens. The namespace
   `GabrieleScottodiVettimo` is already created and owned.)
7. Attach the `.vsix` to a GitHub release for manual installs:
   `npx @vscode/vsce package && gh release create v<X.Y.Z> <file>.vsix`
8. Optionally install locally: `code --install-extension <file>.vsix`
   (open windows then show "Restart Required" — expected).

Token handling: tokens are never stored in this repo or in config. Ask Gab for
fresh ones at publish time; he rotates them afterwards. Marketplace listing
identity: the extension ID `GabrieleScottodiVettimo.ulaw-8000-audio-player` is
permanent (changing `name`/`publisher` would create a new, separate listing and
orphan existing installs); only `displayName` is safely renameable.

Both registries index new versions within minutes; a brand-new listing or
namespace can take longer (automated scan / first-publish moderation).
