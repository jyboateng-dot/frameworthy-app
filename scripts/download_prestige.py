import os
import re
import urllib.request
import time

with open('prestige_urls.txt', 'r', encoding='utf-8') as f:
    PATHS = [line.strip() for line in f if line.strip()]

BASE_URL = 'https://www.bubolaenaibo.com/'
OUT_DIR = 'public/prestige'
os.makedirs(OUT_DIR, exist_ok=True)

opener = urllib.request.build_opener()
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]
urllib.request.install_opener(opener)

success = 0
total = len(PATHS)
print(f"Downloading {total} prestige paintings...", flush=True)

for idx, path in enumerate(PATHS):
    filename = path.split('/')[-1]
    # Strip dimensions suffix to get original filename
    base_name = re.sub(r'-\d+x\d+\.jpg$', '.jpg', filename)
    folder = '/'.join(path.split('/')[:-1]) + '/'
    full_res_url = BASE_URL + folder + base_name
    local_path = os.path.join(OUT_DIR, base_name)

    if os.path.exists(local_path) and os.path.getsize(local_path) > 10000:
        success += 1
        continue

    print(f"[{idx+1}/{total}] {base_name}...", flush=True)
    downloaded = False

    for attempt in range(4):
        try:
            req = urllib.request.Request(full_res_url)
            with urllib.request.urlopen(req, timeout=20) as resp:
                with open(local_path, 'wb') as f:
                    while True:
                        chunk = resp.read(16384)
                        if not chunk:
                            break
                        f.write(chunk)
            if os.path.exists(local_path) and os.path.getsize(local_path) > 10000:
                print(f"  -> OK ({os.path.getsize(local_path)//1024} KB)", flush=True)
                downloaded = True
                success += 1
                break
        except Exception as e:
            # fallback: thumbnail version
            if '404' in str(e):
                thumb_url = BASE_URL + path
                try:
                    req2 = urllib.request.Request(thumb_url)
                    with urllib.request.urlopen(req2, timeout=20) as resp:
                        with open(local_path, 'wb') as f:
                            while True:
                                chunk = resp.read(16384)
                                if not chunk:
                                    break
                                f.write(chunk)
                    if os.path.exists(local_path) and os.path.getsize(local_path) > 1000:
                        print(f"  -> Fallback OK", flush=True)
                        downloaded = True
                        success += 1
                        break
                except Exception:
                    pass
            time.sleep(2 * (attempt + 1))

    if not downloaded:
        if os.path.exists(local_path):
            os.remove(local_path)
        print(f"  -> FAILED: {base_name}", flush=True)

    time.sleep(0.8)

print(f"\nDone: {success}/{total} prestige paintings downloaded.", flush=True)
