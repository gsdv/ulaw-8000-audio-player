#!/usr/bin/env python3
"""Generate samples/tone-440hz.ulaw_8000: 2s of 440 Hz sine with fade in/out,
encoded as raw G.711 mu-law at 8000 Hz mono."""
import math
import os

SAMPLE_RATE = 8000
DURATION_S = 2.0
FREQ_HZ = 440.0
AMPLITUDE = 0.5
FADE_S = 0.05


def linear_to_ulaw(sample):
    """Encode a 16-bit signed sample to G.711 mu-law (ITU-T standard)."""
    BIAS, CLIP = 0x84, 32635
    sign = 0x80 if sample < 0 else 0
    magnitude = min(abs(sample), CLIP) + BIAS
    exponent = 7
    mask = 0x4000
    while exponent > 0 and not magnitude & mask:
        mask >>= 1
        exponent -= 1
    mantissa = (magnitude >> (exponent + 3)) & 0x0F
    return ~(sign | (exponent << 4) | mantissa) & 0xFF


def main():
    n = int(SAMPLE_RATE * DURATION_S)
    fade_n = int(SAMPLE_RATE * FADE_S)
    out = bytearray(n)
    for i in range(n):
        envelope = min(1.0, i / fade_n, (n - 1 - i) / fade_n)
        value = AMPLITUDE * envelope * math.sin(2 * math.pi * FREQ_HZ * i / SAMPLE_RATE)
        out[i] = linear_to_ulaw(int(value * 32124))

    out_dir = os.path.join(os.path.dirname(__file__), "..", "samples")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "tone-440hz.ulaw_8000")
    with open(out_path, "wb") as f:
        f.write(out)
    print(f"wrote {out_path} ({len(out)} bytes, {DURATION_S}s)")


if __name__ == "__main__":
    main()
