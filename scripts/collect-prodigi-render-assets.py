#!/usr/bin/env python3
"""Collect official Prodigi reference assets used to design frame renderers.

Source files are kept under resources rather than public so raw photography and
PDFs are not shipped in the application bundle. The generated manifest records
the origin, hash, media type, and size of every downloaded file.
"""

from __future__ import annotations

import hashlib
import json
import mimetypes
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "resources" / "prodigi" / "source"
USER_AGENT = "FrameWorthy asset audit/1.0"


ASSETS = {
    "colour-profiles": [
        *[
            f"https://www.prodigi.com/download/colour-profiles/{name}.icc"
            for name in (
                "prodigi-budget-art-paper-180gsm-bap",
                "prodigi-cold-press-watercolour-paper-315gsm-cpwp",
                "prodigi-enhanced-matt-art-paper-200gsm-ema",
                "prodigi-hahnemuhle-german-etching-310gsm-hge",
                "prodigi-hahnemuhle-photo-rag-308gsm-hpr",
                "prodigi-lustre-photo-paper-240gsm-lpp",
                "prodigi-smooth-art-paper-240gsm-sap",
                "prodigi-metallic-canvas-440gsm-mc",
                "prodigi-standard-canvas-400gsm-sc",
            )
        ],
    ],
    "classic": [
        "https://www.prodigi.com/download/product-range/classic-frames/prodigi-classic-frames-photo-assets.zip",
        "https://www.prodigi.com/download/blanks/prodigi-classic-frame-blanks.zip",
        "https://www.prodigi.com/download/product-range/Prodigi%20Classic%20frames.pdf",
        *[
            f"https://www.prodigi.com/img/products/chevrons/classic-{color}.png"
            for color in ("black", "white", "natural", "antique-silver", "brown", "antique-gold", "dark-grey", "light-grey")
        ],
        *[
            f"https://www.prodigi.com/img/products/swatches/frame-classic-{color}.{extension}"
            for color, extension in (
                ("black", "png"), ("white", "png"), ("natural", "jpg"), ("antique-silver", "jpg"),
                ("brown", "png"), ("antique-gold", "jpg"), ("dark-grey", "png"), ("light-grey", "png"),
            )
        ],
    ],
    "box": [
        "https://www.prodigi.com/download/product-range/box-frames/prodigi-box-frames-photo-assets.zip",
        "https://www.prodigi.com/download/product-range/Prodigi%20Box%20frames.pdf",
        *[
            f"https://www.prodigi.com/img/products/chevrons/box-{color}.png"
            for color in ("black", "white", "natural")
        ],
    ],
    "aluminium": [
        "https://www.prodigi.com/download/blanks/prodigi-aluminium-frames-blank-assets.zip",
        "https://www.prodigi.com/download/product-range/Prodigi%20Aluminium%20frames.pdf",
        *[
            f"https://www.prodigi.com/img/products/additional/aluminium-frames/{name}"
            for name in (
                "prodigi-aluminium-metal-frames.webp",
                "prodigi-silver-aluminium-frame-detail.webp",
                "gold-aluminium-frame-3-2.webp",
                "prodigi-aluminium-metal-frames-detail.webp",
                "black-aluminium-frame-3-2.webp",
                "prodigi-black-aluminium-frame.webp",
                "prodigi-gold-aluminium-frame.webp",
                "prodigi-silver-aluminium-frame-2.webp",
            )
        ],
        *[
            f"https://www.prodigi.com/img/products/chevrons/aluminium-{color}.png"
            for color in ("black", "silver", "gold")
        ],
    ],
    "canvas-float": [
        "https://www.prodigi.com/download/product-range/framed-canvas/prodigi-framed-canvas-photo-assets.zip",
        "https://www.prodigi.com/download/product-range/Prodigi%20Framed%20canvas.pdf",
        *[
            f"https://www.prodigi.com/img/products/chevrons/canvas-float-{color}.png"
            for color in ("black", "white", "antique-gold", "antique-silver", "natural", "brown")
        ],
    ],
    "canvas-classic": [
        "https://www.prodigi.com/download/product-range/Prodigi%20Classic%20framed%20canvas.pdf",
        *[
            f"https://www.prodigi.com/img/products/additional/classic-framed-canvas/{name}"
            for name in (
                "classic-frame-canvas-woman-print-a_.webp",
                "prodigi-classic-framed-19mm-canvas-natural.webp",
                "classic-frame-canvas-bikes-print-d_.webp",
                "framed-canvas-19mm-full.webp",
                "30x40-classic-framed-canvas-sq.webp",
                "19mm-classic-frame_--group_.webp",
                "prodigi-classic-framed-canvas-19mm-corner.webp",
                "classic-frame-colour-range-updated-2025.webp",
            )
        ],
    ],
    "canvas-eco": [
        "https://www.prodigi.com/download/product-range/Prodigi%20Eco%20framed%20canvas.pdf",
        *[
            f"https://www.prodigi.com/img/products/additional/eco-framed-canvas/{name}"
            for name in (
                "eco-framed-canvas_3.webp",
                "eco-framed-canvas_2.webp",
                "eco-framed-canvas_1.webp",
                "float-frame-chevrons.webp",
            )
        ],
        *[
            f"https://www.prodigi.com/img/products/chevrons/eco-canvas-float-{color}.png"
            for color in ("black", "white", "antique-gold", "antique-silver", "natural", "brown")
        ],
    ],
    "stretched-canvas": [
        "https://www.prodigi.com/download/product-range/stretched-canvas/prodigi-stretched-canvas-photo-assets.zip",
        "https://www.prodigi.com/download/product-range/Prodigi%20Stretched%20canvas.pdf",
        *[
            f"https://www.prodigi.com/img/products/custom/stretched-canvas/{name}-edge.webp"
            for name in ("white", "black")
        ],
        "https://www.prodigi.com/img/products/custom/stretched-canvas/image-wrap.webp",
        "https://www.prodigi.com/img/products/custom/stretched-canvas/mirror-wrap.webp",
    ],
}


def filename_for(url: str) -> str:
    return unquote(Path(urlparse(url).path).name)


def download(url: str, destination: Path) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request) as response:
        payload = response.read()
    destination.write_bytes(payload)
    return payload


def main() -> None:
    records = []
    for family, urls in ASSETS.items():
        family_dir = DESTINATION / family
        family_dir.mkdir(parents=True, exist_ok=True)
        for url in urls:
            destination = family_dir / filename_for(url)
            payload = destination.read_bytes() if destination.exists() else download(url, destination)
            records.append({
                "family": family,
                "path": destination.relative_to(ROOT).as_posix(),
                "sourceUrl": url,
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "mediaType": mimetypes.guess_type(destination.name)[0] or "application/octet-stream",
            })

    manifest = {
        "provider": "Prodigi",
        "purpose": "Reference sources for FrameWorthy 2D, 3D, and AR render asset derivation",
        "shippingPolicy": "Source files are stored outside public and are not bundled into the app",
        "assets": records,
    }
    manifest_path = DESTINATION.parent / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Collected {len(records)} assets ({sum(item['bytes'] for item in records):,} bytes)")
    print(manifest_path)


if __name__ == "__main__":
    main()
