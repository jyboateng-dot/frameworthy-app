import os
import urllib.request
import json
import time

BASE_DIR = r"C:\Users\HP ELITEBOOK\Desktop\FrameWorthy_App\met_collection"
SEARCH_URL = "https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&q={}"
OBJECT_URL = "https://collectionapi.metmuseum.org/public/collection/v1/objects/{}"

MAX_DOWNLOADS_PER_FOLDER = 100

def sanitize_filename(name):
    return "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).rstrip()

def main():
    folders = [f for f in os.listdir(BASE_DIR) if os.path.isdir(os.path.join(BASE_DIR, f))]
    
    opener = urllib.request.build_opener()
    opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')]
    urllib.request.install_opener(opener)

    total_downloads = 0

    for folder in folders:
        folder_downloads = 0
            
        print(f"\n--- Processing collection: {folder} ---", flush=True)
        query = urllib.parse.quote(folder)
        search_req = urllib.request.Request(SEARCH_URL.format(query))
        
        try:
            with urllib.request.urlopen(search_req, timeout=15) as response:
                data = json.loads(response.read().decode('utf-8'))
        except Exception as e:
            print(f"Failed to search API for {folder}: {e}", flush=True)
            continue
            
        object_ids = data.get("objectIDs")
        if not object_ids:
            print(f"No objects found for {folder}.", flush=True)
            continue
            
        print(f"Found {len(object_ids)} public domain objects with images.", flush=True)
        
        folder_path = os.path.join(BASE_DIR, folder)
        
        # Check how many files we already have in this folder
        existing_count = len([f for f in os.listdir(folder_path) if f.startswith("MET_")])
        if existing_count >= MAX_DOWNLOADS_PER_FOLDER:
            print(f"Folder already has {existing_count} images, moving to next folder.", flush=True)
            continue
            
        for obj_id in object_ids:
            if existing_count + folder_downloads >= MAX_DOWNLOADS_PER_FOLDER:
                print(f"Reached limit of {MAX_DOWNLOADS_PER_FOLDER} images in {folder}.", flush=True)
                break

            try:
                # Check if we already have it by a simplistic filename (we'll name it by object ID to avoid duplicates)
                existing_files = [f for f in os.listdir(folder_path) if f.startswith(f"MET_{obj_id}_")]
                if existing_files:
                    continue

                obj_req = urllib.request.Request(OBJECT_URL.format(obj_id))
                with urllib.request.urlopen(obj_req, timeout=15) as obj_resp:
                    obj_data = json.loads(obj_resp.read().decode('utf-8'))
                    
                img_url = obj_data.get("primaryImage") or obj_data.get("primaryImageSmall")
                if not img_url:
                    continue

                title = obj_data.get("title", "Untitled")
                clean_title = sanitize_filename(title)[:50]
                # Fallback to ascii for printing just in case
                filename = f"MET_{obj_id}_{clean_title}.jpg"
                local_path = os.path.join(folder_path, filename)
                
                safe_filename = filename.encode('ascii', 'replace').decode('ascii')
                print(f"Downloading {safe_filename}...", flush=True)
                
                img_req = urllib.request.Request(img_url)
                with urllib.request.urlopen(img_req, timeout=20) as img_resp:
                    with open(local_path, 'wb') as f:
                        f.write(img_resp.read())
                        
                folder_downloads += 1
                total_downloads += 1
                time.sleep(0.5) # Be nice to the API
                
            except Exception as e:
                print(f"Failed to download object {obj_id}: {e}", flush=True)
                time.sleep(1)

    print(f"\nFinished. Total downloads this run across all folders: {total_downloads}", flush=True)

if __name__ == "__main__":
    main()
