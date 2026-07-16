import urllib.request, re, json

req = urllib.request.Request(
    'https://www.bubolaenaibo.com/collezione/original-paintings-prestige/',
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
)
html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', errors='ignore')
urls = list(set(re.findall(r'wp-content/uploads/[^"\'<\s]+\.jpg', html)))
print(f"Total found: {len(urls)}")
for u in sorted(urls)[:10]:
    print(u)

with open('prestige_urls.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sorted(urls)))
print("Saved to prestige_urls.txt")
