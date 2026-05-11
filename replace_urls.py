import os
import re

src_dir = r"d:\griha_ai\frontend\src"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Replace occurrences in template literals: `http://127.0.0.1:8000/api/...` -> `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/...`
    content = re.sub(
        r'`http://127\.0\.0\.1:8000',
        r'`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}',
        content
    )
    content = re.sub(
        r'`http://localhost:8000',
        r'`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}',
        content
    )

    # Replace occurrences in regular strings: "http://127.0.0.1:8000/api/..." -> `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/...`
    content = re.sub(
        r'"http://127\.0\.0\.1:8000(/.*)"',
        r'`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}\1`',
        content
    )
    content = re.sub(
        r'"http://localhost:8000(/.*)"',
        r'`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}\1`',
        content
    )

    # Note: there is also one occurrence for websocket: ws://localhost:8000
    content = re.sub(
        r"'ws://localhost:8000",
        r"`${(process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace('http', 'ws')}",
        content
    )
    content = re.sub(
        r"`ws://localhost:8000",
        r"`${(process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace('http', 'ws')}",
        content
    )

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
