import os
import sys
import re
import urllib.request
import time

try:
    with open("all_paintings_list.txt", "r", encoding="utf-16") as f:
        RAW_FILES = [line.strip() for line in f if line.strip()]
except Exception as e:
    with open("all_paintings_list.txt", "r", encoding="utf-8") as f:
        RAW_FILES = [line.strip() for line in f if line.strip()]

BASE_URL = "https://www.bubolaenaibo.com/wp-content/uploads/"
OUT_DIR = "C:\\Users\\HP ELITEBOOK\\Desktop\\FrameWorthy_App\\public\\paintings"

# Set up global opener with standard headers
opener = urllib.request.build_opener()
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')]
urllib.request.install_opener(opener)

def main():
    print("Starting direct stream sequential downloader...", flush=True)
    
    success_count = 0
    total_files = len(RAW_FILES)

    for idx, path in enumerate(RAW_FILES):
        filename = path.split('/')[-1]
        base_name = re.sub(r'-\d+x\d+\.jpg$', '.jpg', filename)
        folder_prefix = "/".join(path.split('/')[:-1]) + "/"
        full_res_url = BASE_URL + folder_prefix + base_name
        local_path = os.path.join(OUT_DIR, base_name)
        
        # Skip existing files
        if os.path.exists(local_path) and os.path.getsize(local_path) > 10000:
            success_count += 1
            continue

        print(f"[{idx+1}/{total_files}] Downloading {base_name}...", flush=True)
        downloaded = False
        
        # Sequentially request and write in small chunks to prevent network socket blocks
        for attempt in range(5):
            try:
                req = urllib.request.Request(full_res_url)
                with urllib.request.urlopen(req, timeout=12) as response:
                    with open(local_path, 'wb') as out_file:
                        while True:
                            chunk = response.read(16384) # 16kb chunks
                            if not chunk:
                                break
                            out_file.write(chunk)
                
                if os.path.exists(local_path) and os.path.getsize(local_path) > 10000:
                    print(f"-> Success: {base_name}", flush=True)
                    downloaded = True
                    success_count += 1
                    break
            except Exception as e:
                # Fallback to thumbnail URL if original yields 404
                if "404" in str(e):
                    thumb_url = BASE_URL + path
                    try:
                        req_thumb = urllib.request.Request(thumb_url)
                        with urllib.request.urlopen(req_thumb, timeout=12) as response:
                            with open(local_path, 'wb') as out_file:
                                while True:
                                    chunk = response.read(16384)
                                    if not chunk:
                                        break
                                    out_file.write(chunk)
                        if os.path.exists(local_path) and os.path.getsize(local_path) > 10000:
                            print(f"-> Fallback Success: {base_name}", flush=True)
                            downloaded = True
                            success_count += 1
                            break
                    except Exception:
                        pass
                
                # Cooldown backoff delay
                time.sleep(3)
        
        if not downloaded:
            print(f"-> FAILED permanently: {base_name}", flush=True)
            # Remove partial files if failed
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                except Exception:
                    pass
            
        # Standard cooldown sleep
        time.sleep(1.0)

    print(f"Completed stream download. Total successfully downloaded: {success_count}/{total_files}", flush=True)

if __name__ == '__main__':
    main()
