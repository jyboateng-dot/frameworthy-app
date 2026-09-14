"""Generate pixel-aligned transparent foreground PNGs for room-scene objects.

Run this after replacing the conservative rectangles below with a reviewed
foreground mask for each source image. The app draws these PNGs over the frame.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).parents[1]
ROOMS = {
    # id: source image, rectangle enclosing the furniture group
    'studio-loft': ('studio-loft-photoreal.png', (250, 670, 1040, 330)),
    'dining-room': ('dining-room-photoreal.png', (0, 600, 1536, 424)),
    'bedroom': ('bedroom-photoreal.png', (180, 560, 1180, 464)),
    'entryway': ('entryway-photoreal.png', (420, 470, 540, 465)),
    'home-office': ('home-office-photoreal.png', (0, 470, 1536, 554)),
}
for room, (file_name, rect) in ROOMS.items():
    source = ROOT / 'public' / 'rooms' / file_name
    image = cv2.imread(str(source), cv2.IMREAD_COLOR)
    mask = np.zeros(image.shape[:2], np.uint8)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(image, mask, rect, bgd, fgd, 8, cv2.GC_INIT_WITH_RECT)
    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    rgba = cv2.cvtColor(image, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = alpha
    Image.fromarray(rgba).save(ROOT / 'public' / 'rooms' / f'{room}-foreground.png')
