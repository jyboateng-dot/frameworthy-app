#!/usr/bin/env python3
"""Copy the reviewed Prodigi render references into the app's public tree.

Raw supplier downloads remain immutable under resources/prodigi. This script
selects only the images the catalogue and 2D renderer use, gives them stable
URL-safe names, and avoids runtime hotlinking to Prodigi's site.
"""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "resources" / "prodigi"
DEST = ROOT / "public" / "prodigi"

FILES = {
    # Finish references used by the frame picker and visualizer.
    **{f"source/classic/classic-{name}.png": f"finishes/classic-{name}.png" for name in (
        "black", "white", "natural", "antique-silver", "brown", "antique-gold", "dark-grey", "light-grey"
    )},
    **{f"source/box/box-{name}.png": f"finishes/box-{name}.png" for name in ("black", "white", "natural")},
    **{f"source/aluminium/aluminium-{name}.png": f"finishes/aluminium-{name}.png" for name in ("black", "silver", "gold")},
    **{f"source/canvas-float/canvas-float-{name}.png": f"finishes/canvas-float-{name}.png" for name in (
        "black", "white", "antique-gold", "antique-silver", "natural", "brown"
    )},
    **{f"source/canvas-eco/eco-canvas-float-{name}.png": f"finishes/canvas-eco-{name}.png" for name in (
        "black", "white", "antique-gold", "antique-silver", "natural", "brown"
    )},
    # Product views and construction references.
    "extracted/classic/prodigi-classic-frames-photo-assets/Classic black framed print flat.jpg": "views/classic-product.jpg",
    "extracted/classic/prodigi-classic-frames-photo-assets/Classic black framed print near corner.jpg": "views/classic-corner.jpg",
    "extracted/classic/prodigi-classic-frames-photo-assets/Prodigi-classic-frame-back.jpg": "views/classic-back.jpg",
    "extracted/box/prodigi-box-frames-photo-assets/Box black framed print face on.jpg": "views/box-product.jpg",
    "extracted/box/prodigi-box-frames-photo-assets/Box black framed print end on.jpg": "views/box-profile.jpg",
    "extracted/box/prodigi-box-frames-photo-assets/Box frame cross-section.png": "diagrams/box-section.png",
    "source/aluminium/prodigi-black-aluminium-frame.webp": "views/aluminium-product.webp",
    "source/aluminium/prodigi-silver-aluminium-frame-detail.webp": "views/aluminium-silver.webp",
    "source/aluminium/gold-aluminium-frame-3-2.webp": "views/aluminium-gold.webp",
    "extracted/canvas-float/prodigi-framed-canvas-photo-assets/White framed canvas.jpg": "views/canvas-float-product.jpg",
    "extracted/canvas-float/prodigi-framed-canvas-photo-assets/Black framed canvas near corner.jpg": "views/canvas-float-corner.jpg",
    "extracted/canvas-float/prodigi-framed-canvas-photo-assets/Canvas framed black end-on.jpg": "views/canvas-float-profile.jpg",
    "extracted/canvas-float/prodigi-framed-canvas-photo-assets/Framed canvas cross-section.png": "diagrams/canvas-float-section.png",
    "source/canvas-classic/prodigi-classic-framed-19mm-canvas-natural.webp": "views/canvas-classic-product.webp",
    "source/canvas-classic/prodigi-classic-framed-canvas-19mm-corner.webp": "views/canvas-classic-corner.webp",
    "source/canvas-classic/framed-canvas-19mm-full.webp": "views/canvas-classic-profile.webp",
    "source/canvas-eco/eco-framed-canvas_3.webp": "views/canvas-eco-product.webp",
    "source/canvas-eco/eco-framed-canvas_2.webp": "views/canvas-eco-detail.webp",
    "source/canvas-eco/eco-framed-canvas_1.webp": "views/canvas-eco-profile.webp",
    "extracted/stretched-canvas/prodigi-stretched-canvas-photo-assets/Stretched 38mm canvas.jpg": "views/stretched-canvas-product.jpg",
    "extracted/stretched-canvas/prodigi-stretched-canvas-photo-assets/Stretched 38mm canvas corner.jpg": "views/stretched-canvas-corner.jpg",
    "extracted/stretched-canvas/prodigi-stretched-canvas-photo-assets/Canvas-substrate-texture.jpg": "views/stretched-canvas-texture.jpg",
    "extracted/stretched-canvas/prodigi-stretched-canvas-photo-assets/White edge 38mm canvas.jpg": "views/stretched-canvas-white-edge.jpg",
    "extracted/stretched-canvas/prodigi-stretched-canvas-photo-assets/Image wrap on a 38mm stretched canvas.jpg": "views/stretched-canvas-image-wrap.jpg",
    "extracted/stretched-canvas/prodigi-stretched-canvas-photo-assets/Mirror wrap on a 38mm stretched canvas.jpg": "views/stretched-canvas-mirror-wrap.jpg",
    "extracted/stretched-canvas/prodigi-stretched-canvas-photo-assets/Black wrap on a 38mm stretched canvas.jpg": "views/stretched-canvas-black-wrap.jpg",
    "extracted/stretched-canvas/prodigi-stretched-canvas-photo-assets/White wrap on a 38mm stretched canvas.jpg": "views/stretched-canvas-white-wrap.jpg",
    "extracted/stretched-canvas/prodigi-stretched-canvas-photo-assets/Prodigi-global-canvas-8x10-blank.jpg": "views/stretched-canvas-blank.jpg",
}


def main() -> None:
    copied = 0
    for source_name, dest_name in FILES.items():
        source = SOURCE / source_name
        if not source.is_file():
            raise FileNotFoundError(source)
        destination = DEST / dest_name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied += 1
    print(f"Prepared {copied} audited Prodigi app assets in {DEST}")


if __name__ == "__main__":
    main()
