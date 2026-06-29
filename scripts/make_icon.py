#!/usr/bin/env python3
"""Generate the PianoCoach app icon as a 1024×1024 PNG (pure stdlib, no deps).

A rounded indigo tile with a piano keyboard and a little music note — matching
the app's theme. Usage: python3 make_icon.py <output.png>

To use your own icon instead: drop a 1024×1024 PNG and re-run scripts/build_app.sh
(or just replace Contents/Resources/PianoCoach.icns in the built bundle).
"""

import struct
import sys
import zlib

W = H = 1024
px = bytearray(W * H * 4)  # RGBA, starts fully transparent


def put(x: int, y: int, c: tuple[int, int, int]) -> None:
    if 0 <= x < W and 0 <= y < H:
        i = (y * W + x) * 4
        px[i], px[i + 1], px[i + 2], px[i + 3] = c[0], c[1], c[2], 255


def inside_rrect(x: int, y: int, x0: int, y0: int, x1: int, y1: int, r: int) -> bool:
    if x < x0 or x >= x1 or y < y0 or y >= y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def fill_rrect(x0, y0, x1, y1, r, col) -> None:
    for y in range(y0, y1):
        for x in range(x0, x1):
            if inside_rrect(x, y, x0, y0, x1, y1, r):
                put(x, y, col)


def fill_circle(cx, cy, r, col) -> None:
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                put(x, y, col)


def draw() -> None:
    # Rounded background with a vertical indigo gradient (#6366f1 → #4f46e5).
    m, rad = 40, 210
    x0, y0, x1, y1 = m, m, W - m, H - m
    for y in range(y0, y1):
        t = (y - y0) / (y1 - y0)
        col = (
            int(0x63 + (0x4F - 0x63) * t),
            int(0x66 + (0x46 - 0x66) * t),
            int(0xF8 + (0xE5 - 0xF8) * t),
        )
        for x in range(x0, x1):
            if inside_rrect(x, y, x0, y0, x1, y1, rad):
                put(x, y, col)

    # Music note (amber) above the keyboard.
    amber = (245, 185, 85)
    fill_circle(498, 360, 42, amber)
    for y in range(248, 360):
        for x in range(536, 552):
            put(x, y, amber)

    # Keyboard panel (white) + separators + black keys.
    kx0, kx1, ky0, ky1 = 246, 778, 442, 786
    fill_rrect(kx0, ky0, kx1, ky1, 26, (244, 246, 251))

    nkeys = 7
    kw = (kx1 - kx0) / nkeys
    sep = (38, 46, 68)
    for k in range(1, nkeys):
        lx = round(kx0 + k * kw)
        for y in range(ky0 + 8, ky1 - 8):
            for dx in (-2, -1, 0, 1):
                put(lx + dx, y, sep)

    bw = int(kw * 0.54)
    bh = int((ky1 - ky0) * 0.6)
    for k in (1, 2, 4, 5, 6):  # black-key pattern
        cx = kx0 + k * kw
        for y in range(ky0, ky0 + bh):
            for x in range(int(cx - bw / 2), int(cx + bw / 2)):
                put(x, y, (20, 25, 38))


def write_png(path: str) -> None:
    raw = bytearray()
    for y in range(H):
        raw.append(0)  # PNG filter: none
        raw += px[y * W * 4 : (y + 1) * W * 4]
    comp = zlib.compress(bytes(raw), 9)

    def chunk(typ: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + typ
            + data
            + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
        )

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", comp))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "icon.png"
    draw()
    write_png(out)
    print(f"icône écrite : {out}")
