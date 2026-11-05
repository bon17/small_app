#!/usr/bin/env python3
"""Index.html 안에 QR 라이브러리와 그림(art/ 폴더의 PNG)을 넣어요.

Apps Script에는 Code.gs와 Index.html 두 파일만 붙여 넣으면 되도록, 필요한 것을 모두 Index.html 하나에 담아요.

  python3 tools/embed.py

- vendor/qrcode-generator-1.4.4.js → QR_LIB 표시 사이
- art/ 폴더의 그림 (PNG·JPG·WebP, ChatGPT로 그린 그림) → ART 표시 사이.
  파일 이름이 그림 이름이에요 (예: sticker-bung.png). 같은 이름이 여러 개면 PNG를 먼저 써요.
  앱이 아직 쓰지 않는 그림(예: char-*)은 art/에만 두고 넣지 않아요. Index.html이 무거워지지 않게요.
  Pillow가 있으면 512px WebP로 줄여서 넣고, 없으면 파일 그대로 넣어요.
"""
import base64
import io
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / 'Index.html'
QR = ROOT / 'vendor' / 'qrcode-generator-1.4.4.js'
ART = ROOT / 'art'
MAX_PX = 512
EXTS = ['.png', '.webp', '.jpg', '.jpeg']
MIME = {'.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}


def encode_image(path):
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        mime = MIME[path.suffix.lower()]
        return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()
    with Image.open(path) as im:
        im = im.convert('RGBA')
        im.thumbnail((MAX_PX, MAX_PX))
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=86, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()


def replace_between(text, begin, end, body):
    pattern = re.compile(re.escape(begin) + r'.*?' + re.escape(end), re.S)
    if not pattern.search(text):
        sys.exit('표시를 찾을 수 없어요: ' + begin)
    return pattern.sub(lambda _: begin + '\n' + body + '\n' + end, text, count=1)


def used_by_app(html, key):
    """ART 표시 밖의 코드가 이 그림 이름을 부르는지 봐요. 'bake-bung-' + n처럼 끝 숫자만 붙이는 것도 쳐요."""
    code = re.sub(r'/\*ART:BEGIN\*/.*?/\*ART:END\*/', '', html, flags=re.S)
    return ("'" + key + "'") in code or ("'" + re.sub(r'\d+$', '', key) + "'") in code


def main():
    html = INDEX.read_text(encoding='utf-8')
    qr = QR.read_text(encoding='utf-8').replace('</script', '<\\/script')
    html = replace_between(html, '/* QR_LIB:BEGIN */', '/* QR_LIB:END */', qr.strip())
    entries = []
    files = {}
    for p in sorted(ART.iterdir()) if ART.exists() else []:
        ext = p.suffix.lower()
        if ext not in EXTS:
            continue
        key = p.stem
        if not re.fullmatch(r'[a-z0-9-]+', key):
            print('건너뜀 (파일 이름은 영어 소문자·숫자·-만):', p.name)
            continue
        if not used_by_app(html, key):
            print('건너뜀 (앱에서 아직 안 써요):', p.name)
            continue
        if key in files and EXTS.index(files[key].suffix.lower()) <= EXTS.index(ext):
            print('건너뜀 (같은 이름이 이미 있어요):', p.name)
            continue
        files[key] = p
    # 굽기·찌기 그림은 5단계가 다 모여야 앱이 써요(Art.stageImg). 덜 모였으면 넣지 않아요.
    for prefix in ('bake-bung-', 'steam-hop-'):
        have = [k for k in files if re.fullmatch(re.escape(prefix) + r'[1-5]', k)]
        if have and len(have) < 5:
            for k in sorted(have):
                print('건너뜀 (%s1~5가 다 모이면 넣어요, 지금 %d장):' % (prefix, len(have)), files.pop(k).name)
    for key in sorted(files):
        p = files[key]
        entries.append("  '%s': '%s'," % (key, encode_image(p)))
        print('그림 넣음:', p.name)
    html = replace_between(html, '/*ART:BEGIN*/', '/*ART:END*/', '\n'.join(entries))
    INDEX.write_text(html, encoding='utf-8')
    print('Index.html 크기: %.0f KB' % (INDEX.stat().st_size / 1024))


if __name__ == '__main__':
    main()
