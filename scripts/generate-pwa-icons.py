#!/usr/bin/env python3
"""Generate PWA / iOS icons from the TRONX brand mark (see app/icon.svg).

Usage: python3 scripts/generate-pwa-icons.py   (requires Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BG = (23, 23, 23, 255)
FG = (255, 255, 255, 255)
SS = 4  # supersampling for smooth edges

# "T" glyph from app/icon.svg, in a 64x64 viewBox.
GLYPH = [(17, 18), (47, 18), (47, 27), (36, 27), (36, 48), (28, 48), (28, 27), (17, 27)]


def render(size, rounded, glyph_scale):
    s = size * SS
    k = s / 64
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:  # 'any' icon: rounded tile with transparent corners
        d.rounded_rectangle([2 * k, 2 * k, 62 * k, 62 * k], radius=15 * k, fill=BG)
    else:  # full-bleed: iOS / Android maskable apply their own mask
        d.rectangle([0, 0, s, s], fill=BG)
    cx, cy = 32, 33
    pts = [((cx + (x - cx) * glyph_scale) * k, (cy + (y - cy) * glyph_scale) * k) for x, y in GLYPH]
    d.polygon(pts, fill=FG)
    return img.resize((size, size), Image.LANCZOS)


JOBS = [
    ("icon-192.png", 192, True, 1.0),
    ("icon-512.png", 512, True, 1.0),
    ("icon-maskable-512.png", 512, False, 1.05),  # glyph kept inside 80% safe zone
    ("apple-touch-icon.png", 180, False, 1.25),  # opaque, iOS rounds corners itself
]

OUT.mkdir(parents=True, exist_ok=True)
for name, size, rounded, scale in JOBS:
    img = render(size, rounded, scale)
    if not rounded:
        img = img.convert("RGB")
    img.save(OUT / name, optimize=True)
    print("wrote", OUT / name)
