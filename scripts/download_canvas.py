import os, re, urllib.request, time

with open('canvas_urls.txt', 'r', encoding='utf-8') as f:
    PATHS = [line.strip() for line in f if line.strip()]

BASE_URL = 'https://www.bubolaenaibo.com/'
OUT_DIR = 'public/canvas'
os.makedirs(OUT_DIR, exist_ok=True)

opener = urllib.request.build_opener()
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]
urllib.request.install_opener(opener)

success = 0
total = len(PATHS)
print(f"Downloading {total} canvas art images...", flush=True)

for idx, path in enumerate(PATHS):
    filename = path.split('/')[-1]
    local_path = os.path.join(OUT_DIR, filename)

    if os.path.exists(local_path) and os.path.getsize(local_path) > 10000:
        success += 1
        print(f"[{idx+1}/{total}] SKIPPED (already have): {filename}", flush=True)
        continue

    print(f"[{idx+1}/{total}] Downloading {filename}...", flush=True)
    full_url = BASE_URL + path
    downloaded = False

    for attempt in range(4):
        try:
            req = urllib.request.Request(full_url)
            with urllib.request.urlopen(req, timeout=25) as resp:
                with open(local_path, 'wb') as f:
                    while True:
                        chunk = resp.read(16384)
                        if not chunk:
                            break
                        f.write(chunk)
            size = os.path.getsize(local_path) if os.path.exists(local_path) else 0
            if size > 10000:
                print(f"  -> OK ({size//1024} KB)", flush=True)
                downloaded = True
                success += 1
                break
            else:
                if os.path.exists(local_path):
                    os.remove(local_path)
        except Exception as e:
            print(f"  -> Attempt {attempt+1} failed: {e}", flush=True)
            time.sleep(3 * (attempt + 1))

    if not downloaded:
        if os.path.exists(local_path):
            os.remove(local_path)
        print(f"  -> FAILED permanently: {filename}", flush=True)
    else:
        time.sleep(0.6)

print(f"\nDone: {success}/{total} canvas images downloaded to public/canvas/", flush=True)
