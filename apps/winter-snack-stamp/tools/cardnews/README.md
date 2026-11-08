# 교과 선생님 안내 카드뉴스 (poster/cardnews/card-1~7.png)

1080×1350 PNG 7장. 글은 `cards.html`에 있어요(카드 하나 = `<section class="card">` 하나). 그림은 `art/`의 그림을 그대로 써요.

글자를 고치려면 `cards.html`의 문장만 바꾸고 다시 찍어요.

```bash
cd apps/winter-snack-stamp
# 글꼴 Jua (SIL OFL): Google Fonts에서 받아요 (저장소에는 넣지 않아요, .gitignore)
curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Jua" | grep -o "https://fonts.gstatic.com[^)]*" | head -1 | xargs curl -sS -o tools/cardnews/Jua.ttf
node tools/cardnews/render.js          # → poster/cardnews/card-1.png ~ card-7.png
# 마지막 장(인사) 빼고 6장 PDF: 쪽 번호를 i / 6으로 바꿔 찍어요
node tools/cardnews/render.js /tmp/cards6 --count=6 --pdf=poster/cardnews/teacher-guide-6p.pdf
```

이모지는 시스템의 Noto Color Emoji 글꼴로 그려요.
