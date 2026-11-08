# 주의 칸 포스터 만드는 법 (poster-A4-warning.pdf)

앞장 포스터(`poster/poster-front.png`)의 종이봉투+구호를 72%로 줄이고 아랫부분을 올려서, 기간 띠 위에 **⚠ 주의** 칸 자리를 만들어요. 포스터 크기(1024×1536)는 그대로예요.
글자를 고치려면 `front-warning.html`의 문장만 바꾸고 아래를 다시 돌려요. 작업 폴더는 아무 데나 써요(저장소 밖 권장).

```bash
W=/tmp/poster && mkdir -p $W && cp tools/poster/front-warning.html $W/front.html
# 글꼴 Jua (SIL OFL): Google Fonts에서 받아요 (저장소에는 넣지 않아요)
curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Jua" | grep -o "https://fonts.gstatic.com[^)]*" | head -1 | xargs curl -sS -o $W/Jua.ttf
python3 tools/poster/compose.py poster/poster-front.png $W/base.png 0.72      # 주의 칸 자리 만들기
node tools/poster/render.js $W/front.html $W/front-print.png 2262              # 글자 올리기 (인쇄 크기)
node tools/poster/render.js $W/front.html $W/front-1x.png 1024
pdfimages -j poster/poster-A4.pdf $W/pg                                         # 뒷장은 처음 포스터 그대로
python3 -c "
from PIL import Image
f = Image.open('$W/front-print.png').convert('RGB')
page = Image.new('RGB', (2480, 3508), 'white'); page.paste(f, (109, 57)); page.save('$W/page1.jpg', quality=90, dpi=(300, 300))
f.save('poster/poster-front-warning.jpg', quality=90); Image.open('$W/front-1x.png').convert('RGB').save('poster/poster-front-warning.png', optimize=True)"
python3 tools/poster/jpgpdf.py poster/poster-A4-warning.pdf $W/page1.jpg $W/pg-001.jpg
```

A4 쪽 안에서 포스터 자리(2262×3393, 왼쪽 위 109,57 · 300dpi)는 처음 포스터 PDF와 같아요.
