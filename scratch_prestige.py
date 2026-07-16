import urllib.request
import re

def main():
    try:
        url = "https://www.bubolaenaibo.com/collezione/original-paintings-prestige/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
            
        print("HTML length:", len(html))
        
        # Write HTML for reference
        with open("prestige_raw.html", "w", encoding="utf-8") as f:
            f.write(html)
            
        # Find all images
        urls = set(re.findall(r'https?://[^\s\"\'\>]+?wp-content/uploads[^\s\"\'\>]+?\.(?:jpg|png|jpeg)', html))
        print("Found image URLs count:", len(urls))
        for img in sorted(urls):
            print(img)
            
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    main()
