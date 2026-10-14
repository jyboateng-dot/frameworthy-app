#!/usr/bin/env python3
"""Generate a machine-readable inventory of collected Prodigi render sources."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PRODIGI = ROOT / "resources" / "prodigi"
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def record(path: Path, origin: str) -> dict:
    payload = path.read_bytes()
    item = {
        "origin": origin,
        "path": path.relative_to(ROOT).as_posix(),
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }
    if path.suffix.lower() in IMAGE_SUFFIXES:
        with Image.open(path) as image:
            item.update({
                "width": image.width,
                "height": image.height,
                "mode": image.mode,
                "hasAlpha": "A" in image.mode or "transparency" in image.info,
            })
    return item


def main() -> None:
    items = []
    for origin in ("source", "extracted"):
        for path in sorted((PRODIGI / origin).rglob("*")):
            if not path.is_file() or "__MACOSX" in path.parts or path.name == ".DS_Store":
                continue
            items.append(record(path, origin))

    result = {
        "assetCount": len(items),
        "sourceAssetCount": sum(item["origin"] == "source" for item in items),
        "extractedAssetCount": sum(item["origin"] == "extracted" for item in items),
        "totalBytes": sum(item["bytes"] for item in items),
        "assets": items,
    }
    destination = PRODIGI / "inventory.json"
    destination.write_text(json.dumps(result, indent=2) + "\n")
    print(f"Inventoried {len(items)} files")
    print(destination)


if __name__ == "__main__":
    main()
