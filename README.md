# 교실 서랍

바이브코딩으로 만든 작은 앱들을 모아둔 갤러리 페이지예요.
앱마다 첫 화면 사진, 이름, 설명, 주소가 보이고, 카드를 누르면 그 앱이 **새 창**에서 열려요.
위쪽 탭(`수업` / `학급 및 그 외`)을 누르면 구분별로 따로 보여요.

## 저장소 구조

- **맨 위**: 교실 서랍(허브 사이트) 파일이에요.
- **`apps/`**: 앱 소스 폴더예요(`capsule-coupon/`, `winter-snack-stamp/` …). 앱마다 폴더 하나이고, 허브 사이트에는 올라가지 않아요.
- **`CLAUDE.md`**: Claude가 이 저장소에서 따르는 작업 규칙이에요. (앱은 매번 새로 만들고, 이전 앱·브랜치는 신경 쓰지 않아요.)

## 보는 법

- 인터넷 주소: **https://gyosil-seorap.kbe950107.workers.dev** (배포 방법은 아래)
- 내 컴퓨터에서는 `index.html`을 더블클릭해서 브라우저로 열면 돼요. 설치는 필요 없어요.
- `…/#lesson`, `…/#homeroom`처럼 주소 뒤에 탭 이름을 붙이면 그 탭이 바로 열려요. 탭을 누르면 주소도 같이 바뀌어서, 탭 하나만 가리키는 링크를 공유할 수 있어요.

## 앱 추가하는 법

1. **`apps.js`에 항목을 하나 추가해요.** 넣고 싶은 탭 구역에 아래 모양을 복사해서 붙여요. 같은 탭 안에서는 위에 있을수록 먼저 보여요.

   ```js
   {
     id: 'my-app', tab: 'lesson',          // id는 영어 소문자·숫자·하이픈 / tab은 lesson 또는 homeroom
     name: '앱 이름',
     desc: '한 줄 설명',                    // 없으면 '' 로 비워도 돼요
     url: 'https://…',                     // 앱의 전체 주소
   },
   ```

2. **첫 화면 사진을 넣어요.** 둘 중 편한 쪽으로 해요.
   - 자동: `node tools/shot.cjs` (아래 "첫 화면 사진 찍기")
   - 직접: 캡처한 이미지를 `shots/<id>.jpg`로 저장해요. 가로:세로 16:10(예: 960×600)이 보기 좋아요.
3. **커밋하고 푸시해요.**

사진이 없으면 사진 자리에 앱 이름의 첫 글자가 나와요.

탭 이름을 바꾸거나 탭을 늘리려면 `apps.js` 맨 위의 `HUB.tabs`를 고치면 돼요.

## 첫 화면 사진 찍기

`tools/shot.cjs`는 앱을 열어서 처음 보이는 화면을 `shots/<id>.jpg`로 저장해요. 열기만 하고 아무것도 누르지 않아요.

```bash
npm i -D playwright && npx playwright install chromium   # 처음 한 번만
node tools/shot.cjs                # 사진이 아직 없는 앱만
node tools/shot.cjs --all          # 전부 다시
node tools/shot.cjs my-app         # 지정한 앱만 다시
```

- **개인정보가 보이는 앱**은 `apps.js` 항목에 `hide: '선택자'`를 적으면 그 부분을 흐리게 가려서 찍어요. (예: `gisan-vote`는 화면에 교직원 이름이 보여서 `hide: '.pname'`을 써요.)
- **자동으로 안 찍히는 앱**도 있어요. 로그인이 필요한 앱이나, 구글 앱스 스크립트처럼 화면이 따로 감싸져 있는 앱이에요. 그런 앱은 직접 캡처해서 `shots/<id>.jpg`로 넣고, `apps.js` 항목에 `keepShot: true`를 적어 두세요. 그러면 `--all`로 다시 찍어도 덮어쓰지 않아요. (예: `winter-snack`)
- 사진을 올리기 전에 이름 같은 개인정보가 보이지 않는지 확인하세요. 사진은 사이트에 그대로 공개돼요.

## 인터넷에 올리기 (Cloudflare)

주소: **https://gyosil-seorap.kbe950107.workers.dev**

- Cloudflare의 `gyosil-seorap`이 이 GitHub 저장소와 연결돼 있어요. **Production branch(`main`)에 커밋이 들어오면 1~2분 뒤 자동으로 다시 배포돼요.** 따로 할 일은 없어요.
- 배포 설정은 `wrangler.jsonc`, 사이트에 올리지 않을 파일 목록은 `.assetsignore`에 있어요. 허브에 필요한 파일(`index.html`, `style.css`, `app.js`, `apps.js`, `shots/`, `fonts/`)만 올라가요.
- 저장소에 새 폴더나 파일을 넣었는데 사이트에 올라가면 안 되는 것이라면 `.assetsignore`에 적어 주세요.
- 배포 기록과 오류는 Cloudflare 대시보드 → **Workers & Pages → gyosil-seorap → Deployments**에서 볼 수 있어요.

## 파일 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 페이지 뼈대 |
| `style.css` | 디자인 |
| `app.js` | 탭과 카드를 그리는 코드 |
| `apps.js` | **앱 목록과 탭 설정** (앱을 추가할 때 고치는 파일) |
| `shots/` | 앱 첫 화면 사진 (`<id>.jpg`) |
| `fonts/nanum-myeongjo/` | 나눔명조 글꼴 400·800 (SIL OFL 1.1, `LICENSE.txt`). 화면에 나오는 글자 조각만 내려받아요. |
| `tools/shot.cjs` | 첫 화면 사진 자동 촬영 도구 |
| `apps/` | 앱 소스 폴더 (사이트에는 올라가지 않아요) |
| `CLAUDE.md` | Claude 작업 규칙 |
| `wrangler.jsonc` | Cloudflare 배포 설정 |
| `.assetsignore` | 사이트에 올리지 않을 파일 목록 |
