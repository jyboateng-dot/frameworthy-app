import urllib.request, re

req = urllib.request.Request(
    'https://www.bubolaenaibo.com/collezione/original-paintings-prestige/',
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
)
html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', errors='ignore')

# All thumbnail paths
all_paths = list(set(re.findall(r'wp-content/uploads/[^"\'<\s]+\.jpg', html)))
print(f"Total unique .jpg references on page: {len(all_paths)}")

# Full-res (no dimensions suffix)
full_res = [p for p in all_paths if not re.search(r'-\d+x\d+\.jpg$', p)]
print(f"Already full-res (no dimension suffix): {len(full_res)}")

# With dimension suffix (thumbnails that resolve to full-res)
thumbs = [p for p in all_paths if re.search(r'-\d+x\d+\.jpg$', p)]
unique_originals = set(re.sub(r'-\d+x\d+\.jpg$', '.jpg', p) for p in thumbs)
print(f"Unique originals from thumbnails: {len(unique_originals)}")

combined = set(p.split('/')[-1] for p in full_res) | unique_originals
print(f"\nTotal unique painting files on the page: {len(combined)}")

# Compare with what we have locally
import os
local = set(os.listdir('public/prestige'))
print(f"We have locally: {len(local)}")

missing = combined - local
extra = local - combined
print(f"Missing from our local copy: {len(missing)}")
if missing:
    for m in sorted(missing): print(f"  MISSING: {m}")
print(f"Extra we have (not on page): {len(extra)}")
if extra:
    for e in sorted(extra): print(f"  EXTRA: {e}")
