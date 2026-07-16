import urllib.request
import re

req = urllib.request.Request('https://www.bing.com/inspire?FORM=IRPFED', headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('utf-8')

imgs = re.findall(r'(https://th\.bing\.com/th/id/OIG[^\'\"\s\\]+)', html)
imgs2 = re.findall(r'(https://tse\d\.mm\.bing\.net/th/id/OIG[^\'\"\s\\]+)', html)
all_imgs = list(set(imgs + imgs2))
print("Found images:", len(all_imgs))
for i in all_imgs[:10]:
    print(i)
