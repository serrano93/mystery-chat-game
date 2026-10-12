"""Genera los iconos PNG de la PWA replicando public/favicon.svg.

Se dibuja a 4x y se reduce con LANCZOS para obtener bordes suavizados.
Salidas: public/icons/pwa-192x192.png, public/icons/pwa-512x512.png,
         public/apple-touch-icon.png
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"
ICONS.mkdir(parents=True, exist_ok=True)

BASE = 512
SS = 4  # supersampling
S = BASE * SS

START = np.array([0x10, 0xB9, 0x81], dtype=np.float64)  # #10b981
END = np.array([0x0F, 0x17, 0x2A], dtype=np.float64)  # #0f172a

OPACITY = 0.95  # opacity de la silueta clara en el SVG


def gradient(size: int) -> Image.Image:
    y, x = np.mgrid[0:size, 0:size]
    t = ((x + y) / (2 * (size - 1)))[..., None]
    rgb = (START * (1 - t) + END * t).astype(np.uint8)
    return Image.fromarray(rgb, mode="RGB").convert("RGBA")


def bezier(p0, p1, p2, p3, steps=600):
    pts = []
    for i in range(steps + 1):
        u = i / steps
        v = 1 - u
        x = v**3 * p0[0] + 3 * v**2 * u * p1[0] + 3 * v * u**2 * p2[0] + u**3 * p3[0]
        y = v**3 * p0[1] + 3 * v**2 * u * p1[1] + 3 * v * u**2 * p2[1] + u**3 * p3[1]
        pts.append((x, y))
    return pts


def build() -> Image.Image:
    # 1. Fondo: gradiente diagonal recortado a rectángulo redondeado.
    bg = gradient(S)
    rounded = Image.new("L", (S, S), 0)
    ImageDraw.Draw(rounded).rounded_rectangle([0, 0, S - 1, S - 1], radius=112 * SS, fill=255)
    bg.putalpha(rounded)

    # 2. Silueta clara (cabeza + arco) sobre una máscara de cobertura.
    #    El trazo se estampa con discos en lugar de ImageDraw.line: line une los
    #    segmentos dejando estrías, y los discos dan extremos redondeados limpios
    #    (equivalente a stroke-linecap="round").
    shapes = Image.new("L", (S, S), 0)
    sd = ImageDraw.Draw(shapes)

    def disc(cx, cy, r):
        sd.ellipse(
            [cx * SS - r * SS, cy * SS - r * SS, cx * SS + r * SS, cy * SS + r * SS], fill=255
        )

    disc(256, 230, 86)  # cabeza
    for x, y in bezier((180, 330), (205, 285), (307, 285), (332, 330)):
        disc(x, y, 14)  # trazo de 28 de ancho

    # 3. La silueta se compone UNA sola vez al 95%, para que los solapes no
    #    acumulen alfa y la densidad quede uniforme en toda la figura.
    white = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    white.putalpha(shapes.point(lambda v: int(round(v * OPACITY))))
    out = Image.alpha_composite(bg, white)

    # 4. Ojos, opacos, por encima.
    eyes = ImageDraw.Draw(out)
    for cx, cy in ((225, 215), (287, 215)):
        r = 12 * SS
        eyes.ellipse(
            [cx * SS - r, cy * SS - r, cx * SS + r, cy * SS + r], fill=(0x0F, 0x17, 0x2A, 255)
        )

    return out


def main() -> None:
    master = build()
    for size, target in (
        (512, ICONS / "pwa-512x512.png"),
        (192, ICONS / "pwa-192x192.png"),
        (180, PUBLIC / "apple-touch-icon.png"),
    ):
        master.resize((size, size), Image.LANCZOS).save(target, "PNG", optimize=True)
        print(f"escrito {target.relative_to(ROOT)} ({size}x{size})")


if __name__ == "__main__":
    main()
