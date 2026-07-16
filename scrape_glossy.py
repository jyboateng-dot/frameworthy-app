import urllib.request, re

req = urllib.request.Request(
    'https://www.bubolaenaibo.com/collezione/glossy-art-art-and-images/',
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
)
html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', errors='ignore')

all_paths = list(set(re.findall(r'wp-content/uploads/[^"\'<\s]+\.jpg', html)))
print(f"Total unique .jpg references: {len(all_paths)}")

unique_originals = set()
for p in all_paths:
    clean = re.sub(r'-\d+x\d+\.jpg$', '.jpg', p)
    unique_originals.add(clean)

print(f"Unique original files: {len(unique_originals)}")
with open('glossy_urls.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sorted(unique_originals)))
print("Saved to glossy_urls.txt\n\nAll filenames:")
for u in sorted(unique_originals):
    print(" ", u.split('/')[-1])
