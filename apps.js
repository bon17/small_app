// ─────────────────────────────────────────────────────────────
//  앱 목록. 새 앱을 만들면 해당 탭의 맨 위(또는 원하는 자리)에 항목을 하나 추가하세요.
//  같은 탭 안에서는 위에 있을수록 화면에서도 먼저 보여요. 자세한 방법은 README.md
//
//  id    영어 소문자·숫자·하이픈. 첫 화면 사진 이름(shots/<id>.jpg)에 써요.
//  tab   어느 탭에 보일지. 아래 HUB.tabs 의 id (lesson / homeroom)
//  name  카드에 보이는 이름
//  desc  한 줄 설명 (없으면 비워도 돼요)
//  url   앱의 전체 주소 (https:// 포함)
//  shot  (선택) 첫 화면 사진 경로. 비우면 shots/<id>.jpg
//  hide  (선택) 사진을 찍을 때 흐리게 가릴 부분의 CSS 선택자. 화면에 사람 이름 같은
//        개인정보가 보이는 앱에 써요. (tools/shot.cjs 가 찍을 때만 적용돼요)
//  keepShot  (선택) true 면 직접 넣은 사진이라 자동 촬영(--all 포함)이 덮어쓰지 않아요.
// ─────────────────────────────────────────────────────────────

window.HUB = {
  // 탭 목록. 순서대로 보이고, 첫 번째 탭이 처음에 열려요.
  tabs: [
    { id: 'lesson',   label: '수업' },
    { id: 'homeroom', label: '학급 및 그 외' },
  ],
};

window.APPS = [
  // ── 수업 ──────────────────────────────────────────────────
  {
    id: 'kr-passport', tab: 'lesson',
    name: '대한의 빛나는 여권',
    desc: '광복절 계기교육 활동',
    url: 'https://joo.is/history2026',
  },
  {
    id: 'citizen-1789', tab: 'lesson',
    name: '시민 1789',
    desc: '프랑스혁명 시뮬레이션 게임',
    url: 'https://joo.is/citizen1987',
  },
  {
    id: 'if-you', tab: 'lesson',
    name: '너라면',
    desc: '유럽의 근대 국민국가 건설',
    url: 'https://joo.is/ifyou',
  },
  {
    id: 'thread-spool', tab: 'lesson',
    name: '실 한타래',
    desc: '산업혁명 게임',
    url: 'https://joo.is/산업혁명게임',
  },
  {
    id: 'nunchi-cards', tab: 'lesson',
    name: '눈치 카드게임',
    desc: '역사 복습 카드게임',
    url: 'https://history-card-game.kbe950107.workers.dev/',
  },
  {
    id: 'ravis-trunk', tab: 'lesson',
    name: '라비의 트렁크',
    desc: '제국주의 스토리형 방탈출 게임',
    url: 'https://ravis-trunk.kbe950107.workers.dev/',
  },
  {
    id: 'russia-1917', tab: 'lesson',
    name: '1917 러시아를 구하라',
    desc: '러시아 혁명 활동',
    url: 'https://bon17.github.io/russia-1917-game/',
  },
  {
    id: 'voice-1919', tab: 'lesson',
    name: '1919 목소리 조사단',
    desc: '1차 세계대전 이후 상황 이해 활동',
    url: 'https://bon17.github.io/1919choice/?release=57ae58935dba',
  },
  {
    id: 'memory-court-1', tab: 'lesson',
    name: '기억의 법정1',
    desc: '일본 전범재판 게임',
    url: 'https://bon17.github.io/Reversal-of-History-Trial/1/',
  },
  {
    id: 'memory-court-2', tab: 'lesson',
    name: '기억의 법정2',
    desc: '홀로코스트 게임',
    url: 'https://bon17.github.io/Reversal-of-History-Trial/2/',
  },
  {
    id: 'dokdo-love', tab: 'lesson',
    name: '독도사랑 실천대회',
    desc: '',
    url: 'https://bon17.github.io/dokdo-love-in-action/',
  },

  // ── 학급 및 그 외 ─────────────────────────────────────────
  {
    id: 'assessment-check', tab: 'homeroom',
    name: '수행평가 체크',
    desc: '',
    url: 'https://assessment-check-nu.vercel.app/',
  },
  {
    id: 'one-page-thought', tab: 'homeroom',
    name: '생각 한 장',
    desc: '',
    url: 'https://saenggak-hanjang.pages.dev/',
  },
  {
    id: 'naesin-compass', tab: 'homeroom',
    name: '내신 나침반',
    desc: '',
    url: 'https://bon17.github.io/naesin-compass/',
  },
  {
    id: 'everland', tab: 'homeroom',
    name: '에버랜드 웹앱',
    desc: '',
    url: 'https://everland.kbe950107.workers.dev/2-2',
  },
  {
    id: 'priority-meal', tab: 'homeroom',
    name: '기산중 우선식사 확인증',
    desc: '',
    url: 'https://gisan-priority-meal.pages.dev',
  },
  {
    id: 'bareun-language', tab: 'homeroom',
    name: '바른언어 사용 캠페인',
    desc: '',
    url: 'https://bareun-eoneo-web.pages.dev/',
  },
  {
    id: 'winter-snack', tab: 'homeroom',
    name: '우리반 겨울간식 포장마차',
    desc: '',
    url: 'https://script.google.com/macros/s/AKfycbw9SM48ZIEP6iBcOkbK-2ACB0ROc9phUdjxLdZ2cAVLd-0WIWyBJNVu_GexYmH_ZCjW1A/exec',
    keepShot: true, // 앱스 스크립트 화면은 자동 촬영이 안 돼서 직접 캡처한 사진을 써요
  },
  {
    id: 'gisan-vote', tab: 'homeroom',
    name: '기산중 투표창',
    desc: '',
    url: 'https://gisanflix-2026.netlify.app/',
    hide: '.pname', // 첫 화면에 교직원 이름이 보여서 찍을 때 흐리게 가려요
  },
];
