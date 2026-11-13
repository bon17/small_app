/* 출결노트 오프라인 저장 (서비스 워커)
   - 인터넷이 될 때 한 번 열면 앱 파일과 글꼴을 이 브라우저에 저장해 둬요.
   - 그다음부터는 인터넷이 없어도 같은 주소로 열려요.
   - 앱 파일은 인터넷이 되면 늘 새 것을 받아 저장본도 바꿔요(안 되거나 4초 넘게 걸리면 저장본).
   - 글꼴은 바뀌지 않으니 저장본을 먼저 써요. 글꼴을 바꾸면 아래 CACHE 이름의 숫자를 올려요. */
const CACHE='chulgyeol-note-v1';
const FILES=[
  './','style.css','app.js',
  'fonts/pretendard/Pretendard-Regular.subset.woff2',
  'fonts/pretendard/Pretendard-Medium.subset.woff2',
  'fonts/pretendard/Pretendard-SemiBold.subset.woff2',
  'fonts/pretendard/Pretendard-Bold.subset.woff2',
  'fonts/pretendard/Pretendard-ExtraBold.subset.woff2',
  'fonts/nanum-myeongjo/NanumMyeongjo-Regular.woff2',
  'fonts/nanum-myeongjo/NanumMyeongjo-Bold.woff2',
  'fonts/nanum-myeongjo/NanumMyeongjo-ExtraBold.woff2',
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('chulgyeol-note-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

function keep(req,res){
  if(res&&res.ok&&!res.redirected){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
  return res;
}
function fromCache(req){
  return caches.match(req,{ignoreSearch:true}).then(r=>r||(req.mode==='navigate'?caches.match('./'):undefined));
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  // 글꼴: 저장본 먼저
  if(url.pathname.includes('/fonts/')){
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>keep(req,res))));
    return;
  }

  // 나머지: 인터넷 먼저, 안 되면 저장본
  e.respondWith(new Promise(resolve=>{
    let done=false;
    const finish=r=>{if(!done&&r){done=true;resolve(r)}};
    const timer=setTimeout(()=>{fromCache(req).then(finish)},4000);
    fetch(req)
      .then(res=>{clearTimeout(timer);finish(keep(req,res))})
      .catch(()=>{clearTimeout(timer);fromCache(req).then(r=>{if(!done){done=true;resolve(r||Response.error())}})});
  }));
});
