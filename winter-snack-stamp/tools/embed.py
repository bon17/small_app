#!/usr/bin/env python3
"""Index.html 안에 QR 라이브러리와 그림(art/ 폴더의 PNG)을 넣어요.

Apps Script에는 Code.gs와 Index.html 두 파일만 붙여 넣으면 되도록, 필요한 것을 모두 Index.html 하나에 담아요.

  python3 tools/embed.py

- vendor/qrcode-generator-1.4.4.js → QR_LIB 표시 사이
- art/*.png (ChatGPT로 그린 그림) → ART 표시 사이. 파일 이름이 그림 이름이에요 (예: sticker-bung.png).
  Pillow가 있으면 512px WebP로 줄여서 넣고, 없으면 PNG 그대로 넣어요.
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


def encode_image(path):
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        return 'data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode()
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


def main():
    html = INDEX.read_text(encoding='utf-8')
    qr = QR.read_text(encoding='utf-8').replace('</script', '<\\/script')
    html = replace_between(html, '/* QR_LIB:BEGIN */', '/* QR_LIB:END */', qr.strip())
    entries = []
    for p in sorted(ART.glob('*.png')) if ART.exists() else []:
        key = p.stem
        if not re.fullmatch(r'[a-z0-9-]+', key):
            print('건너뜀 (파일 이름은 영어 소문자·숫자·-만):', p.name)
            continue
        entries.append("  '%s': '%s'," % (key, encode_image(p)))
        print('그림 넣음:', p.name)
    html = replace_between(html, '/*ART:BEGIN*/', '/*ART:END*/', '\n'.join(entries))
    INDEX.write_text(html, encoding='utf-8')
    print('Index.html 크기: %.0f KB' % (INDEX.stat().st_size / 1024))


if __name__ == '__main__':
    main()
