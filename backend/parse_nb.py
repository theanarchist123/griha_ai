import re
with open('nb.html', 'r', encoding='utf-8') as f:
    html = f.read()

script_tags = re.findall(r'<script[^>]*id=["\']([^"\']+)["\'][^>]*>', html)
print('Script IDs:', script_tags)

idx = html.find('"rent":')
if idx > 0:
    start = max(0, idx - 50)
    end = min(len(html), idx + 50)
    print('\nFound rent:', html[start:end])

idx2 = html.find('NEXT_DATA')
if idx2 > 0:
    print('\nFound NEXT_DATA')
