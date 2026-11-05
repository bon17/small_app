# 인계문 — 겨울간식 스탬프 (다음 세션용)

> 저장소 `bon17/small_app`, 브랜치 **`claude/wonderful-cori-ly4uot`**, 폴더 `winter-snack-stamp/`.
> 사용자는 중학교 담임이에요. **쉬운 우리말로 짧게** 설명해요.

## 0. 가장 먼저: 올라온 그림 확인하고 앱에 넣기

담임이 ChatGPT로 그린 그림을 GitHub 웹으로 `winter-snack-stamp/art/`에 올렸어요(또는 올리는 중이에요).
한 번에 많이 올리다 "The file is too large" 오류가 난 적이 있어서, 5~10장씩 나눠 올리라고 안내했어요.

1. `git fetch origin claude/wonderful-cori-ly4uot && git checkout claude/wonderful-cori-ly4uot && git pull`
2. `winter-snack-stamp/art/` 안의 그림(PNG·JPG·WebP) 목록을 봐요. GitHub 웹으로 올리면 **저장소 맨 위 폴더**에 들어갈 때가 있어요(`git show --stat HEAD`). 그러면 `git mv`로 `art/`에 옮겨요. **하나도 없으면** 담임에게 [art/README.md](art/README.md)의 올리는 방법(링크, 5~10장씩, Commit directly to 이 브랜치)을 다시 알려 줘요.
3. 그림을 **하나씩 열어 보고** [ART_PROMPTS.md](ART_PROMPTS.md)의 어느 그림인지 맞춰요.
   ChatGPT 기본 이름(예: `ChatGPT Image ….png`)이면 `git mv`로 정해진 이름으로 바꿔요. 이름은 영어 소문자·숫자·`-`만 돼요.
4. 그림마다 확인할 것:
   - 정면에서 똑바로 본 시점인지 (비스듬하지 않게). 붕어빵 틀은 바로 위에서 내려다본 모습인지
   - `bake-bung-1~5`: **뚜껑(위 틀) 없이** 같은 틀·같은 구도·같은 크기로 단계만 달라지는지
   - `steam-hop-1~5`: 같은 찜기·같은 구도로 단계만 달라지는지
   - 스티커(`sticker-*`)는 배경이 투명하거나 흰 테두리로 깔끔한지
   - 글자가 들어가 있지 않은지
   - 이상한 그림은 담임에게 무엇이 문제인지 말하고 다시 그릴 프롬프트를 줘요.
5. `cd winter-snack-stamp && python3 tools/embed.py` → `Index.html`에 그림이 들어가요(512px WebP로 줄여서). 앱 코드가 부르지 않는 그림(`char-*` 등)은 "앱에서 아직 안 써요"로 건너뛰어요. 새 그림을 쓰려면 먼저 코드에서 `Art.img('이름', …)`으로 불러요.
6. `node --test tests/*.test.js` (20개 통과해야 해요) → `node tests/e2e.js <스크린샷 폴더>`
   스크린샷에서 그림이 쿠폰 창·쿠폰 카드·맛 고르기·교환권·저금통에 잘 맞는지(잘림, 크기, 배경색) 보고, 필요하면 CSS를 고쳐요.
7. 커밋하고 `git push -u origin claude/wonderful-cori-ly4uot`.
8. 담임에게 안내: Apps Script 편집기에서 `Index.html` 내용을 새것으로 모두 바꾸고 **배포 → 배포 관리 → ✏ → 새 버전 → 배포**.

### 지금 앱이 쓰는 그림 (22장, 먼저 필요한 것)

| 파일 이름 | 쓰는 곳 |
|---|---|
| `sticker-bung`, `sticker-hop`, `sticker-burnt` | 쿠폰 창에 찍히는 스티커 (탄 것은 빼기로 칸이 빠질 때 잠깐) |
| `bake-bung-1` ~ `bake-bung-5` | 붕어빵 쿠폰 카드 위 그림 (채울수록 노릇노릇) |
| `steam-hop-1` ~ `steam-hop-5` | 호빵 쿠폰 카드 위 그림 (채울수록 따끈따끈) |
| `flavor-bung-choux`, `flavor-bung-pat` | 맛 고르기·교환권 (슈크림, 팥) |
| `flavor-hop-pizza`, `flavor-hop-danpat`, `flavor-hop-veggie`, `flavor-hop-goguma` | 맛 고르기·교환권 (피자, 단팥, 야채, 고구마) |
| `prop-piggy`, `prop-batter`, `prop-bag` | 저금통, 반죽, 다 채운 뒤 봉투 |

**받은 그림 (11/5)**: `flavor-hop-pizza`·`-danpat`·`-veggie`·`-goguma`, `prop-piggy` → 앱에 넣음. `char-bung-basic`·`-happy`·`-sad`, `char-hop-basic`·`-happy`·`-sad` → `art/`에만 둠.
캐릭터는 프롬프트와 달리 팔다리·요리사 모자·앞치마가 있지만 담임이 고른 모습이고 6장이 서로 잘 맞아요.
**아직 없는 그림 (먼저 필요한 17장)**: `sticker-bung`·`-hop`·`-burnt`, `bake-bung-1~5`, `steam-hop-1~5`, `flavor-bung-choux`·`-pat`, `prop-batter`, `prop-bag`.

아직 쓰는 곳이 없는 그림: `char-*`(붕어빵이·호빵이 캐릭터 8장), `prop-mold`, `prop-steamer`, `prop-letter`, `bg-stall-wide`, `bg-stall-tall`.
들어오면 `art/`에 넣어 두고, 캐릭터는 효과 화면(스탬프 받기, 쿠폰 완성 등)에 넣을지 담임과 정해요.

## 1. 앱 한눈에

수업 태도로 스탬프를 받고, 쿠폰을 채워 붕어빵(30칸)·호빵(45칸)으로 바꾸는 **4주**(11월 9일 ~ 12월 4일) 학급 활동. 콘셉트는 🏮 포장마차.
구글시트 + Apps Script 웹앱 하나로 세 화면을 보여 줘요. 자세한 것은 [README.md](README.md)(설치·사용법), [PLAN.md](PLAN.md)(기획, 14장에 구현 상태).

| 화면 | 주소 | 누가 |
|---|---|---|
| 교실 패드 | `?v=pad` | 교과 선생님 (교사 PIN) |
| 담임 관리 | `?v=admin` | 담임 (관리자 PIN) |
| 학생 화면 | `?s=개인코드` | 학생 (QR 카드) |

## 2. 파일

| 파일 | 내용 |
|---|---|
| `Code.gs` | 서버. `기록` 탭에 한 줄씩 쌓고(취소는 Y 표시) 다시 계산해요. `HANDLERS`에 기능이 모여 있어요 |
| `Index.html` | 화면 전부 (Pad, Stu, Adm, Home 모듈, SVG 기본 그림, 교환권 인쇄, QR 라이브러리). `/*ART:BEGIN*/`~`/*ART:END*/`에 그림이 들어가요 |
| `appsscript.json` | 시간대 Asia/Seoul, 웹앱 설정 |
| `ART_PROMPTS.md` | ChatGPT 그림 프롬프트와 파일 이름 |
| `tools/embed.py` | QR 라이브러리와 `art/` 그림을 `Index.html`에 넣어요 |
| `tests/gas-mock.js`, `tests/server.test.js` | Apps Script 흉내 + 서버 규칙 테스트 |
| `tests/e2e.js` | Chromium으로 화면을 띄워 스크린샷 |

## 3. 정한 것 (바꾸지 말 것)

- 기간 **4주** (2026년 11월 9일 ~ 12월 4일, 포스터 날짜), 쿠폰 **30칸 / 45칸** 그대로 (포스터에 인쇄됨)
- 간식이 모두 떨어지면 이벤트가 **일찍 끝날 수 있다**고 학생 규칙·화면에 안내해요(`soldOutAll`)
- 되찾기 찬스: 빼기를 당한 **다음 날부터** 칭찬(⭐·🙋·👑) 1번에 빼기 1건. 교실 패드에 대상 학생이 따로 떠요. **반 전체 빼기는 되찾기 없음**
- 학생은 처음 들어올 때 규칙을 끝까지 읽어야 시작, 그다음은 📜 규칙 버튼
- 쿠폰은 커피 쿠폰처럼 **따로 뜨는 쿠폰 창**에서 찍어요. 칸이 찰수록 위쪽 그림이 굽기·찌기 5단계로 바뀌어요
- 교환권 모양은 담임이 준 "쿠폰 출력기" HTML을 따랐어요(크게 A4 6장 / 작게 A4 12장). 그 HTML 원본은 저장소에 없어요. 이미 옮겨 놓았어요
- 미리캔버스는 쓰지 않기로 했어요. 포장마차 배경은 앱이 직접 그려요
- 교환권의 "선생님 확인" 칸은 빈칸 (담임이 도장을 직접 찍어요)
- 교실 패드는 소리 없음(🔊 버튼도 뺐어요). 노트북에서도 쓰니까 PIN은 키보드로 칠 수 있어요
- 학생 코드는 **숫자 4자리**(담임이 6자리 추천을 듣고도 골랐어요). 첫 화면에 코드 칸, QR 카드에 코드 표시. 한 기기(`dev`)에서 틀린 코드 5번이면 10분 막음
- 시트 메뉴 "🔗 웹앱 주소 보기": 웹앱이 열릴 때 /exec 주소를 스크립트 속성 `webAppUrl`에 저장해 두고 보여 줘요

## 4. 남은 일

0. 담임이 Apps Script에 설치·배포했어요(11/5, 웹앱 주소는 담임이 알고 있어요). 첫 배포에서 교실 패드·담임 관리가 안 열렸어요 → Apps Script가 HTML의 `/* 주석 */`을 지워서 BOOT 자리 표시를 못 찾았기 때문이에요. 글자 자리 표시(`'__BOOT__'`)로 고쳤어요. 담임이 새 Code.gs·Index.html(패드 소리 없음·키보드 PIN 포함)로 다시 배포했고, 교실 패드·담임 관리가 잘 열리는 것을 확인했어요(11/5). 설정에 활동 날짜 2026-11-09 ~ 2026-12-04를 넣으라고 안내했어요
1. 위 0번: 그림 확인·이름 맞추기·넣기·화면 확인
2. 캐릭터 그림이 오면 효과 화면에 넣을지 정하기
3. 실제 구글시트에 배포해서 확인 (속도: 기록이 수천 줄일 때, 패드·학생 폰·PC 동시 사용)
4. 교실 포스터: 담임이 앞장·뒷장을 만들어 보여 줬어요(11/5). 뒷장 오타 2개(2번 "받죽"→반죽, 3번 "이벤프"→이벤트)를 담임에게 알렸어요. 기간은 담임이 4주로 정했어요

## 5. 지킬 것

- 학생 명단(이름)은 저장소에 올리지 않아요 (`.gitignore`가 `*.xlsx`, `*.xls`, `*.csv` 제외)
- 처음 PIN(관리자 `0000`, 교사 `1234`)은 꼭 바꾸라고 안내해요
- Apps Script는 HTML의 `/* 주석 */`을 지워요. 실행할 때 주석에 기대는 코드를 만들지 않아요 (테스트도 주석을 지우고 돌려요)
- 코드 고친 뒤에는 테스트 두 개를 돌리고, 담임에게 Apps Script 붙여 넣기 + 새 버전 배포를 안내해요
- 커밋·푸시는 이 브랜치에만. PR은 담임이 말할 때만
