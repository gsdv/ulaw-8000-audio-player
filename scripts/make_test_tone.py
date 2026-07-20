#!/usr/bin/env python3
"""Generate samples/tone-440hz.ulaw_8000, samples/tone-440hz.alaw and
samples/tone-440hz.pcm_8000: 2s of 440 Hz sine with fade in/out, encoded as
raw G.711 (and raw s16le PCM) at 8000 Hz mono."""
import math
import os
import struct

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


# Segment upper bounds for A-law compression (classic Sun g711.c tables).
ALAW_SEG_END = [0xFF, 0x1FF, 0x3FF, 0x7FF, 0xFFF, 0x1FFF, 0x3FFF, 0x7FFF]


def linear_to_alaw(sample):
    """Encode a 16-bit signed sample to G.711 A-law (ITU-T standard).
    Unlike mu-law, the sign bit set means positive, and the whole byte is
    XORed with 0x55."""
    if sample >= 0:
        mask = 0xD5
    else:
        mask = 0x55
        sample = -sample - 8
    seg = next((i for i, end in enumerate(ALAW_SEG_END) if sample <= end), 8)
    if seg >= 8:
        return 0x7F ^ mask
    aval = seg << 4
    shift = 4 if seg < 2 else seg + 3
    aval |= (sample >> shift) & 0x0F
    return aval ^ mask


def main():
    n = int(SAMPLE_RATE * DURATION_S)
    fade_n = int(SAMPLE_RATE * FADE_S)
    ulaw_out = bytearray(n)
    alaw_out = bytearray(n)
    pcm_out = bytearray(n * 2)
    for i in range(n):
        envelope = min(1.0, i / fade_n, (n - 1 - i) / fade_n)
        value = AMPLITUDE * envelope * math.sin(2 * math.pi * FREQ_HZ * i / SAMPLE_RATE)
        ulaw_out[i] = linear_to_ulaw(int(value * 32124))
        alaw_out[i] = linear_to_alaw(int(value * 32256))
        struct.pack_into("<h", pcm_out, i * 2, int(value * 32767))

    out_dir = os.path.join(os.path.dirname(__file__), "..", "samples")
    os.makedirs(out_dir, exist_ok=True)
    for name, data in [
        ("tone-440hz.ulaw_8000", ulaw_out),
        ("tone-440hz.alaw", alaw_out),
        ("tone-440hz.pcm_8000", pcm_out),
    ]:
        out_path = os.path.join(out_dir, name)
        with open(out_path, "wb") as f:
            f.write(data)
        print(f"wrote {out_path} ({len(data)} bytes, {DURATION_S}s)")


if __name__ == "__main__":
    main()
