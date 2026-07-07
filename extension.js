// ulaw_8000 Audio Player — a read-only custom editor that plays raw G.711 μ-law
// 8 kHz mono audio files. The whole extension is dependency-free: the file's
// bytes are embedded into the webview as base64 and decoded to PCM there.
const path = require('path');
const crypto = require('crypto');
const vscode = require('vscode');

function activate(context) {
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(
			'ulaw8000AudioPlayer.player',
			new UlawPlayerProvider(),
			{
				supportsMultipleEditorsPerDocument: true,
				// Keep the webview alive when the tab is backgrounded so playback
				// position (and playing audio) survives tab switches.
				webviewOptions: { retainContextWhenHidden: true },
			},
		),
	);
}

class UlawPlayerProvider {
	async openCustomDocument(uri) {
		return { uri, dispose() {} };
	}

	async resolveCustomEditor(document, webviewPanel) {
		const bytes = await vscode.workspace.fs.readFile(document.uri);

		webviewPanel.webview.options = { enableScripts: true };
		webviewPanel.webview.html = renderPlayerHtml({
			fileName: path.posix.basename(document.uri.path),
			base64: Buffer.from(bytes).toString('base64'),
		});
	}
}

function escapeHtml(s) {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function renderPlayerHtml({ fileName, base64 }) {
	const nonce = crypto.randomBytes(16).toString('hex');

	// The inline script below deliberately avoids backticks and ${} so it can
	// live inside this template literal without escaping.
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
	body {
		font-family: var(--vscode-font-family);
		color: var(--vscode-foreground);
		display: flex;
		justify-content: center;
		padding: 24px 16px;
	}
	.player {
		width: 100%;
		max-width: 720px;
	}
	.filename {
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 2px;
		word-break: break-all;
	}
	.meta {
		font-size: 11px;
		opacity: 0.7;
		margin-bottom: 14px;
	}
	.wave {
		width: 100%;
		height: 110px;
		display: block;
		cursor: pointer;
		border-radius: 4px;
		background: color-mix(in srgb, var(--vscode-foreground) 4%, transparent);
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 10px;
	}
	button {
		font-family: inherit;
		font-size: 13px;
		width: 64px;
		padding: 5px 0;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: var(--vscode-button-foreground);
		background: var(--vscode-button-background);
	}
	button:hover { background: var(--vscode-button-hoverBackground); }
	.time {
		font-variant-numeric: tabular-nums;
		font-size: 12px;
		opacity: 0.9;
	}
	.hint {
		margin-left: auto;
		font-size: 11px;
		opacity: 0.5;
	}
</style>
</head>
<body>
	<script type="text/plain" id="audio-data">${base64}</script>
	<div class="player">
		<div class="filename">${escapeHtml(fileName)}</div>
		<div class="meta" id="meta"></div>
		<canvas class="wave" id="wave"></canvas>
		<div class="controls">
			<button id="toggle">Play</button>
			<span class="time" id="time"></span>
			<span class="hint">click waveform to seek &middot; space to play/pause</span>
		</div>
	</div>
<script nonce="${nonce}">
(function () {
	'use strict';

	var SAMPLE_RATE = 8000;

	// ---- Decode base64 -> mu-law bytes -> Float32 PCM ----
	var b64 = document.getElementById('audio-data').textContent.trim();
	var bin = atob(b64);
	var ulawBytes = new Uint8Array(bin.length);
	for (var i = 0; i < bin.length; i++) ulawBytes[i] = bin.charCodeAt(i);

	// G.711 mu-law expansion, ITU-T standard. Peak magnitude is 32124.
	var table = new Float32Array(256);
	for (var u = 0; u < 256; u++) {
		var x = ~u & 0xff;
		var sign = x & 0x80;
		var exponent = (x >> 4) & 0x07;
		var mantissa = x & 0x0f;
		var magnitude = (((mantissa << 3) + 0x84) << exponent) - 0x84;
		table[u] = (sign ? -magnitude : magnitude) / 32124;
	}

	var samples = new Float32Array(ulawBytes.length);
	for (var s = 0; s < ulawBytes.length; s++) samples[s] = table[ulawBytes[s]];

	var duration = samples.length / SAMPLE_RATE;

	document.getElementById('meta').textContent =
		'G.711 μ-law · 8000 Hz · mono · ' +
		formatBytes(ulawBytes.length) + ' · ' + formatTime(duration);

	// ---- Playback (Web Audio) ----
	var audioCtx = null;
	var buffer = null;
	var source = null;
	var playing = false;
	var offset = 0;         // seconds into the clip when paused / last started
	var startedAt = 0;      // audioCtx.currentTime when playback last started

	var toggleBtn = document.getElementById('toggle');

	function ensureAudio() {
		if (audioCtx) return;
		audioCtx = new AudioContext();
		buffer = audioCtx.createBuffer(1, samples.length, SAMPLE_RATE);
		buffer.getChannelData(0).set(samples);
	}

	function position() {
		if (!playing) return offset;
		return Math.min(duration, offset + audioCtx.currentTime - startedAt);
	}

	function play() {
		if (samples.length === 0) return;
		ensureAudio();
		if (offset >= duration) offset = 0;
		source = audioCtx.createBufferSource();
		source.buffer = buffer;
		source.connect(audioCtx.destination);
		source.onended = function () {
			playing = false;
			offset = 0;
			toggleBtn.textContent = 'Play';
		};
		source.start(0, offset);
		startedAt = audioCtx.currentTime;
		playing = true;
		toggleBtn.textContent = 'Pause';
	}

	function pause() {
		if (!playing) return;
		offset = position();
		source.onended = null;
		source.stop();
		playing = false;
		toggleBtn.textContent = 'Play';
	}

	function seek(t) {
		var wasPlaying = playing;
		if (playing) pause();
		offset = Math.max(0, Math.min(duration, t));
		if (wasPlaying) play();
	}

	toggleBtn.addEventListener('click', function () {
		if (playing) pause(); else play();
	});

	document.addEventListener('keydown', function (e) {
		if (e.code === 'Space') {
			e.preventDefault();
			if (playing) pause(); else play();
		}
	});

	// ---- Waveform ----
	var canvas = document.getElementById('wave');
	var g = canvas.getContext('2d');
	var peaks = [];

	function cssVar(name, fallback) {
		var v = getComputedStyle(document.body).getPropertyValue(name).trim();
		return v || fallback;
	}

	function computePeaks() {
		var w = canvas.clientWidth;
		peaks = new Array(w);
		var perCol = samples.length / w;
		for (var col = 0; col < w; col++) {
			var lo = 0, hi = 0;
			var from = Math.floor(col * perCol);
			var to = Math.min(samples.length, Math.ceil((col + 1) * perCol));
			for (var j = from; j < to; j++) {
				if (samples[j] < lo) lo = samples[j];
				if (samples[j] > hi) hi = samples[j];
			}
			peaks[col] = [lo, hi];
		}
	}

	function resize() {
		var dpr = window.devicePixelRatio || 1;
		canvas.width = canvas.clientWidth * dpr;
		canvas.height = canvas.clientHeight * dpr;
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		computePeaks();
	}

	function draw() {
		var w = canvas.clientWidth;
		var h = canvas.clientHeight;
		var mid = h / 2;
		var playedColor = cssVar('--vscode-progressBar-background', '#0e70c0');
		var restColor = cssVar('--vscode-editorLineNumber-foreground', '#858585');
		var progressX = duration > 0 ? (position() / duration) * w : 0;

		g.clearRect(0, 0, w, h);
		for (var col = 0; col < peaks.length; col++) {
			var lo = peaks[col][0];
			var hi = peaks[col][1];
			g.fillStyle = col <= progressX ? playedColor : restColor;
			// Give silence a visible 1px center line.
			var top = mid - hi * mid * 0.95;
			var height = Math.max(1, (hi - lo) * mid * 0.95);
			g.fillRect(col, top, 1, height);
		}

		g.fillStyle = playedColor;
		g.fillRect(progressX, 0, 1.5, h);

		document.getElementById('time').textContent =
			formatTime(position()) + ' / ' + formatTime(duration);

		requestAnimationFrame(draw);
	}

	canvas.addEventListener('click', function (e) {
		var rect = canvas.getBoundingClientRect();
		seek(((e.clientX - rect.left) / rect.width) * duration);
	});

	window.addEventListener('resize', resize);
	resize();
	requestAnimationFrame(draw);

	// ---- Formatting helpers ----
	function formatTime(t) {
		var m = Math.floor(t / 60);
		var sec = t - m * 60;
		var whole = Math.floor(sec);
		var tenth = Math.floor((sec - whole) * 10);
		return m + ':' + (whole < 10 ? '0' : '') + whole + '.' + tenth;
	}

	function formatBytes(n) {
		if (n < 1024) return n + ' B';
		if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
		return (n / (1024 * 1024)).toFixed(1) + ' MB';
	}
})();
</script>
</body>
</html>`;
}

module.exports = { activate };
