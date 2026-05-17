import os, re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content.replace(
        '${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api',
        '${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\\/$/, "")}/api'
    )
    
    new_content = new_content.replace(
        'const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";',
        'const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\\/$/, "");'
    )
    
    if content != new_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Fixed {filepath}')

for root, _, files in os.walk('src'):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            fix_file(os.path.join(root, f))
