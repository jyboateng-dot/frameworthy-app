import os, shutil

moves = [
    ('public/paintings',  'public/inspiration/original-paintings'),
    ('public/prestige',   'public/inspiration/original-paintings-prestige'),
    ('public/canvas',     'public/inspiration/canvas-art'),
    ('public/glossy',     'public/inspiration/glossy-art'),
]

for src, dst in moves:
    if not os.path.exists(src):
        print(f"SKIP (missing): {src}")
        continue
    os.makedirs(dst, exist_ok=True)
    files = os.listdir(src)
    moved = 0
    for f in files:
        shutil.move(os.path.join(src, f), os.path.join(dst, f))
        moved += 1
    os.rmdir(src)
    print(f"Moved {moved} files: {src} -> {dst}")

print("\nNew structure:")
for _, dst in moves:
    count = len(os.listdir(dst)) if os.path.exists(dst) else 0
    print(f"  {dst}  ({count} files)")
