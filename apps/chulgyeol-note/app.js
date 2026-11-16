/* 출결노트 — 출결 관리부터 신고서 출력까지
   모든 기록은 이 브라우저(localStorage)에만 저장돼요. 서버로 보내지 않아요. */
(()=>{
'use strict';
const PREVIEW=!!window.CHULGYEOL_PREVIEW; // 미리 보기(인쇄 창이 막힌 곳)에서 열 때
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ───────── 기본 값 ───────── */
const PER=['조회','1교시','2교시','3교시','4교시','5교시','6교시','7교시','종례'];
const PCH=['조회','1','2','3','4','5','6','7','종례'];
const G={'질병':{k:'sick',form:'질병 신고서'},'출석인정':{k:'okd',form:'출석인정 신고서'},'기타':{k:'etc',form:'학부모·담임 의견서'},'미인정':{k:'bad',form:null}};
const GK=Object.keys(G);
const KINDS=['결석','지각','조퇴','결과'];
const KCH={'결석':'결','지각':'지','조퇴':'조','결과':'과'};
const DOCS=['진료확인서','처방전','약봉투','진단서','학부모 의견서','기타 서류'];
const WD='일월화수목금토';
const STORE='chulgyeol-note:v1';
const TOUR_KEY='chulgyeol-note:tour-v1';

/* ───────── 날짜·시각 ───────── */
const D=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const S=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const isWE=s=>{const w=D(s).getDay();return w===0||w===6};
const addDays=(s,n)=>{const d=D(s);d.setDate(d.getDate()+n);return S(d)};
const schoolDays=(start,n)=>{const out=[];let s=start,g=0;while(out.length<n&&g++<500){if(!isWE(s))out.push(s);s=addDays(s,1)}return out};
const stepSchool=(s,dir)=>{do{s=addDays(s,dir)}while(isWE(s));return s};
const md=s=>{const d=D(s);return `${d.getMonth()+1}월 ${d.getDate()}일(${WD[d.getDay()]})`};
const mdS=s=>{const d=D(s);return `${d.getMonth()+1}/${d.getDate()}`};
const toMin=t=>{if(!t)return null;const[h,m]=t.split(':').map(Number);return h*60+m};
const nowHM=()=>{const d=new Date();return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
const TODAY=S(new Date());
const START_DAY=isWE(TODAY)?stepSchool(TODAY,-1):TODAY;
const monthOf=s=>s.slice(0,7);
const shiftMonth=(mo,n)=>{const[y,m]=mo.split('-').map(Number);return S(new Date(y,m-1+n,1)).slice(0,7)};

/* ───────── 저장 ───────── */
function defSettings(){
  return {school:'기산중학교',grade:'',cls:'',teacher:'',
    times:['09:00','09:15','10:10','11:05','12:00','13:40','14:35','15:30'],
    last:{1:7,2:7,3:7,4:7,5:7},
    subj:{1:['','','','','','',''],2:['','','','','','',''],3:['','','','','','',''],4:['','','','','','',''],5:['','','','','','','']},};
}
function blankDB(){return {v:1,settings:defSettings(),students:[],records:[],reasons:['병원 진료','감기','장염','두통','복통','가정 사정'],uid:1}}
function migrate(d){
  const b=blankDB();
  const out={...b,...d};
  out.settings={...b.settings,...(d.settings||{})};
  out.settings.times=b.settings.times.map((t,i)=>(d.settings&&d.settings.times&&d.settings.times[i])||t);
  out.settings.last={...b.settings.last,...((d.settings||{}).last||{})};
  out.settings.subj={...b.settings.subj,...((d.settings||{}).subj||{})};
  out.students=Array.isArray(d.students)?d.students.filter(s=>s&&s.name).map(s=>{const o={no:Number(s.no),name:String(s.name)};if(s.left)o.left=String(s.left);if(s.joined)o.joined=String(s.joined);return o}):[];
  out.records=Array.isArray(d.records)?d.records.filter(r=>r&&r.start&&G[r.gubun]&&KINDS.includes(r.kind)).map(r=>({days:1,periods:[],time:'',reason:'',docs:[],gotForm:false,gotDocs:false,...r})):[];
  out.reasons=Array.isArray(d.reasons)?d.reasons.filter(x=>typeof x==='string'&&x.trim()):b.reasons;
  out.uid=Math.max(Number(d.uid)||1,...out.records.map(r=>r.id+1),1);
  return out;
}
function loadSaved(){try{const s=localStorage.getItem(STORE);if(s)return migrate(JSON.parse(s))}catch(e){}return null}
let saveWarned=false;
function save(){
  if(SAMPLE)return;
  try{localStorage.setItem(STORE,JSON.stringify(DB))}
  catch(e){if(!saveWarned){saveWarned=true;toast('이 브라우저에 저장하지 못했어요. 설정에서 백업 파일을 받아 두세요.')}}
}

let DB=blankDB(), SAMPLE=false;
const SET=()=>DB.settings;
const stu=no=>DB.students.find(s=>s.no===no);
/* 전입일부터 전출일 전날까지 우리 반 */
const activeOn=(s,d)=>(!s.joined||d>=s.joined)&&(!s.left||d<s.left);
const activeIn=(s,mo)=>monthDays(mo).some(d=>!isWE(d)&&activeOn(s,d));
const nowCount=()=>DB.students.filter(s=>activeOn(s,START_DAY)).length;
const rec=id=>DB.records.find(r=>r.id===id);

/* 교시·시간표 */
const lastP=s=>Number(SET().last[D(s).getDay()])||7;
const offP=(s,i)=>i>=1&&i<=7&&i>lastP(s);
const validP=s=>PER.map((_,i)=>i).filter(i=>!offP(s,i));
const subjOf=(s,i)=>((SET().subj[D(s).getDay()]||[])[i-1])||'';
/* 그 시각이 몇 교시인지: 시작 시각이 지난 칸 중 가장 늦은 것 (-1 = 조회 전) */
function curP(t,date){
  const m=toMin(t);if(m==null)return null;
  let cp=-1;
  for(let i=0;i<=7;i++){if(offP(date,i))continue;const st=toMin(SET().times[i]);if(st!=null&&st<=m)cp=i}
  return cp;
}

/* 기록 도우미 */
const label=r=>r.gubun+r.kind;
const kOf=r=>G[r.gubun].k;
const spanOf=r=>schoolDays(r.start,r.days);
const covers=(r,s)=>spanOf(r).includes(s);
const recOn=(no,s)=>DB.records.find(r=>r.no===no&&covers(r,s));
const needsForm=r=>G[r.gubun].form!==null;
/* 출석인정 중 사유가 '교외체험학습'이면 서류가 신청서·결과보고서로 바뀌어요 */
const isTrip=r=>!!r&&r.gubun==='출석인정'&&/교외\s*체험|체험\s*학습/.test(r.reason||'');
const formWord=r=>isTrip(r)?'신청서':r.gubun==='기타'?'의견서':'신고서';
const owes=r=>{const o=[];if(needsForm(r)&&!r.gotForm)o.push('form');if(isTrip(r)&&!r.gotReport)o.push('report');if(!isTrip(r)&&r.docs.length&&!r.gotDocs)o.push('docs');return o};
const oweWord=(r,w)=>w==='form'?formWord(r):w==='report'?'보고서':(r.docs[0]+(r.docs.length>1?' 외':''));
const owedCount=()=>DB.records.reduce((n,r)=>n+owes(r).length,0);
const inMonth=(r,mo)=>spanOf(r).some(x=>x.startsWith(mo));
const amount=(r,mo)=>r.kind==='결석'?spanOf(r).filter(x=>x.startsWith(mo)).length:1;
function cov(r,s){
  const c=PER.map((_,i)=>!offP(s,i)&&(r.kind==='결석'||r.periods.includes(i)));
  for(let i=1;i<c.length-1;i++) if(offP(s,i)&&c[i-1]&&c[i+1]) c[i]=true;
  return c;
}
function periodText(ps,s){
  const vp=validP(s),v=vp.filter(i=>ps.includes(i));
  if(!v.length) return '';
  const runs=[];let cur=[v[0]];
  for(let j=1;j<v.length;j++){ if(vp.indexOf(v[j])===vp.indexOf(v[j-1])+1) cur.push(v[j]); else {runs.push(cur);cur=[v[j]]} }
  runs.push(cur);
  return runs.map(r=>{const a=r[0],b=r[r.length-1];
    if(a===b) return PER[a];
    if(a>=1&&a<=7&&b>=1&&b<=7) return `${a}~${b}교시`;
    return `${PER[a]}~${PER[b]}`;}).join(', ');
}
function whenText(r){
  if(r.kind==='결석'){const ds=spanOf(r);return r.days===1?md(r.start):`${md(ds[0])} ~ ${md(ds[ds.length-1])} · ${r.days}일`}
  return md(r.start);
}
const periodInfo=r=>r.kind==='결석'?(r.days>1?`${r.days}일`:'하루'):`${periodText(r.periods,r.start)}${r.time?' · '+r.time:''}`;
function addReason(v){v=(v||'').trim();if(!v)return;DB.reasons=[v,...DB.reasons.filter(x=>x!==v)].slice(0,40)}

/* 되돌리기 */
let undoSnap=null;
const snap=()=>JSON.parse(JSON.stringify({records:DB.records,reasons:DB.reasons,students:DB.students}));

/* ───────── 예시 반 ───────── */
const NAMES=['강다온','고은솔','김나래','김민결','남하람','노유찬','류도아','문채윤','민시호','박가을','박이든','배소율','서하늘','손지안','송아린','신바다','안예솔','오로운','윤다빈','이새봄','이한결','임보람','장누리','정라온','조하율','최단비','한겨울','홍시원'];
function sampleDB(){
  const d=blankDB();
  d.settings={...d.settings,grade:'2',cls:'2',teacher:'홍길동',last:{1:6,2:7,3:6,4:7,5:6},
    subj:{1:['국어','수학','영어','과학','체육','사회',''],2:['영어','국어','미술','미술','수학','기술가정','창체'],3:['수학','과학','국어','영어','음악','체육',''],4:['사회','영어','수학','국어','정보','과학','창체'],5:['음악','과학','도덕','동아리','수학','역사','']}};
  d.students=NAMES.map((n,i)=>({no:i+1,name:n}));
  const keep=DB;DB=d;
  const t=START_DAY,b=n=>{let s=t;for(let i=0;i<n;i++)s=stepSchool(s,-1);return s};
  const from=(p,s)=>validP(s).filter(i=>i>=p);
  let id=1;
  const R=(no,start,gubun,kind,o={})=>{const r={id:id++,no,start,days:1,gubun,kind,periods:[],time:'',reason:'',docs:[],gotForm:false,gotDocs:false,...o};r.periods=r.periods.filter(i=>!offP(start,i));return r};
  d.records=[
    R(3,t,'질병','결과',{periods:[3,4],reason:'병원 진료',docs:['진료확인서']}),
    R(8,t,'질병','결석',{reason:'감기',docs:['처방전']}),
    R(14,t,'질병','지각',{periods:[0,1],gotForm:true}),
    R(21,t,'출석인정','조퇴',{periods:from(6,t),reason:'교내 대회 참가',docs:['기타 서류'],gotForm:true}),
    R(25,t,'미인정','지각',{periods:[0]}),
    R(25,b(3),'미인정','지각',{periods:[0]}),
    R(25,b(8),'미인정','지각',{periods:[0,1]}),
    R(5,b(3),'질병','결석',{days:3,reason:'장염',docs:['진료확인서']}),
    R(2,b(8),'질병','조퇴',{periods:from(5,b(8)),reason:'두통',docs:['진료확인서'],gotForm:true,gotDocs:true,printed:b(7)}),
    R(11,b(6),'기타','결석',{reason:'가정 사정',docs:['학부모 의견서'],gotForm:true,gotDocs:true,printed:b(6)}),
    R(17,b(4),'미인정','결석'),
    R(9,b(7),'출석인정','결석',{days:3,reason:'경조사(조부 상)',docs:['기타 서류'],gotForm:true,printed:b(7)}),
    R(20,b(9),'질병','지각',{periods:[0],gotForm:true,printed:b(9)}),
    R(26,b(1),'질병','결과',{periods:[5],reason:'병원 진료',docs:['진료확인서']}),
    R(3,b(5),'질병','결석',{reason:'감기',docs:['진료확인서'],gotForm:true,gotDocs:true,printed:b(5)}),
    R(14,b(5),'질병','조퇴',{periods:from(6,b(5)),reason:'복통',docs:['진료확인서'],gotForm:true,gotDocs:true,printed:b(5)}),
    R(16,b(6),'출석인정','결석',{days:2,reason:'교외체험학습',gotForm:true,printed:b(9)}),
  ];
  // 전학 예시: 27번은 전출, 29번은 전입
  const s27=d.students.find(s=>s.no===27);if(s27)s27.left=b(2);
  d.students.push({no:29,name:'도하준',joined:b(3)});
  d.uid=id;
  DB=keep;
  return d;
}

/* ───────── 상태 ───────── */
const st={screen:'hero',view:'day',date:START_DAY,month:monthOf(START_DAY),only:false,
  dmonth:monthOf(START_DAY),dfilter:'all',focus:null,checked:new Set()};

function render(){
  const app=$('#app');
  app.dataset.screen=st.screen;
  app.classList.toggle('sample',SAMPLE);
  if(st.screen==='hero'){renderHero();return}
  $('#tab-board').classList.toggle('on',st.screen==='board');
  $('#tab-docs').classList.toggle('on',st.screen==='docs');
  const s=SET();
  const who=[s.grade&&s.cls?`<b>${esc(s.grade)}학년 ${esc(s.cls)}반</b>`:'<b>우리 반</b>',`${nowCount()}명`,s.teacher?`담임 ${esc(s.teacher)}`:''].filter(Boolean).join(' · ');
  $('#cls').innerHTML=who;
  const o=owedCount();$('#owe-badge').textContent=o;$('#owe-badge').hidden=!o;
  if(st.screen==='board')renderBoard();
  if(st.screen==='docs')renderDocs();
  if(drawerNo!=null)drawDrawer();
}
function go(screen){closePop();closeDrop();st.screen=screen;render();scrollTo(0,0)}

/* ───────── 첫 화면 ───────── */
function renderHero(){
  const mine=loadSaved();
  const has=mine&&mine.students.length;
  const cta=$('.hero-cta');
  cta.innerHTML=has
    ?'<button class="btn primary lg" type="button" data-act="open-mine">내 반 출결판 열기</button><button class="btn lg" type="button" data-act="sample">예시 반으로 둘러보기</button>'
    :'<button class="btn primary lg" type="button" data-act="paste">명단 넣고 시작</button><button class="btn lg" type="button" data-act="sample">예시 반으로 둘러보기</button>';
  if(has)$('#paste').hidden=true;
  requestAnimationFrame(fitArt);
}
function buildArt(){
  const cells=()=>[3,4,5,6,7,8,9,10].map(c=>`<i style="grid-column:${c}"></i>`).join('');
  const rows=[
    {no:5,nm:'남하람',run:{c:'3/11',t:'t-sick',lab:'질병결석'}},
    {no:6,nm:'노유찬',run:{c:'8/11',t:'t-sick',lab:'질병조퇴',live:true},cur:8},
    {no:7,nm:'류도아'},
    {no:8,nm:'문채윤',run:{c:'3/5',t:'t-bad',lab:'미인정지각'}},
  ];
  let h='<div class="mb-h"><span style="grid-column:1">번호</span><span class="l" style="grid-column:2">이름</span>'+['조회','1','2','3','4','5','6','종례'].map((x,i)=>`<span style="grid-column:${i+3}">${x}</span>`).join('')+'</div>';
  for(const r of rows){
    h+=`<div class="mb-r"><span class="no" style="grid-column:1">${r.no}</span><span class="nm" style="grid-column:2">${r.nm}</span>${cells()}`;
    if(r.run)h+=`<span class="mb-run ${r.run.t}${r.run.live?' live':''}" style="grid-column:${r.run.c}">${r.run.lab}</span>`;
    if(r.cur)h+=`<span class="mb-cur" style="grid-column:${r.cur}"></span>`;
    h+='</div>';
  }
  $('#mb').innerHTML=h;
  $$('.pp .yr').forEach(e=>{e.textContent=new Date().getFullYear()}); // 그림 속 연도도 그해로
}
/* 그림(출결판 → 신고서)은 데스크톱에서 늘 가로 한 줄. 칸이 좁으면 통째로 줄여요 */
function fitArt(){
  const art=$('.art'),stage=$('#art-stage');if(!art||!stage)return;
  if(innerWidth<=720||!art.clientWidth){stage.style.transform='';stage.style.marginLeft='';art.style.height='';return}
  stage.style.transform='none';
  const w=stage.offsetWidth,h=stage.offsetHeight,avail=art.clientWidth,s=Math.min(1,avail/w);
  stage.style.transform=`scale(${s.toFixed(4)})`;
  stage.style.marginLeft=Math.max(0,(avail-w*s)/2)+'px';
  art.style.height=(h*s)+'px';
}
/* ───────── 명단 읽기 (붙여넣기·엑셀 파일 같은 방식) ─────────
   - '성명(이름)' 머리글이 있으면 그 칸을, '번호' 머리글이 있으면 그 칸을 써요. 학년·반 칸이 있으면 같이 읽어요.
   - 머리글이 없으면 줄마다 숫자 칸 = 번호, 이름처럼 생긴 칸 = 이름. 번호가 없으면 순서대로 1, 2, 3…
   - 성별·생년월일 같은 다른 칸은 건너뛰어요. 한 줄에 이름만 여럿 있으면 각각 한 명으로 읽어요. */
const NAME_STOP=/^(번호|번|이름|성명|성별|남자|여자|남|여|비고|학년|반|학반|재학|전입|전출|휴학|자퇴|생년월일|연락처)$/;
const isNameCell=v=>!!v&&!NAME_STOP.test(v)&&(/^[가-힣]{2,5}$/.test(v)||/^[A-Za-z][A-Za-z .'-]{1,30}$/.test(v));
const noOf=v=>{const m=/^(\d{1,3})\s*번?$/.exec(v||'');return m?Number(m[1]):null};
function textToRows(t){
  return String(t||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
    .map(l=>l.includes('\t')?l.split('\t'):l.includes(',')?l.split(','):l.split(/\s+/));
}
function rosterFromRows(rows){
  const R=rows.map(r=>(Array.isArray(r)?r:[r]).map(v=>String(v??'').replace(/\s+/g,' ').trim()));
  let h=-1,nameCol=-1,noCol=-1,gCol=-1,cCol=-1;
  for(let i=0;i<Math.min(R.length,20);i++){
    const nc=R[i].findIndex(v=>/^(성\s?명|이\s?름|학생\s?이름|학생명)$/.test(v));
    if(nc>=0){
      h=i;nameCol=nc;
      noCol=R[i].findIndex(v=>/^(번\s?호|출석\s?번호|학생\s?번호|번)$/.test(v));
      gCol=R[i].findIndex(v=>/^학\s?년$/.test(v));
      cCol=R[i].findIndex(v=>/^(반|학\s?반)$/.test(v));
      break;
    }
  }
  const raw=[],Gs=new Set(),Cs=new Set();
  if(h>=0){
    for(const r of R.slice(h+1)){
      const name=r[nameCol];
      if(!name||/^\d+$/.test(name)||NAME_STOP.test(name))continue;
      raw.push({no:noCol>=0?noOf(r[noCol]):null,name});
      if(gCol>=0&&/\d/.test(r[gCol]||''))Gs.add(r[gCol].replace(/\D/g,''));
      if(cCol>=0&&/\d/.test(r[cCol]||''))Cs.add(r[cCol].replace(/\D/g,''));
    }
  }else{
    for(const r of R){
      const nums=r.map(noOf).filter(n=>n!=null),names=r.filter(isNameCell);
      if(!names.length)continue;
      if(nums.length)raw.push({no:nums[0],name:names[0]});
      else names.forEach(n=>raw.push({no:null,name:n}));
    }
  }
  // 번호가 없거나 겹치면 뒤에 이어서 붙여요
  const used=new Set(),out=raw.map(s=>{if(s.no>0&&!used.has(s.no)){used.add(s.no);return s}return {...s,no:null}});
  let next=used.size?Math.max(...used):0;
  out.forEach(s=>{if(s.no==null)s.no=++next});
  out.sort((a,b)=>a.no-b.no);
  return {list:out,grade:Gs.size===1?[...Gs][0]:'',cls:Cs.size===1?[...Cs][0]:''};
}
const parseRoster=t=>rosterFromRows(textToRows(t)).list;
const rosterSummary=r=>r.length?`${r.length}명 읽었어요 · ${r[0].no}번 ${r[0].name} ~ ${r[r.length-1].no}번 ${r[r.length-1].name}`:'';
/* 첫 화면 명단: 붙여 넣거나 엑셀을 고르면 아래 표에서 번호·이름을 고칠 수 있어요 */
let pasteList=[];
function rosterError(list){
  const seen=new Map();
  for(const s of list){
    const name=String(s.name||'').trim();
    if(!name)return '이름이 빈 줄이 있어요. 이름을 넣거나 ×로 빼 주세요.';
    if(!(Number.isInteger(s.no)&&s.no>=1&&s.no<=99))return `${name}의 번호를 1~99 숫자로 넣어 주세요.`;
    if(seen.has(s.no))return `${s.no}번이 겹쳐요 (${seen.get(s.no)}, ${name}). 번호를 고쳐 주세요.`;
    seen.set(s.no,name);
  }
  return '';
}
function pasteStatus(){
  const err=rosterError(pasteList);
  const sorted=pasteList.slice().sort((a,b)=>a.no-b.no);
  $('#paste-n').textContent=err||(pasteList.length?rosterSummary(sorted)+'. 표에서 번호·이름을 고칠 수 있어요.':'한 줄에 한 명씩이에요.');
  $('#paste-n').classList.toggle('warn',!!err);
}
function renderPasteTable(focusLast){
  const box=$('#paste-table');
  $('#paste-ta').classList.toggle('short',pasteList.length>0);
  if(!pasteList.length){box.innerHTML='';box.hidden=true;return}
  box.hidden=false;
  box.innerHTML=`<table class="rt"><thead><tr><th>번호</th><th>이름</th><th></th></tr></thead><tbody>${pasteList.map((s,i)=>`<tr data-i="${i}"><td><input type="number" class="txt num" min="1" max="99" data-pf="no" value="${Number.isFinite(s.no)?s.no:''}" aria-label="번호"></td><td><input class="txt" data-pf="name" value="${esc(s.name)}" aria-label="이름" placeholder="이름"></td><td class="acts"><button type="button" class="xdel" data-act="pdel" data-i="${i}" aria-label="${esc(s.name)} 빼기" title="빼기">×</button></td></tr>`).join('')}<tr class="addrow"><td colspan="3"><button type="button" class="btn link" data-act="padd">+ 한 명 더</button></td></tr></tbody></table>`;
  if(focusLast){const ins=$$('#paste-table input[data-pf="name"]');ins[ins.length-1]?.focus()}
}
const pasteToText=()=>{$('#paste-ta').value=pasteList.map(s=>(Number.isFinite(s.no)?s.no:'')+'\t'+s.name).join('\n')};
function setPasteList(list){pasteList=list.map(s=>({no:s.no,name:s.name}));renderPasteTable();pasteStatus()}
$('#paste-ta').addEventListener('input',e=>{setPasteList(parseRoster(e.target.value))});
$('#paste-table').addEventListener('input',e=>{
  const t=e.target,tr=t.closest('tr[data-i]');if(!tr)return;
  const s=pasteList[Number(tr.dataset.i)];if(!s)return;
  if(t.dataset.pf==='no')s.no=t.value===''?NaN:Number(t.value);
  if(t.dataset.pf==='name')s.name=t.value;
  pasteToText();pasteStatus();
});

/* 엑셀 파일: 이 컴퓨터 안에서만 읽어요(서버로 보내지 않아요). xlsx·xls는 SheetJS(vendor/), csv는 직접 읽어요. */
let xlsxP=null,pickTarget='paste-ta';
function loadXLSX(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(!xlsxP)xlsxP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='vendor/xlsx.full.min.js';s.onload=()=>res(window.XLSX);s.onerror=()=>{xlsxP=null;rej(new Error('load'))};document.head.append(s)});
  return xlsxP;
}
async function readRosterFile(file){
  const buf=await file.arrayBuffer();
  if(/\.(csv|txt)$/i.test(file.name)){
    let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(e){text=new TextDecoder('euc-kr').decode(buf)}
    return rosterFromRows(textToRows(text));
  }
  const X=await loadXLSX();
  const wb=X.read(buf,{type:'array'});
  let best={list:[],grade:'',cls:''};
  for(const sn of wb.SheetNames){ // 이름이 가장 많이 나오는 시트를 골라요
    const r=rosterFromRows(X.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:false,defval:''}));
    if(r.list.length>best.list.length)best=r;
  }
  return best;
}
async function handleRosterFile(f,target){
  const toRoster=target==='rmodal',msg=toRoster?$('#r-msg'):$('#paste-n');
  if(!msg)return;
  msg.classList.remove('warn');
  msg.textContent=`${f.name} 읽는 중…`;
  try{
    const res=await readRosterFile(f);
    if(!res.list.length){msg.textContent=`${f.name}에서 이름을 찾지 못했어요. '성명' 또는 '이름' 칸이 있는지 확인해 주세요.`;return}
    if(toRoster){rosterFromExcel(res.list);$('#r-msg').textContent=`엑셀에서 ${rosterSummary(res.list)}. 저장을 눌러야 바뀌어요.`;return}
    setPasteList(res.list);pasteToText();
    if(res.grade&&!$('#paste-grade').value)$('#paste-grade').value=res.grade;
    if(res.cls&&!$('#paste-cls').value)$('#paste-cls').value=res.cls;
    msg.textContent=`엑셀에서 ${rosterSummary(res.list)}. 아래 표에서 번호·이름을 고칠 수 있어요.`;
  }catch(err){
    msg.textContent=navigator.onLine||window.XLSX?`${f.name}을 읽지 못했어요. 엑셀(.xlsx·.xls)이나 .csv 파일인지 확인해 주세요.`:'엑셀을 읽는 도구를 아직 못 받았어요. 인터넷이 될 때 다시 해 주세요.';
  }
}
$('#xlsx-in').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(f)handleRosterFile(f,pickTarget);e.target.value=''});
function dropZone(el,target){
  if(!el)return;
  el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag')});
  el.addEventListener('dragleave',()=>el.classList.remove('drag'));
  el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag');const f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f)handleRosterFile(f,target)});
}
dropZone($('#paste'),'paste-ta');
// 놓을 곳 밖에 파일을 떨어뜨려도 브라우저가 파일을 열며 앱을 떠나지 않게
addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault()});
addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files.length)e.preventDefault()});
function enterBoard(){
  st.view='day';st.date=START_DAY;st.month=monthOf(START_DAY);st.dmonth=monthOf(START_DAY);st.only=false;st.focus=null;st.checked=new Set();
  go('board');
  maybeTour();
}

/* ───────── 출결판 ───────── */
function renderBoard(){
  $$('#board .seg button').forEach(b=>{b.classList.toggle('on',b.dataset.view===st.view);b.setAttribute('aria-selected',b.dataset.view===st.view)});
  const t=$('#title');
  if(st.view==='day'){const d=D(st.date);t.innerHTML=`${d.getMonth()+1}월 ${d.getDate()}일<small>${WD[d.getDay()]}요일</small>${st.date===TODAY?'<span class="now">오늘</span>':''}`}
  else{const[y,m]=st.month.split('-');t.innerHTML=`${y}년 ${Number(m)}월`}
  renderSum();
  st.view==='day'?renderDay():renderMonth();
  $('#foot').innerHTML=st.view==='day'
    ?'<span><b>빈 칸은 출석</b>이에요. 이름이나 칸을 누르면 넣을 수 있어요.</span><span>사유 칸은 눌러서 바로 쓰고, ▾ 목록에서 고를 수 있어요.</span><span>이 컴퓨터에만 저장돼요 · 나이스 입력은 따로 해야 해요</span>'
    :'<span><b>이름</b>을 누르면 그 학생의 한 달 기록이 목록으로 나와요.</span><span>날짜를 누르면 그날 교시별로 봐요.</span><span><b>주황 점</b>은 아직 덜 받은 신고서·서류예요.</span>';
}
function renderSum(){
  let html='';
  if(st.view==='day'){
    const rs=DB.records.filter(r=>covers(r,st.date));
    const c=k=>rs.filter(r=>r.kind===k).length;
    html+=`<div class="stat"><span class="lead">${st.date===TODAY?'오늘':'이날'}</span>${KINDS.map(k=>`<span>${k}<b>${c(k)}</b></span>`).join('')}</div>`;
  }else{
    const days=monthDays(st.month).filter(s=>!isWE(s));
    const rs=DB.records.filter(r=>inMonth(r,st.month));
    const ab=rs.filter(r=>r.kind==='결석').reduce((n,r)=>n+amount(r,st.month),0);
    const c=k=>rs.filter(r=>r.kind===k).length;
    html+=`<div class="stat"><span class="lead">평일 ${days.length}일</span><span>결석<b>${ab}일</b></span>${['지각','조퇴','결과'].map(k=>`<span>${k}<b>${c(k)}</b></span>`).join('')}</div>`;
  }
  const o=owedCount();
  html+=o?`<button type="button" class="owe" data-act="go-owe"><i></i>덜 받은 서류 ${o}건</button>`:'<span class="owe none">✓ 서류 다 받음</span>';
  html+=`<label class="switch"><input type="checkbox" id="only" ${st.only?'checked':''}> 기록 있는 학생만</label>`;
  html+=`<div class="legend">${GK.map(g=>`<span class="t-${G[g].k}"><i></i>${g}</span>`).join('')}${st.view==='month'?'<span><em class="solid">결</em>하루 결석</span><span><em class="soft">조</em>지각·조퇴·결과</span><span><i class="od"></i>덜 받음</span>':''}</div>`;
  $('#sum').innerHTML=html;
  $('#only').addEventListener('change',e=>{st.only=e.target.checked;renderBoard()});
}
function statusCells(r,pre){
  let f,d;
  const fw=formWord(r);
  if(!needsForm(r)) f='<span class="na">신고서 없음</span>';
  else f=`<button type="button" class="pill ${r.gotForm?'done':'todo'}" data-act="recv" data-id="${r.id}" data-what="form"><span class="dot"></span>${pre||isTrip(r)?`<span class="pre">${fw}</span>`:''}${r.gotForm?'받음':'안 받음'}</button>`;
  if(isTrip(r)) d=`<button type="button" class="pill ${r.gotReport?'done':'todo'}" data-act="recv" data-id="${r.id}" data-what="report"><span class="dot"></span><span class="pre">보고서</span>${r.gotReport?'받음':'안 받음'}</button>`;
  else if(!r.docs.length) d=pre?'':'<span class="na">—</span>';
  else d=`<button type="button" class="pill ${r.gotDocs?'done':'todo'}" data-act="recv" data-id="${r.id}" data-what="docs" title="${esc(r.docs.join(', '))}"><span class="dot"></span>${esc(r.docs[0])}${r.docs.length>1?` 외 ${r.docs.length-1}`:''}${pre?(r.gotDocs?' 받음':' 안 받음'):''}</button>`;
  return [f,d];
}
const rsInput=(r,name)=>`<input class="rs-in" data-rs="rec" data-id="${r.id}" value="${esc(r.reason)}" placeholder="사유 넣기" autocomplete="off" aria-label="${esc(name)} 사유">`;

function renderDay(){
  const s0=st.date;
  let h='<table class="bt day"><thead><tr><th class="c-no">번호</th><th class="c-nm">이름</th>';
  PER.forEach((p,i)=>{
    const tm=i<=7?SET().times[i]:'';
    const sb=i>=1&&i<=7?(offP(s0,i)?'없음':subjOf(s0,i)):'';
    h+=`<th class="pd${offP(s0,i)?' off':''}">${p}<small>${esc(sb)||'&nbsp;'}</small><small class="tm">${tm||'&nbsp;'}</small></th>`;
  });
  h+='<th class="c-st">신고서</th><th class="c-st">서류</th><th class="c-rs">사유</th></tr></thead><tbody>';
  let tourCell=false,tourStatus=false,rows=0;
  for(const s of DB.students){
    if(!activeOn(s,s0))continue;
    const r=recOn(s.no,s0);
    if(st.only&&!r) continue;
    rows++;
    h+=`<tr><td class="c-no">${s.no}</td><td class="c-nm"><button type="button" class="name" data-act="open" data-no="${s.no}" data-date="${s0}" title="${esc(s.name)} 출결 넣기">${esc(s.name)}</button></td>`;
    const c=r?cov(r,s0):PER.map(()=>false);
    for(let i=0;i<PER.length;i++){
      const off=offP(s0,i);
      const attrs=off?'':`data-act="open" data-no="${s.no}" data-date="${s0}" data-p="${i}"`;
      if(!c[i]){h+=`<td class="p empty${off?' off':''}" ${attrs}></td>`;continue}
      const sOf=i===0||!c[i-1], eOf=i===PER.length-1||!c[i+1];
      let lab='';
      if(sOf){let n=0;while(i+n<PER.length&&c[i+n])n++;lab=`<span class="lab">${n>=2?label(r):r.kind}${n>=2&&r.time&&r.kind!=='결석'?`<em>${r.time}</em>`:''}</span>`}
      const tid=(!tourCell&&r.kind!=='결석'&&sOf)?(tourCell=true,' id="tour-cell"'):'';
      h+=`<td class="p t-${kOf(r)}"${tid} ${attrs} title="${label(r)}${r.time?' '+r.time:''}${r.reason?' · '+esc(r.reason):''}"><span class="run${sOf?' s':''}${eOf?' e':''}"></span>${lab}</td>`;
    }
    if(r){
      let [f,d]=statusCells(r);
      if(!tourStatus&&owes(r).length){tourStatus=true;if(owes(r)[0]==='form')f=f.replace('class="pill','data-tour="status" class="pill');else d=d.replace('class="pill','data-tour="status" class="pill')}
      h+=`<td class="c-st">${f}</td><td class="c-st">${d}</td><td class="c-rs">${rsInput(r,s.name)}</td>`;
    }else h+='<td class="c-st"></td><td class="c-st"></td><td class="c-rs"></td>';
    h+='</tr>';
  }
  h+='</tbody></table>';
  if(!rows)h+=`<div class="empty-msg">${st.only?'이날은 기록이 없어요. 모두 출석이에요.':'명단이 비어 있어요. 설정에서 명단을 넣어 주세요.'}</div>`;
  $('#grid').innerHTML=h;
}

function monthDays(mo){const[y,m]=mo.split('-').map(Number);const n=new Date(y,m,0).getDate();return [...Array(n)].map((_,i)=>S(new Date(y,m-1,i+1)))}
function tallyChips(rs,mo){
  const out=[];
  for(const k of KINDS)for(const g of GK){
    const n=rs.filter(r=>r.gubun===g&&r.kind===k).reduce((a,r)=>a+amount(r,mo),0);
    if(n)out.push(`<span class="cc t-${G[g].k}${k==='결석'?' full':''}" title="${g}${k} ${n}${k==='결석'?'일':'번'}">${KCH[k]}${n}</span>`);
  }
  return out.join('');
}
function renderMonth(){
  const days=monthDays(st.month);
  let h='<table class="bt month"><thead><tr><th class="c-no">번호</th><th class="c-nm">이름</th>';
  for(const s of days){
    if(isWE(s)){h+=`<th class="we" aria-label="${mdS(s)} 주말"></th>`;continue}
    const d=D(s);
    h+=`<th class="d${s===TODAY?' today':''}${s>TODAY?' future':''}" data-act="goday" data-date="${s}" title="${md(s)} 교시별로 보기"><b>${d.getDate()}</b><small>${WD[d.getDay()]}</small></th>`;
  }
  h+='<th class="cnt">학생별 한 달</th><th class="owecol">챙길 서류</th></tr></thead><tbody>';
  let rows=0;
  for(const s of DB.students){
    if(!activeIn(s,st.month))continue;
    const rs=DB.records.filter(r=>r.no===s.no&&inMonth(r,st.month)).sort((a,b)=>a.start<b.start?-1:1);
    if(st.only&&!rs.length) continue;
    rows++;
    const stag=s.left&&s.left.startsWith(st.month)?`<span class="stag" title="${md(s.left)}부터 전출">전출 ${mdS(s.left)}</span>`:s.joined&&s.joined.startsWith(st.month)?`<span class="stag in" title="${md(s.joined)}부터 전입">전입 ${mdS(s.joined)}</span>`:'';
    h+=`<tr><td class="c-no">${s.no}</td><td class="c-nm"><button type="button" class="name" data-act="card" data-no="${s.no}" title="${esc(s.name)} 한 달 기록 보기">${esc(s.name)}</button>${stag}</td>`;
    for(const d of days){
      if(isWE(d)){h+='<td class="we"></td>';continue}
      if(!activeOn(s,d)){h+=`<td class="d out" title="${s.left&&d>=s.left?'전출 뒤':'전입 전'}"></td>`;continue}
      const r=rs.find(x=>covers(x,d));
      const cls=`d${d===TODAY?' today':''}${r?'':' empty'}`;
      if(r){
        const dot=d===r.start&&owes(r).length?'<span class="pd"></span>':'';
        h+=`<td class="${cls}" data-act="open" data-no="${s.no}" data-date="${d}" title="${md(d)} · ${label(r)}${r.reason?' · '+esc(r.reason):''}"><span class="chip t-${kOf(r)}${r.kind==='결석'?' full':''}">${KCH[r.kind]}${dot}</span></td>`;
      }else h+=`<td class="${cls}" data-act="open" data-no="${s.no}" data-date="${d}"></td>`;
    }
    h+=`<td class="cnt"><button type="button" class="tally" data-act="card" data-no="${s.no}" title="${esc(s.name)} 한 달 기록 보기">${tallyChips(rs,st.month)||'<span class="na">없음</span>'}<span class="go">›</span></button></td>`;
    let o='';
    for(const r of rs){
      const ow=owes(r);if(!ow.length)continue;
      const what=w=>oweWord(r,w);
      o+=`<span class="oweR" title="${label(r)}"><em>${mdS(r.start)}</em>${ow.map(w=>`<button type="button" data-act="recv" data-id="${r.id}" data-what="${w}" title="받았으면 누르세요"><i></i>${esc(what(w))}</button>`).join('')}</span>`;
    }
    if(!o&&rs.length) o=rs.some(r=>needsForm(r)||r.docs.length)?'<span class="alldone">✓ 다 받음</span>':'<span class="na">신고서 없음</span>';
    h+=`<td class="owecol">${o}</td></tr>`;
  }
  h+='</tbody></table>';
  if(!rows)h+='<div class="empty-msg">이번 달은 기록이 없어요.</div>';
  $('#grid').innerHTML=h;
  const tc=$('#grid th.today');
  if(tc){const sc=$('#grid');sc.scrollLeft=Math.max(0,tc.offsetLeft-sc.clientWidth/2)}
}

/* ───────── 학생별 한 달 목록 ───────── */
let drawerNo=null,drawerMonth=null;
function openDrawer(no,mo){
  closePop();
  drawerNo=no;drawerMonth=mo||(st.screen==='board'&&st.view==='month'?st.month:monthOf(st.date));
  if(!$('#drawer')){
    const d=document.createElement('aside');d.id='drawer';d.className='drawer';d.setAttribute('role','dialog');d.setAttribute('aria-label','학생별 한 달 기록');
    document.body.append(d);
    d.addEventListener('click',onDrawer);
  }
  drawDrawer();
}
function closeDrawer(){$('#drawer')?.remove();drawerNo=null}
function drawDrawer(){
  const dr=$('#drawer'),s=stu(drawerNo);if(!dr)return;if(!s)return closeDrawer();
  const mo=drawerMonth,m=Number(mo.slice(5,7));
  const rs=DB.records.filter(r=>r.no===s.no&&inMonth(r,mo)).sort((a,b)=>a.start<b.start?-1:1);
  const tot=k=>rs.filter(r=>r.kind===k).reduce((n,r)=>n+amount(r,mo),0);
  let h=`<div class="dr-h"><b>${s.no}번 ${esc(s.name)}</b><div class="mnav"><button type="button" class="icon" data-dr="prev" aria-label="지난달">‹</button><span>${mo.slice(0,4)}.${m}월</span><button type="button" class="icon" data-dr="next" aria-label="다음 달">›</button></div><button type="button" class="icon x" data-dr="close" aria-label="닫기">×</button></div>`;
  h+=`<div class="dr-sum"><span class="tot">결석 <b>${tot('결석')}일</b> · 지각 <b>${tot('지각')}</b> · 조퇴 <b>${tot('조퇴')}</b> · 결과 <b>${tot('결과')}</b></span>${tallyDetail(rs,mo)}</div><div class="dr-b">`;
  if(!rs.length)h+=`<div class="dr-empty">${m}월에는 기록이 없어요. 모두 출석이에요.</div>`;
  else{
    h+='<table class="lt"><thead><tr><th>날짜</th><th>출결</th><th>교시·시각</th><th>사유</th><th>신고서·서류</th><th></th></tr></thead><tbody>';
    for(const r of rs){
      const [f,d]=statusCells(r,true);
      const ds=spanOf(r);
      const date=r.kind==='결석'&&r.days>1?`${mdS(ds[0])}~${mdS(ds[ds.length-1])}<small>${r.days}일</small>`:`${mdS(r.start)}<small>${WD[D(r.start).getDay()]}요일</small>`;
      h+=`<tr><td class="dt">${date}</td><td class="tg"><span class="tag t-${kOf(r)}">${label(r)}</span></td><td class="pr">${esc(periodInfo(r))}</td><td class="rs">${rsInput(r,s.name)}</td><td class="stc">${f}${d}</td><td class="ed"><button type="button" class="lnk" data-dr="edit" data-id="${r.id}">고치기</button></td></tr>`;
    }
    h+='</tbody></table>';
  }
  h+=`</div><div class="dr-f"><button type="button" class="btn" data-dr="add">이 학생 출결 넣기</button></div>`;
  dr.innerHTML=h;
}
function tallyDetail(rs,mo){
  const out=[];
  for(const g of GK)for(const k of KINDS){
    const n=rs.filter(r=>r.gubun===g&&r.kind===k).reduce((a,r)=>a+amount(r,mo),0);
    if(n)out.push(`<span class="tag t-${G[g].k}">${g}${k} ${n}${k==='결석'?'일':'번'}</span>`);
  }
  return out.join('');
}
function onDrawer(e){
  const b=e.target.closest('[data-dr]');if(!b)return;
  e.stopPropagation();
  const a=b.dataset.dr;
  if(a==='close')return closeDrawer();
  if(a==='prev'||a==='next'){drawerMonth=shiftMonth(drawerMonth,a==='prev'?-1:1);return drawDrawer()}
  if(a==='edit'){const r=rec(Number(b.dataset.id));if(r)openPop(r.no,r.start,null,b);return}
  if(a==='add'){const d=TODAY.startsWith(drawerMonth)&&!isWE(TODAY)?TODAY:schoolDays(drawerMonth+'-01',1)[0];openPop(drawerNo,d,null,b)}
}

/* ───────── 사유 목록 (고르기·지우기) ───────── */
const drop=$('#rsdrop');
let dropIn=null,dropIdx=-1,dropTyped=false;
function dropList(){const q=dropTyped&&dropIn?dropIn.value.trim():'';return q?DB.reasons.filter(x=>x.includes(q)):DB.reasons.slice()}
function openDrop(inp){dropIn=inp;dropIdx=-1;dropTyped=false;drawDrop()}
function closeDrop(){drop.hidden=true;dropIn=null}
function hl(x,q){if(!q)return esc(x);const i=x.indexOf(q);return i<0?esc(x):esc(x.slice(0,i))+'<mark>'+esc(q)+'</mark>'+esc(x.slice(i+q.length))}
function drawDrop(){
  if(!dropIn||!document.body.contains(dropIn))return closeDrop();
  const list=dropList(),q=dropTyped?dropIn.value.trim():'';
  let h;
  if(!DB.reasons.length)h='<div class="rd-empty">아직 남긴 사유가 없어요. 쓰고 Enter를 누르면 목록에 남아요.</div>';
  else if(!list.length)h=`<div class="rd-empty">"${esc(q)}"는 목록에 없어요. 저장하면 새로 남아요.</div>`;
  else h=list.map((x,i)=>`<div class="rd-row${i===dropIdx?' on':''}"><button type="button" class="rd-pick" data-v="${esc(x)}" tabindex="-1">${hl(x,q)}</button><button type="button" class="rd-del" data-v="${esc(x)}" tabindex="-1" aria-label="${esc(x)} 목록에서 지우기" title="목록에서 지우기">×</button></div>`).join('')+'<div class="rd-foot">×를 누르면 목록에서만 지워져요. 이미 쓴 기록은 그대로예요.</div>';
  drop.innerHTML=h;drop.hidden=false;placeDrop();
}
function placeDrop(){
  if(!dropIn)return;
  const r=dropIn.getBoundingClientRect();
  drop.style.minWidth=Math.max(220,r.width)+'px';
  const h=drop.offsetHeight,w=drop.offsetWidth;
  let top=r.bottom+4;if(top+h>innerHeight-8)top=Math.max(8,r.top-h-4);
  drop.style.top=top+'px';drop.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';
}
drop.addEventListener('mousedown',e=>e.preventDefault());
drop.addEventListener('click',e=>{
  e.stopPropagation();
  const pick=e.target.closest('.rd-pick'),del=e.target.closest('.rd-del');
  if(del){
    const v=del.dataset.v,before=snap();
    DB.reasons=DB.reasons.filter(x=>x!==v);save();drawDrop();refreshReasonChips();
    toast(`"${v}"를 사유 목록에서 지웠어요`,before);return;
  }
  if(pick)choose(pick.dataset.v);
});
function choose(v){const inp=dropIn;if(!inp)return;inp.value=v;closeDrop();commitReason(inp)}
function commitReason(inp){
  const v=inp.value.trim();
  if(inp.dataset.rs==='pop'){if(draft){draft.reason=v;refreshParts();refreshReasonChips()}return}
  const r=rec(Number(inp.dataset.id));if(!r)return;
  if(v===r.reason)return;
  const before=snap();r.reason=v;addReason(v);save();
  $$(`[data-rs="rec"][data-id="${r.id}"]`).forEach(x=>{if(x!==inp)x.value=v});
  if(st.screen==='docs'){renderPaper();renderDocList()}
  toast(`${stu(r.no)?.name||''} 사유를 ${v?'고쳤어요':'비웠어요'}`,before);
}
document.addEventListener('focusin',e=>{const t=e.target;if(t.matches&&t.matches('[data-rs]')){t.dataset.orig=t.value;openDrop(t)}});
document.addEventListener('focusout',e=>{if(e.target===dropIn)setTimeout(()=>{if(dropIn&&document.activeElement!==dropIn)closeDrop()},0)});
document.addEventListener('input',e=>{if(e.target===dropIn){dropTyped=true;dropIdx=-1;drawDrop()}});
document.addEventListener('change',e=>{const t=e.target;if(t.matches&&t.matches('[data-rs="rec"]'))commitReason(t)});
document.addEventListener('keydown',e=>{
  const t=e.target;
  if(!(t.matches&&t.matches('[data-rs]')))return;
  const open=!drop.hidden&&dropIn===t,list=open?dropList():[];
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    if(!open){openDrop(t);e.preventDefault();return}
    if(!list.length)return;
    e.preventDefault();
    dropIdx=e.key==='ArrowDown'?(dropIdx+1)%list.length:(dropIdx<=0?list.length-1:dropIdx-1);
    drawDrop();const on=$('.rd-row.on',drop);if(on)on.scrollIntoView({block:'nearest'});return;
  }
  if(e.key==='Enter'){
    e.preventDefault();e.stopPropagation();
    if(open&&dropIdx>=0&&list[dropIdx]){choose(list[dropIdx]);if(t.dataset.rs==='rec')t.blur();return}
    closeDrop();
    if(t.dataset.rs==='rec'){t.blur();return}
    if(t.dataset.rs==='pop'){draft&&(draft.reason=t.value.trim());save_();return}
    return;
  }
  if(e.key==='Escape'){
    e.preventDefault();e.stopPropagation();
    if(open){closeDrop();return}
    if(t.dataset.rs==='rec'){t.value=t.dataset.orig??t.value;t.blur()}
    else if(t.dataset.rs==='pop')closePop();
  }
},true);
addEventListener('scroll',()=>{if(!drop.hidden)placeDrop()},true);

/* ───────── 알림 ───────── */
let toastTimer;
function toast(msg,undo){
  $('#toast-t').textContent=msg;
  const u=$('#toast-undo');u.hidden=!undo;undoSnap=undo||null;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),undo?5600:2800);
}
$('#toast-undo').addEventListener('click',()=>{
  if(!undoSnap)return;
  DB.records=undoSnap.records;DB.reasons=undoSnap.reasons;if(undoSnap.students)DB.students=undoSnap.students;undoSnap=null;
  save();render();refreshReasonChips();toast('되돌렸어요');
});

/* ───────── 입력 창 ───────── */
let draft=null,popX=null,anchorEl=null,warn=false;
function openPop(no,date,p,anchor){
  closePop();closeDrop();
  if(isWE(date))date=stepSchool(date,-1);
  const ex=recOn(no,date);
  const pn=p==null||p===''?null:Number(p);
  draft=ex?JSON.parse(JSON.stringify(ex)):{id:null,no,start:date,days:1,gubun:'질병',kind:'결석',periods:[],time:'',reason:'',docs:[],gotForm:false,gotDocs:false};
  draft.p=pn; // 표의 교시 칸을 눌러 열었으면 그 교시로 미리 채워요
  warn=false;anchorEl=anchor;
  if(anchor&&anchor.tagName==='TD')anchor.classList.add('anchored');
  const c=document.createElement('div');c.className='catch';c.id='catch';
  const pop=document.createElement('div');pop.className='pop';pop.id='pop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','출결 넣기');pop.tabIndex=-1;
  document.body.append(c,pop);
  pop.addEventListener('click',onPop);
  pop.addEventListener('input',e=>{
    if(e.target.id==='pop-reason'){draft.reason=e.target.value;refreshReasonChips();refreshParts()}
  });
  popX=null;drawPop();
  pop.focus({preventScroll:true});
}
function closePop(){
  if(dropIn&&dropIn.dataset.rs==='pop')closeDrop();
  $('#pop')?.remove();$('#catch')?.remove();
  $$('td.anchored').forEach(t=>t.classList.remove('anchored'));
  draft=null;
}
/* 교시 한 번에 채우기
   - 지각: 누른 교시까지 (조회~그 교시)   - 조퇴: 누른 교시부터 (그 교시~종례)   - 결과: 누른 교시만 하나씩
   - 같은 칸을 다시 누르면 비워져요. 표의 교시 칸을 눌러 열었으면 그 교시로 미리 채워요. */
const upTo=(s,q)=>validP(s).filter(i=>i<=q);
const fromQ=(s,q)=>validP(s).filter(i=>i>=q);
function fillByP(){
  const p=draft.p;
  if(draft.kind==='결석'||p==null||!validP(draft.start).includes(p)){draft.periods=[];return}
  draft.periods=draft.kind==='지각'?upTo(draft.start,p):draft.kind==='조퇴'?fromQ(draft.start,p):[p];
}
function tapPeriod(q){
  const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
  if(draft.kind==='지각'){const want=upTo(draft.start,q);draft.periods=same(draft.periods,want)?[]:want;return}
  if(draft.kind==='조퇴'){const want=fromQ(draft.start,q);draft.periods=same(draft.periods,want)?[]:want;return}
  draft.periods=draft.periods.includes(q)?draft.periods.filter(i=>i!==q):[...draft.periods,q].sort((a,b)=>a-b);
}
function periodHint(){
  if(warn)return '교시를 골라 주세요';
  return {'지각':'누른 교시까지 조회부터 한 번에 채워져요. 같은 칸을 다시 누르면 비워져요.','조퇴':'누른 교시부터 종례까지 한 번에 채워져요. 같은 칸을 다시 누르면 비워져요.','결과':'빠진 교시를 하나씩 눌러 골라요.'}[draft.kind]||'';
}
const timeHint=periodHint;
const perChips=()=>PER.map((_,i)=>{const off=offP(draft.start,i),tm=i<=7?SET().times[i]:'';return `<button type="button" class="ch p${draft.periods.includes(i)?' on':''}" data-pop="period" data-v="${i}" ${off?'disabled title="이날은 이 교시가 없어요"':''}><span>${PCH[i]}</span>${tm?`<small>${tm}</small>`:''}</button>`}).join('');
function summary(){
  const g=G[draft.gubun];
  let when;
  if(draft.kind==='결석'){
    const ds=schoolDays(draft.start,draft.days);
    when=draft.days===1?`${md(draft.start)} 하루`:`${md(ds[0])} ~ ${md(ds[ds.length-1])}, ${draft.days}일`;
  }else{
    const pt=periodText(draft.periods,draft.start);
    when=`${md(draft.start)}${draft.time?' '+draft.time:''} · ${pt||'교시를 골라 주세요'}`;
  }
  const form=isTrip(draft)?'교외체험학습 신청서(통보서)·결과보고서':g.form?`${g.form} ${draft.gubun==='기타'?'2장':'1장'}`:'신고서 없이 출결판에만 남아요';
  return `<span class="t-${g.k}"><b>${draft.gubun}${draft.kind}</b></span> · ${when}<br>${form}`;
}
function docRowHTML(){
  if(draft.gubun==='미인정')return '';
  if(isTrip(draft))return '<span class="k">서류</span><div class="hint trip-note">교외체험학습은 <b>신청서</b>와 <b>결과보고서</b>를 챙겨요. 서류함에서 학교 양식으로 뽑을 수 있어요.</div>';
  return `<span class="k">서류</span><div><div class="chips">${DOCS.map(x=>`<button type="button" class="ch xs${draft.docs.includes(x)?' on':''}" data-pop="doc" data-v="${x}">${x}</button>`).join('')}</div><div class="hint">안 골라도 돼요. 비워 두면 신고서에 빈칸으로 나가요.</div></div>`;
}
function recvHTML(){
  if(!G[draft.gubun].form)return '';
  if(isTrip(draft))return `<button type="button" class="tog${draft.gotForm?' on':''}" data-pop="gotForm"><i>✓</i>신청서 받음</button><button type="button" class="tog${draft.gotReport?' on':''}" data-pop="gotReport"><i>✓</i>보고서 받음</button>`;
  return `<button type="button" class="tog${draft.gotForm?' on':''}" data-pop="gotForm"><i>✓</i>${draft.gubun==='기타'?'의견서':'신고서'} 받음</button><button type="button" class="tog${draft.gotDocs?' on':''}" data-pop="gotDocs" ${draft.docs.length?'':'disabled title="고른 서류가 없어요"'}><i>✓</i>서류 받음</button>`;
}
function refreshParts(){
  const p=$('#pop-per');if(p)p.innerHTML=perChips();
  const h=$('#pop-thint');if(h){h.textContent=periodHint();h.classList.toggle('warn',warn)}
  const s=$('#pop-sum');if(s)s.innerHTML='→ '+summary();
  // 사유를 '교외체험학습'으로 바꾸면 서류 칸과 받음 체크가 바로 바뀌어요
  const dr=$('#pop-docrow');if(dr&&dr.dataset.trip!==String(isTrip(draft))){dr.dataset.trip=String(isTrip(draft));dr.innerHTML=docRowHTML()}
  const rv=$('#pop-recv');if(rv){const want=recvHTML();if(rv.dataset.trip!==String(isTrip(draft))){rv.dataset.trip=String(isTrip(draft));rv.innerHTML=want}}
  place();
}
function refreshReasonChips(){
  const box=$('#pop-rchips');if(!box||!draft)return;
  box.innerHTML=DB.reasons.slice(0,5).map(x=>`<button type="button" class="ch xs rsn${draft.reason===x?' on':''}" data-pop="reason" data-v="${esc(x)}">${esc(x)}</button>`).join('');
}
function drawPop(){
  const pop=$('#pop');if(!pop)return;
  if(dropIn&&dropIn.dataset.rs==='pop')closeDrop();
  const s=stu(draft.no),g=G[draft.gubun];
  let h=`<div class="pop-h"><b>${s.no}번 ${esc(s.name)}</b><span>${md(draft.start)}</span><button type="button" class="icon" data-pop="close" aria-label="닫기">×</button></div><div class="pop-b">`;
  h+=`<div class="row"><span class="k">구분</span><div class="chips">${GK.map((x,i)=>`<button type="button" class="ch g t-${G[x].k}${draft.gubun===x?' on':''}" data-pop="gubun" data-v="${x}" title="숫자 ${i+1}">${x}</button>`).join('')}</div></div>`;
  h+=`<div class="row"><span class="k">종류</span><div class="chips">${KINDS.map(k=>`<button type="button" class="ch${draft.kind===k?' on':''}" data-pop="kind" data-v="${k}">${k}</button>`).join('')}</div></div>`;
  if(draft.kind==='결석'){
    h+=`<div class="row"><span class="k">기간</span><div><span class="step"><button type="button" data-pop="days" data-v="-1" aria-label="하루 줄이기">−</button><output>${draft.days}</output><button type="button" data-pop="days" data-v="1" aria-label="하루 늘리기">+</button></span><span class="unit">일 · 주말은 빼고 세요</span></div></div>`;
  }else{
    h+=`<div class="row t-${g.k}"><span class="k">교시</span><div><div class="chips" id="pop-per">${perChips()}</div><div class="hint${warn?' warn':''}" id="pop-thint">${periodHint()}</div></div></div>`;
  }
  h+=`<div class="row"><span class="k">사유</span><div><input class="txt serif" id="pop-reason" data-rs="pop" value="${esc(draft.reason)}" placeholder="비워 두면 신고서에 빈칸으로 나가요" autocomplete="off"><div class="chips sugg" id="pop-rchips"></div></div></div>`;
  if(draft.gubun!=='미인정')h+=`<div class="row" id="pop-docrow" data-trip="${isTrip(draft)}">${docRowHTML()}</div>`;
  h+=`</div><div class="result" id="pop-sum">→ ${summary()}</div>`;
  if(g.form)h+=`<div class="recv" id="pop-recv" data-trip="${isTrip(draft)}">${recvHTML()}</div>`;
  h+=`<div class="pop-f">${draft.id?'<button type="button" class="btn quiet" data-pop="del">지우기</button>':''}<button type="button" class="btn link" data-pop="card">한 달 보기</button><span class="spacer"></span>${g.form?'<button type="button" class="btn" data-pop="sheet">신고서 보기</button>':''}<button type="button" class="btn primary" data-pop="save">저장</button></div>`;
  h+='<div class="keys"><kbd>1</kbd>~<kbd>4</kbd> 구분 · <kbd>Enter</kbd> 저장 · <kbd>Esc</kbd> 닫기</div>';
  pop.innerHTML=h;
  refreshReasonChips();
  place();
}
function place(){
  const pop=$('#pop');if(!pop||innerWidth<=720)return;
  const w=pop.offsetWidth,h=pop.offsetHeight;
  if(popX==null){
    const a=(anchorEl&&document.body.contains(anchorEl)?anchorEl:$('#grid')).getBoundingClientRect();
    let x=a.right+10;if(x+w>innerWidth-12)x=a.left-w-10;if(x<12)x=Math.min(Math.max(12,a.left),innerWidth-w-12);
    popX=x;pop.dataset.ay=a.top-14;
  }
  const y=Math.min(Math.max(12,Number(pop.dataset.ay)),innerHeight-h-12);
  pop.style.left=popX+'px';pop.style.top=Math.max(12,y)+'px';
}
function onPop(e){
  e.stopPropagation();
  const b=e.target.closest('[data-pop]');if(!b||b.disabled)return;
  const a=b.dataset.pop,v=b.dataset.v;
  if(b.tagName==='INPUT')return;
  if(a==='close')return closePop();
  if(a==='gubun'){draft.gubun=v;if(v==='미인정'){draft.docs=[];draft.gotForm=false;draft.gotDocs=false}}
  if(a==='kind'){draft.kind=v;if(v!=='결석')draft.days=1;fillByP();warn=false}
  if(a==='period'){tapPeriod(Number(v));warn=false;refreshParts();const again=$(`#pop [data-pop="period"][data-v="${v}"]`);if(again)again.focus({preventScroll:true});return}
  if(a==='days')draft.days=Math.min(40,Math.max(1,draft.days+Number(v)));
  if(a==='reason'){draft.reason=draft.reason===v?'':v;const inp=$('#pop-reason');if(inp)inp.value=draft.reason;refreshReasonChips();refreshParts();return}
  if(a==='doc'){draft.docs=draft.docs.includes(v)?draft.docs.filter(x=>x!==v):[...draft.docs,v];if(!draft.docs.length)draft.gotDocs=false}
  if(a==='gotForm')draft.gotForm=!draft.gotForm;
  if(a==='gotDocs')draft.gotDocs=!draft.gotDocs;
  if(a==='gotReport')draft.gotReport=!draft.gotReport;
  if(a==='save')return save_();
  if(a==='del')return del_();
  if(a==='card'){const no=draft.no,mo=monthOf(draft.start);closePop();return openDrawer(no,mo)}
  if(a==='sheet'){const ok=save_(true);if(ok)showInDocs(ok);return}
  drawPop();
  const again=$(`#pop [data-pop="${a}"][data-v="${v}"]`)||$(`#pop [data-pop="${a}"]`);if(again)again.focus({preventScroll:true});
}
function save_(quiet){
  if(!draft)return null;
  const inp=$('#pop-reason');if(inp)draft.reason=inp.value.trim();
  if(draft.kind!=='결석'&&!draft.periods.length){warn=true;refreshParts();const p=$('#pop');p.classList.remove('shake');void p.offsetWidth;p.classList.add('shake');return null}
  const before=snap();
  const r=JSON.parse(JSON.stringify(draft));
  delete r.p;
  if(r.kind==='결석'){r.periods=[];r.time=''}else r.days=1;
  if(r.kind==='결과')r.time='';
  if(isTrip(r)){r.docs=[];r.gotDocs=false}else delete r.gotReport;
  if(!r.docs.length)r.gotDocs=false;
  if(!needsForm(r))r.gotForm=false;
  const span=spanOf(r);
  DB.records=DB.records.filter(x=>x.id===r.id||x.no!==r.no||!spanOf(x).some(s=>span.includes(s)));
  if(r.id){
    const old=rec(r.id);
    if(old){ // 날짜·교시를 바꾸면 서류함에서 직접 고친 ( )교시·( )일간은 다시 자동으로
      if(old.kind!==r.kind||old.start!==r.start||String(old.periods)!==String(r.periods))delete r.periodLabel;
      if(old.kind!==r.kind||old.start!==r.start||old.days!==r.days)delete r.dayCount;
    }
    DB.records=DB.records.map(x=>x.id===r.id?r:x);
  }else{r.id=DB.uid++;DB.records.push(r)}
  addReason(r.reason);
  save();
  const s=stu(r.no);
  closePop();render();
  if(!quiet)toast(`${s.no}번 ${s.name} · ${label(r)} 저장했어요`,before);
  return r.id;
}
function del_(){
  const before=snap(),s=stu(draft.no),lb=label(draft);
  DB.records=DB.records.filter(x=>x.id!==draft.id);
  save();closePop();render();toast(`${s.no}번 ${s.name} · ${lb} 지웠어요`,before);
}
function showInDocs(id){
  const r=rec(id);if(!r)return;
  closeDrawer();
  st.dmonth=monthOf(r.start);st.dfilter='all';st.focus=id;
  go('docs');
}

/* ───────── 서류함 ───────── */
function docRecords(){return DB.records.filter(r=>needsForm(r)&&inMonth(r,st.dmonth)).sort((a,b)=>b.start.localeCompare(a.start)||a.no-b.no)}
function docFiltered(){
  const all=docRecords();
  if(st.dfilter==='unprinted')return all.filter(r=>!r.printed);
  if(st.dfilter==='owe')return all.filter(r=>owes(r).length);
  return all;
}
const pagesOf=r=>{
  if(isTrip(r)){const q=tripPick(r);return (q.app?1:0)+(q.rep?1:0)}
  if(r.gubun!=='기타')return 1;const p=opPick(r);return (p.parent?1:0)+(p.teacher?1:0);
};
function renderDocs(){
  const[y,m]=st.dmonth.split('-');
  $('#dtitle').textContent=`${y}년 ${Number(m)}월`;
  $$('#dfilter button').forEach(b=>b.classList.toggle('on',b.dataset.f===st.dfilter));
  const list=docFiltered();
  if(!list.some(r=>r.id===st.focus))st.focus=list[0]?list[0].id:(rec(st.focus)&&inMonth(rec(st.focus),st.dmonth)?st.focus:null);
  renderDocList();renderEdit();renderPaper();
}
function renderDocList(){
  const list=docFiltered();
  for(const id of [...st.checked])if(!rec(id))st.checked.delete(id);
  const names={all:'',unprinted:'안 뽑은 ',owe:'덜 받은 '};
  $('#dl-n').textContent=`${names[st.dfilter]}${list.length}건`;
  const all=$('#dl-all');all.checked=list.length>0&&list.every(r=>st.checked.has(r.id));all.indeterminate=!all.checked&&list.some(r=>st.checked.has(r.id));
  if(!list.length){
    $('#dl').innerHTML=`<li class="dl-empty">${st.dfilter==='all'?'이달에는 뽑을 신고서가 없어요.<br>질병·출석인정·기타 출결을 넣으면 여기에 모여요.':st.dfilter==='owe'?'덜 받은 서류가 없어요.':'모두 뽑았어요.'}</li>`;
  }else{
    $('#dl').innerHTML=list.map(r=>{
      const s=stu(r.no)||{no:r.no,name:'(명단에 없음)'};
      const ow=owes(r);
      const st2=ow.length?ow.map(w=>`<span class="o">● ${w==='form'?formWord(r):w==='report'?'보고서':'서류'} 안 받음</span>`).join(''):'<span class="ok">✓ 다 받음</span>';
      return `<li class="di${r.id===st.focus?' on':''}" data-act="dfocus" data-id="${r.id}"><input type="checkbox" data-act="dcheck" data-id="${r.id}" ${st.checked.has(r.id)?'checked':''} aria-label="${esc(s.name)} 인쇄할 것으로 고르기"><div class="di-top"><b>${esc(s.name)}</b><span class="no">${s.no}번</span><span class="tag t-${kOf(r)}">${isTrip(r)?'교외체험학습':label(r)}</span></div><div class="di-sub"><span>${r.kind==='결석'&&r.days>1?`${mdS(r.start)}~${mdS(spanOf(r).slice(-1)[0])}`:mdS(r.start)}</span>${r.printed?`<span class="pr">인쇄함 ${mdS(r.printed)}</span>`:'<span>안 뽑음</span>'}${st2}</div></li>`;
    }).join('');
  }
  const n=[...st.checked].map(rec).filter(Boolean).reduce((a,r)=>a+pagesOf(r),0);
  const pc=$('#print-checked');pc.textContent=`체크한 ${n}장 인쇄`;pc.disabled=!n;
  $('#print-one').disabled=!rec(st.focus);
}
function writtenOf(r){return r.written===undefined?spanOf(r).slice(-1)[0]:r.written}
function daysOf(r){return r.dayCount===undefined||r.dayCount===null?String(r.days):String(r.dayCount)}
function docsOf(r){return r.docsText===undefined||r.docsText===null?r.docs.join(', '):r.docsText}
/* 기간 칸: 결석은 ( )일간, 지각은 ( )교시까지, 조퇴는 ( )교시부터, 결과는 ( )교시 */
const pnm=i=>i===0?'조회':i===8?'종례':String(i);
function periodAuto(r){
  const vp=validP(r.start),ps=vp.filter(i=>r.periods.includes(i));
  if(!ps.length)return '';
  if(r.kind==='지각'){const x=ps.filter(i=>i<8);return pnm(x.length?Math.max(...x):8)}
  if(r.kind==='조퇴')return pnm(Math.min(...ps));
  const runs=[];let cur=[ps[0]];
  for(let j=1;j<ps.length;j++){if(vp.indexOf(ps[j])===vp.indexOf(ps[j-1])+1)cur.push(ps[j]);else{runs.push(cur);cur=[ps[j]]}}
  runs.push(cur);
  return runs.map(u=>u.length===1?pnm(u[0]):`${pnm(u[0])}~${pnm(u[u.length-1])}`).join(', ');
}
function periodOf(r){return r.periodLabel===undefined||r.periodLabel===null?periodAuto(r):String(r.periodLabel)}
const pword=t=>t===''||/^[\d~,\s]+$/.test(t)?'교시':'';
const ptail=k=>({'지각':'까지','조퇴':'부터'}[k]||'');
const opPick=r=>({parent:r.opParent!==false,teacher:r.opTeacher!==false});
function renderEdit(){
  const r=rec(st.focus),box=$('#dv-edit'),who=$('#dv-who');
  if(!r){box.innerHTML='';who.innerHTML='';return}
  const s=stu(r.no)||{no:r.no,name:'(명단에 없음)'};
  who.innerHTML=`<b>${s.no}번 ${esc(s.name)}</b><span>${label(r)}${isTrip(r)?' (교외체험학습)':''} · ${whenText(r)}${r.kind!=='결석'?' · '+esc(periodText(r.periods,r.start)):''}</span>`;
  if(isTrip(r)){
    const q=tripPick(r);
    let h='';
    if(r.kind==='결석')h+=`<label class="fld"><span>총 ( )일간</span><input type="number" class="txt" id="e-days" min="0" max="99" value="${esc(daysOf(r))}"></label>`;
    h+=`<label class="fld"><span>사유</span><input class="txt serif" id="e-reason" data-rs="rec" data-id="${r.id}" value="${esc(r.reason)}" autocomplete="off"></label>`;
    h+=`<div class="fld wide"><span>뽑을 장 (신청서는 체험 전에, 결과보고서는 다녀온 뒤에)</span><div class="brow"><button type="button" class="tog${q.app?' on':''}" data-act="oppage" data-w="app"><i>✓</i>신청서 (통보서 포함)</button><button type="button" class="tog${q.rep?' on':''}" data-act="oppage" data-w="rep"><i>✓</i>결과보고서</button></div></div>`;
    h+=`<div class="fld-opts"><span class="hint">통보서의 '금회까지 누적 사용 기간'은 이번 학년도 체험학습 일수(${tripUsed(r)}일)로 채워져요.</span><span class="spacer"></span><button type="button" class="tog${r.gotForm?' on':''}" data-act="recv" data-id="${r.id}" data-what="form"><i>✓</i>신청서 받음</button><button type="button" class="tog${r.gotReport?' on':''}" data-act="recv" data-id="${r.id}" data-what="report"><i>✓</i>보고서 받음</button></div>`;
    box.innerHTML=h;return;
  }
  let h=`<label class="fld"><span>작성일 (맨 아래 날짜)</span><div class="inl"><input type="date" class="txt" id="e-written" value="${writtenOf(r)||''}"><button type="button" class="small" data-act="e-clear">비우기</button></div></label>`;
  if(r.kind==='결석')h+=`<label class="fld"><span>기간 ( )일간</span><input type="number" class="txt" id="e-days" min="0" max="99" value="${esc(daysOf(r))}"></label>`;
  else h+=`<label class="fld"><span>기간 ( )교시${ptail(r.kind)}</span><input class="txt" id="e-period" value="${esc(periodOf(r))}" placeholder="비워 두면 빈칸으로 나가요" autocomplete="off"></label>`;
  h+=`<label class="fld"><span>사유</span><input class="txt serif" id="e-reason" data-rs="rec" data-id="${r.id}" value="${esc(r.reason)}" placeholder="비워 두면 빈칸으로 나가요" autocomplete="off"></label>`;
  h+=`<label class="fld"><span>첨부 서류</span><input class="txt serif" id="e-docs" value="${esc(docsOf(r))}" placeholder="비워 두면 빈칸으로 나가요"></label>`;
  if(r.gubun==='기타'){
    const p=opPick(r);
    h+=`<div class="fld wide"><span>뽑을 장 (둘 중 하나만 뽑을 수도 있어요)</span><div class="brow"><button type="button" class="tog${p.parent?' on':''}" data-act="oppage" data-w="parent"><i>✓</i>학부모 의견서</button><button type="button" class="tog${p.teacher?' on':''}" data-act="oppage" data-w="teacher"><i>✓</i>담임교사 의견서</button></div></div>`;
    if(p.teacher)h+=`<label class="fld"><span>담임교사 의견</span><input class="txt serif" id="e-note" value="${esc(r.teacherNote||'')}" placeholder="비워 두면 손으로 쓸 수 있게 빈칸으로 나가요"></label>`;
  }
  h+=`<div class="fld-opts"><span class="spacer"></span><button type="button" class="tog${r.gotForm?' on':''}" data-act="recv" data-id="${r.id}" data-what="form"><i>✓</i>${formWord(r)} 받음</button>${r.docs.length?`<button type="button" class="tog${r.gotDocs?' on':''}" data-act="recv" data-id="${r.id}" data-what="docs"><i>✓</i>서류 받음</button>`:''}</div>`;
  box.innerHTML=h;
}
let paperTimer;
function renderPaper(){
  const wrap=$('#paper'),r=rec(st.focus);
  if(!r){wrap.innerHTML=`<div class="paper-empty">왼쪽에서 신고서를 고르면 여기에 우리 학교 양식으로 보여요.<br>빈 양식이 필요하면 위 [빈 양식]을 눌러요.</div>`;return}
  paperInto(wrap,formPages(r));
}
function paperInto(wrap,pages){
  const avail=Math.max(260,Math.min(wrap.clientWidth-48,820));
  const s=Math.min(1,avail/793.7);
  wrap.innerHTML=pages.map(p=>`<div class="pgbox" style="width:${(793.7*s).toFixed(1)}px;height:${(1122.5*s).toFixed(1)}px">${p.replace('<div class="pg','<div style="transform:scale('+s.toFixed(4)+')" class="pg')}</div>`).join('');
}
function editRec(fn){const r=rec(st.focus);if(!r)return;fn(r);save();clearTimeout(paperTimer);paperTimer=setTimeout(()=>{renderPaper();renderDocList()},120)}
$('#docs').addEventListener('input',e=>{
  const id=e.target.id;
  if(id==='e-written')editRec(r=>{r.written=e.target.value||''});
  if(id==='e-days')editRec(r=>{r.dayCount=e.target.value===''?'':e.target.value});
  if(id==='e-period')editRec(r=>{r.periodLabel=e.target.value.trim()});
  if(id==='e-docs')editRec(r=>{r.docsText=e.target.value});
  if(id==='e-note')editRec(r=>{r.teacherNote=e.target.value});
});
$('#docs').addEventListener('change',e=>{
  if(e.target.id==='dl-all'){
    const list=docFiltered();
    if(e.target.checked)list.forEach(r=>st.checked.add(r.id));else list.forEach(r=>st.checked.delete(r.id));
    renderDocList();
  }
});

/* ───────── 학교 양식 신고서 (hwpx 양식의 위치를 mm로 옮김) ───────── */
const V=(x,w,cls='',style='')=>`<span class="vv ${cls}" style="width:${w}mm;${style}">${esc(x)}</span>`;
const spaced=t=>[...t].join(' ');
function fitStyle(text,boxMM,pt){
  // 칸보다 글자가 길면 글자를 조금 줄여요
  const len=[...String(text||'')].reduce((n,c)=>n+(/[ㄱ-힝]/.test(c)?1:.55),0);
  const need=len*pt*0.3528*1.18;
  if(need<=boxMM)return '';
  const f=Math.max(8,Math.floor(pt*boxMM/need*10)/10);
  return `font-size:${f}pt;`;
}
/* 이름은 한 칸씩 띄워서: 김나래 → 김 나 래 */
const nameSp=n=>/^[가-힣]{2,5}$/.test(n||'')?spaced(n):(n||'');
function formVals(r,blankType){
  const s=SET(),thisYear=new Date().getFullYear();
  if(!r)return {type:blankType,grade:'',cls:'',no:'',name:'',kind:'',F:{y:thisYear,m:'',d:''},L:{y:thisYear,m:'',d:''},W:{y:thisYear,m:'',d:''},n:'',ptxt:'',reason:'',docs:'',school:s.school,teacher:'',note:'',range:''};
  const who=stu(r.no)||{no:r.no,name:''};
  const ds=spanOf(r),first=ds[0],last=ds[ds.length-1];
  const ymd=x=>x?{y:+x.slice(0,4),m:+x.slice(5,7),d:+x.slice(8,10)}:{y:'',m:'',d:''};
  const F=ymd(first),L=ymd(last),w=writtenOf(r),W=w?ymd(w):{y:F.y,m:'',d:''};
  const range=F.m===L.m?(F.d===L.d?String(F.d):`${F.d}~${L.d}`):`${F.d}~${L.m}/${L.d}`;
  return {type:r.gubun,grade:s.grade,cls:s.cls,no:who.no,name:nameSp(who.name),kind:r.kind,F,L,W,n:daysOf(r),ptxt:r.kind==='결석'?'':periodOf(r),reason:r.reason||'',docs:docsOf(r),school:s.school,teacher:nameSp(s.teacher),note:r.teacherNote||'',range};
}
/* 교외체험학습 신청서(통보서 포함)·결과보고서 — 학교 양식 hwpx 4쪽의 표 칸 너비(mm)를 그대로 옮김 */
const T16=[26.4,11.2,26.2,4.0,5.0,13.7,22.0,14.3,9.2,0.3,8.8,3.0,5.0,7.0,9.3,14.5];
const T6=[37.3,11.2,27.2,18.9,20.2,64.5];
const T7=[23.5,33.7,35.5,4.0,23.1,23.1,23.1];
const cg=ws=>`<colgroup>${ws.map(w=>`<col style="width:${w}mm">`).join('')}</colgroup>`;
const tv=(x,cls='')=>`<span class="tv ${cls}">${esc(x)}</span>`;
const SP='&nbsp;&nbsp;&nbsp;';
const tripPick=r=>({app:r.opApp!==false,rep:r.opRep!==false});
const schoolYearStart=d=>{const y=+d.slice(0,4),m=+d.slice(5,7);return `${m>=3?y:y-1}-03-01`};
/* 금회까지 누적 사용 기간: 이번 학년도(3월~) 하루 단위 체험학습 일수 */
function tripUsed(r){
  const ys=schoolYearStart(r.start);
  return DB.records.filter(x=>x.no===r.no&&isTrip(x)&&x.kind==='결석'&&x.start>=ys&&x.start<=r.start).reduce((n,x)=>n+(Number(daysOf(x))||0),0);
}
function tripVals(r){
  const v=formVals(r,'체험');
  return {...v,half:!!r&&r.kind!=='결석',full:!!r&&r.kind==='결석',used:r?String(tripUsed(r)):''};
}
function tripAppPage(t){
  const yr=t.F.y,sch=t.school||'○○학교';
  const range=t.full?`${yr}년 ${tv(t.F.m)}월 ${tv(t.F.d)}일 &nbsp;~&nbsp; ${tv(t.L.m)}월 ${tv(t.L.d)}일`:`${yr}년 ${SP}월 ${SP}일 &nbsp;~&nbsp; ${SP}월 ${SP}일`;
  const tot=t.full?tv(t.n):SP;
  const halfDate=t.half?`${yr} 년 ${tv(t.F.m)} 월 ${tv(t.F.d)} 일`:`${yr} 년 ${SP}월 ${SP}일`;
  const people=w=>`<tr style="height:5.4mm"><td class="k">${w}</td><td colspan="4"></td><td class="k">관계</td><td></td><td colspan="2" class="k">휴대폰</td><td colspan="7"></td></tr>`;
  return `<div class="pg trip"><div class="tp" style="top:24mm;left:15mm;width:180mm">
<table class="tt">${cg(T16)}
<tr style="height:5.6mm"><td colspan="7" rowspan="2" class="ttl">「학교장허가 교외체험학습」신청서</td><td colspan="3" class="k"></td><td colspan="4" class="k">담임</td><td colspan="2" class="k">학년부장</td></tr>
<tr style="height:4.4mm"><td colspan="3" rowspan="2"></td><td colspan="4" rowspan="2"></td><td colspan="2" rowspan="2"></td></tr>
<tr style="height:8.5mm"><td colspan="7" class="nt">※신청서 제출 기한 ( 3 )일 이전, 보고서 제출 기한 ( 5 )일 이내</td></tr>
<tr style="height:5.6mm"><td class="k">성 명</td><td colspan="3">${tv(t.name)}</td><td colspan="4" class="k">${tv(t.grade,'n')}학년 ${tv(t.cls,'n')}반 ${tv(t.no,'n')}번</td><td colspan="3" class="k">휴대폰</td><td colspan="5"></td></tr>
<tr style="height:6.2mm"><td rowspan="4" class="k">본교 출석인정기간<br>연간(20)일</td><td rowspan="3" class="k">신청<br>기간</td><td class="k">1일 기준</td><td colspan="9">${range}</td><td colspan="4" rowspan="3">총 (${tot})일간</td></tr>
<tr style="height:4.8mm"><td rowspan="2" class="k">반일 기준<br><small>(4시간 미만)</small></td><td colspan="3">날짜</td><td colspan="6">${halfDate}</td></tr>
<tr style="height:4.8mm"><td colspan="3">시간</td><td colspan="6">시 ${SP}분 ~ ${SP}시 ${SP}분</td></tr>
<tr style="height:8.7mm"><td colspan="12" class="sm">우리 학교 학교장허가 교외체험학습 세부 규칙 및 불허기간 확인<br><b>※ 필요시 담임교사와의 사전 협의 또는 문의</b></td><td colspan="3">( ○ , × )</td></tr>
<tr style="height:5.8mm"><td class="k">학습형태</td><td colspan="15" class="l">∘가족동반여행( &nbsp; ) ∘친·인척 방문( &nbsp; ) ∘답사∙견학 활동( &nbsp; ) ∘체험활동( &nbsp; )</td></tr>
<tr style="height:5.4mm"><td class="k">목적지</td><td colspan="6"></td><td colspan="2" class="k"><small>(숙박시)</small> 숙박장소</td><td colspan="7"></td></tr>
${people('보호자명')}${people('인솔자명')}
<tr style="height:6mm"><td class="k">목 적</td><td colspan="15"></td></tr>
<tr style="height:37.2mm"><td class="k">교외체험<br>학습계획</td><td colspan="15"></td></tr>
<tr style="height:9.6mm"><td class="k">학생안전</td><td colspan="14" class="l sm">교외체험학습이 5일 이상 연속될 경우 학생의 건강과 안전을 위하여<br>주 1회 이상 학생이 담임(담당)교사와 직접 통화하겠습니다.</td><td class="sm">□<br>동의함</td></tr>
<tr><td colspan="16" class="sig"><p class="c">위와 같이 「학교장허가 교외체험학습」을 신청합니다.</p><p class="c">${yr} 년 ${SP}월 ${SP}일</p><p class="r">보호자 : <span class="sgv"></span>(인)</p><p class="r">학생 : <span class="sgv">${tv(t.name)}</span>(인)</p><p class="to">${esc(sch)}장 &nbsp;귀하</p></td></tr>
</table>
<div class="cut">-----------------------------------------<small>(이하 담임 작성)</small>-----------------------------------</div>
<div class="tt2">학교장허가 교외체험학습 통보서</div>
<table class="tt">${cg(T6)}
<tr style="height:6.9mm"><td class="k">성 명</td><td colspan="3">${tv(t.name)}</td><td class="k">학년 반</td><td>제 ${tv(t.grade,'n')} 학년 ${tv(t.cls,'n')} 반 ${tv(t.no,'n')} 번</td></tr>
<tr style="height:6.9mm"><td rowspan="2" class="k">본교<br>출석 인정 기간<br>연간 (20)일</td><td rowspan="2" class="k">신청<br>기간</td><td class="k">1일 기준</td><td colspan="3">${range}( ${tot} ) 일간</td></tr>
<tr style="height:10.9mm"><td class="k">반일 기준<br><small>(4시간 미만)</small></td><td colspan="3">${t.half?`${yr} 년 ${tv(t.F.m)} 월 ${tv(t.F.d)} 일`:`20 ${SP}년 ${SP}월 ${SP}일`}<br>시 ${SP}분 ~ ${SP}시 ${SP}분( ${SP}시간)</td></tr>
<tr style="height:22.1mm"><td class="k">금회까지<br>누적 사용 기간<br>( ${t.used!==''?tv(t.used):SP} )일</td><td colspan="5" class="sig2"><p>위와 같이 허가 처리되었음을 알려 드립니다.</p><p>${yr} . ${SP}. ${SP}.</p><p class="r">${esc(sch)} ( ${tv(t.grade)} )학년 ( ${tv(t.cls)} )반 담임교사 : <span class="sgv">${tv(t.teacher)}</span>(인)</p><p class="l">보호자님 귀하</p></td></tr>
</table>
<div class="notes"><p>※ 보호자가 신청서를 제출하였다 하여 체험학습이 허가된 것이 아니며 담임교사로부터 반드시 최종 허가 <b>여부 통보서(또는 문자)를 받은 후 실시</b>해야 합니다.</p><p>※ 신청서 제출 기한은 ( 3 )일 이전, 보고서 제출 기한은 ( 5 )일 이내</p><p>※ 교외체험학습 실시 중에는 보호자와 담임(담당)교사 간 연락체계를 유지하고 사안(사고) 발생 시 보호자는 담임(담당)교사에게 연락을 하도록 합니다.</p><p>※ 교외체험학습이 5일 이상 연속될 경우 주1회 이상 학생이 담임(담당)교사와 직접 통화하여 건강과 안전을 확인시켜야 합니다. 미이행의 경우 시‧군‧구 아동복지과 또는 수사기관에 통보될 수 있음을 알려드립니다.</p></div>
</div></div>`;
}
function tripRepPage(t){
  const yr=t.F.y,sch=t.school||'○○학교';
  const range=t.full?`${yr}년 ${tv(t.F.m)}월 ${tv(t.F.d)}일 &nbsp;~&nbsp; ${tv(t.L.m)}월 ${tv(t.L.d)}일 ( ${tv(t.n)} ) 일간`:`${yr}년 ${SP}월 ${SP}일 &nbsp;~&nbsp; ${SP}월 ${SP}일 ( ${SP}) 일간`;
  const half=`${yr}년 ${t.half?`${tv(t.F.m)}월 ${tv(t.F.d)}일`:`${SP}월 ${SP}일`} &nbsp; 00:00 &nbsp;~&nbsp; 00:00`;
  const lines=Array.from({length:16},()=>'<tr style="height:5.5mm"><td colspan="7"></td></tr>').join('');
  return `<div class="pg trip"><div class="tp" style="top:24mm;left:22mm;width:166mm">
<div class="form2">&lt;서식 2&gt;</div>
<table class="tt">${cg(T7)}
<tr style="height:5.6mm"><td colspan="4" rowspan="2" class="ttl">「학교장허가 교외체험학습」결과보고서</td><td class="k">담임</td><td class="k">부장</td><td class="k">교감</td></tr>
<tr style="height:4.1mm"><td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td></tr>
<tr style="height:4.9mm"><td colspan="4"></td></tr>
<tr style="height:6.5mm"><td class="k">성 명</td><td>${tv(t.name)}</td><td class="k">학년 반</td><td colspan="4">${tv(t.grade,'n')}학년 ${SP}${tv(t.cls,'n')}반 ${SP}${tv(t.no,'n')}번</td></tr>
<tr style="height:5.9mm"><td rowspan="2" class="k">기간</td><td class="k">1일 기준</td><td colspan="5">${range}</td></tr>
<tr style="height:9.1mm"><td class="k">반일 기준<br><small>(4시간 미만)</small></td><td colspan="5">${half}</td></tr>
<tr style="height:5.9mm"><td rowspan="2" class="k">목적지<br>및 동반자</td><td class="k">목적지</td><td colspan="5"></td></tr>
<tr style="height:5.2mm"><td class="k">보호자(동반자)</td><td colspan="5"></td></tr>
<tr style="height:9.8mm"><td class="k">학습형태</td><td colspan="6" class="l">∘가족동반여행( &nbsp; ) ∘친·인척 방문( &nbsp; ) ∘답사∙견학 활동( &nbsp; ) ∘체험활동( &nbsp; )</td></tr>
<tr style="height:6.9mm"><td class="k">제 &nbsp;목</td><td colspan="6"></td></tr>
<tr style="height:7.5mm"><td colspan="7" class="l sm">* 교외체험학습을 통해 느낀 점, 배운 점 등을 글, 그림 등으로 학생이 체험 또는 학습한 내용을 기록합니다.<br>(사진, 티켓 등은 별지에 부착)</td></tr>
${lines}
<tr style="height:9.5mm"><td colspan="7"></td></tr>
<tr><td colspan="7" class="sig"><p class="c big">위와 같이「학교장허가 교외체험학습」결과보고서를 제출합니다.</p><p class="c big">${yr} . ${SP}. ${SP}.</p><p class="r">보호자 : <span class="sgv"></span>(인)</p><p class="r">학생 : <span class="sgv">${tv(t.name)}</span>(인)</p><p class="c to">${esc(sch)}장 &nbsp;귀하</p></td></tr>
</table>
<div class="note2">※ 보고서 제출 기한: 체험학습 종료 후 ( &nbsp;5&nbsp; )일 이내</div>
</div></div>`;
}
function formPages(r,blankType){
  if(blankType==='체험신청')return [tripAppPage(tripVals(null))];
  if(blankType==='체험보고')return [tripRepPage(tripVals(null))];
  if(r&&isTrip(r)){
    const q=tripPick(r),t=tripVals(r),out=[];
    if(q.app)out.push(tripAppPage(t));
    if(q.rep)out.push(tripRepPage(t));
    return out;
  }
  const v=formVals(r,blankType);
  if(blankType==='학부모')return [opinionPage(v,true)];
  if(blankType==='담임')return [opinionPage(v,false)];
  if(v.type==='기타'){
    const p=r?opPick(r):{parent:true,teacher:true},out=[];
    if(p.parent)out.push(opinionPage(v,true));
    if(p.teacher)out.push(opinionPage(v,false));
    return out;
  }
  return [reportPage(v)];
}
/* 기간 줄: 결석(또는 빈 양식)은 ~부터 / ~까지 ( )일간, 지각·조퇴·결과는 한 줄 */
function periodLine(v){
  if(!v.kind||v.kind==='결석')return `<div class="a sp" style="top:98.6mm;left:54mm">${v.F.y}년${V(v.F.m,11)}월${V(v.F.d,8)}일부터</div>
<div class="a sp" style="top:106.3mm;left:54mm">${v.L.y||v.F.y}년${V(v.L.m,11)}월${V(v.L.d,8)}일까지 (${V(v.n,9)})일간</div>`;
  return `<div class="a sp" style="top:98.6mm;left:54mm">${v.F.y}년${V(v.F.m,11)}월${V(v.F.d,8)}일&nbsp;&nbsp;(${V(v.ptxt,[...v.ptxt].length>3?24:12)})${pword(v.ptxt)}${ptail(v.kind)}</div>`;
}
function reportPage(v){
  const ttl=`${v.type}<small>【${KINDS.map(k=>k===v.kind?`<span class="ck">${k}</span>`:k).join(', ')}】</small>신고서`;
  const school=spaced((v.school||'○○학교')+'장');
  return `<div class="pg rp">
<table class="sg"><tr><td class="k" rowspan="2">결<br>재</td><td class="h">담 임</td><td class="h n">학년부장</td></tr><tr><td class="b"></td><td class="b"></td></tr></table>
<div class="a c ttl">${ttl}</div>
<div class="a f11 sp" style="top:62.5mm;left:134.7mm">제${V(v.grade,8)}학년${V(v.cls,9)}반${V(v.no,9)}번</div>
<div class="a f11 sp" style="top:69.4mm;left:134.7mm">성&nbsp;&nbsp;명 :${V(v.name,30,'vl',fitStyle(v.name,28,11)+'padding-left:2.5mm')}</div>
<div class="a sp" style="top:83.4mm;left:24.6mm">위 본인은 다음과 같이(${V(v.kind,15)})하였기에 보호자 연서로 신고합니다.</div>
<div class="a sp" style="top:98.6mm;left:19.8mm">1. 기 간 :</div>
${periodLine(v)}
<div class="a sp" style="top:129.1mm;left:19.8mm">2. 사 유 :${V(v.reason,140,'vl',fitStyle(v.reason,136,12)+'padding-left:3mm')}</div>
<div class="a sp" style="top:152mm;left:19.8mm">3. 첨부 서류 :${V(v.docs,128,'vl',fitStyle(v.docs,124,12)+'padding-left:3mm')}</div>
<div class="a sp" style="top:182.5mm;right:20mm">본&nbsp;&nbsp;인 :${V(v.name,36,'',fitStyle(v.name,34,12))}<span class="seal">인</span></div>
<div class="a sp" style="top:190.1mm;right:20mm">보호자 :${V('',36)}<span class="seal">인</span></div>
<div class="a c f11 sp" style="top:212.3mm">${v.W.y||v.F.y}년${V(v.W.m,11)}월${V(v.W.d,11)}일</div>
<div class="a c to" style="top:226.3mm">${esc(school)} 귀하</div>
<div class="a f9 note" style="top:255.1mm;left:19.8mm">주) <b>확인일자</b>는 신고서의 기간 5일 이내에 한함.</div>
</div>`;
}
function opinionPage(v,parent){
  const school=spaced((v.school||'○○학교')+'장');
  const wide=String(v.range).length>2;
  return `<div class="pg op">
<div class="a c ot" style="top:35mm">${parent?'학부모 의견서':'담임교사 의견서'}</div>
<div class="a f14" style="top:54.8mm;left:116mm">제${V(v.grade,8)}학년${V(v.cls,8)}반${V(v.no,9)}번</div>
<div class="a f14" style="top:63.2mm;left:116mm">성&nbsp;&nbsp;명 :${V(v.name,34,'vl','padding-left:2.5mm')}</div>
<div class="a f15 lead" style="top:79.5mm">위 학생은 다음과 같이 (${V(v.kind,16)}) 하였기에 ${parent?'학부모':'담임'} 의견서를 제출합니다.</div>
<table><tr class="r1"><th>기간</th><td>${!v.kind||v.kind==='결석'
  ?`${v.F.y}년${V(v.F.m,11)}월${V(v.range,wide?24:11)}일 (${V(v.n,9)}일간)`
  :`${v.F.y}년${V(v.F.m,11)}월${V(v.F.d,10)}일 (${V(v.ptxt,[...v.ptxt].length>3?22:11)})${pword(v.ptxt)}${ptail(v.kind)}`}</td></tr>
<tr class="r2"><th>${parent?'학부모<br>의견':'담임<br>교사<br>의견'}</th><td class="memo">${parent?'':esc(v.note)}</td></tr></table>
<div class="a c f15" style="top:201.8mm">${v.W.y||v.F.y}년${V(v.W.m,13)}월${V(v.W.d,13)}일</div>
<div class="a f15" style="top:227.2mm;right:30mm">${parent?'학부모 성명 :':'담임교사 :'}${V(parent?'':v.teacher,38)}(인)</div>
<div class="a c ot2" style="top:252.6mm">${esc(school)} 귀 하</div>
</div>`;
}

/* 인쇄 */
function doPrint(recs,blankType){
  const pages=blankType?formPages(null,blankType):recs.flatMap(r=>formPages(r));
  if(!pages.length)return;
  if(PREVIEW){toast('미리 보기 화면에서는 인쇄 창이 열리지 않아요. 실제 앱 주소에서 인쇄돼요.');return}
  const root=$('#print-root');
  root.innerHTML=pages.join('');
  const text=root.textContent;
  const loads=document.fonts&&document.fonts.load?Promise.all([
    document.fonts.load('400 16px "Nanum Myeongjo"',text),document.fonts.load('700 16px "Nanum Myeongjo"',text),
    document.fonts.load('800 16px "Nanum Myeongjo"',text),document.fonts.load('800 16px "Pretendard"',text),document.fonts.load('700 16px "Pretendard"',text)
  ]).catch(()=>{}):Promise.resolve();
  Promise.race([loads,new Promise(r=>setTimeout(r,2500))]).then(()=>{
    addEventListener('afterprint',()=>{root.innerHTML=''},{once:true});
    window.print();
    if(recs&&recs.length){
      const before=snap();recs.forEach(r=>{const x=rec(r.id);if(x)x.printed=TODAY});save();render();
      toast(`${pages.length}장을 인쇄 창으로 보냈어요 · 인쇄함으로 표시했어요`,before);
    }
  });
}

/* ───────── 설정 ───────── */
function openSettings(){
  closePop();closeDrawer();closeDrop();
  const s=SET(),days=['월','화','수','목','금'];
  let h=`<div class="modal-bg" id="modal"><div class="modal" role="dialog" aria-label="설정"><div class="modal-h"><h3>설정</h3><button type="button" class="icon" data-m="close" aria-label="닫기">×</button></div><div class="modal-b">`;
  h+=`<section><h4>오프라인<small>따로 켤 것 없이 저절로 돼요</small></h4><div id="s-offline">${offlineHTML()}</div></section>`;
  h+=`<section><h4>학교와 반<small>신고서에 들어가요</small></h4><div class="sgrid">
    <label>학교 이름<input class="txt" id="s-school" value="${esc(s.school)}" placeholder="예) 기산중학교"></label>
    <label>학년<input class="txt" id="s-grade" value="${esc(s.grade)}" inputmode="numeric"></label>
    <label>반<input class="txt" id="s-cls" value="${esc(s.cls)}" inputmode="numeric"></label>
    <label>담임 이름<input class="txt" id="s-teacher" value="${esc(s.teacher)}"></label></div></section>`;
  h+=`<section><h4>교시 시작 시각<small>출결판 머리글과 입력 창의 교시 칸 아래에 보여요</small></h4><div class="sgrid">${PER.slice(0,8).map((p,i)=>`<label>${p}<input type="time" class="txt" data-time="${i}" value="${esc(s.times[i])}"></label>`).join('')}</div></section>`;
  h+=`<section><h4>요일별 시간표<small>과목은 비워도 돼요. '마지막'은 그날 마지막 교시예요</small></h4><div style="overflow-x:auto"><table class="ttbl"><thead><tr><th></th>${[1,2,3,4,5,6,7].map(i=>`<th>${i}교시</th>`).join('')}<th>마지막</th></tr></thead><tbody>${[1,2,3,4,5].map(w=>`<tr><th>${days[w-1]}</th>${[0,1,2,3,4,5,6].map(j=>`<td><input class="txt" data-subj="${w}-${j}" value="${esc((s.subj[w]||[])[j]||'')}" aria-label="${days[w-1]}요일 ${j+1}교시 과목"></td>`).join('')}<td><select data-last="${w}" aria-label="${days[w-1]}요일 마지막 교시">${[4,5,6,7].map(n=>`<option value="${n}" ${Number(s.last[w])===n?'selected':''}>${n}교시</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></section>`;
  const gone=DB.students.filter(x=>x.left&&x.left<=START_DAY).length;
  h+=`<section><h4>학생 명단<small>번호 고치기 · 전학 간 학생(전출) · 전학 온 학생(전입) · 엑셀로 바꾸기</small></h4><div class="brow"><button type="button" class="btn" data-m="roster">명단 고치기</button><span class="hint">재학 ${nowCount()}명${gone?` · 전출 ${gone}명`:''}</span></div></section>`;
  h+=`<section><h4>백업<small>기록은 이 컴퓨터에만 있어요. 가끔 받아 두세요</small></h4><div class="brow"><button type="button" class="btn" data-m="export">백업 파일 받기</button><button type="button" class="btn" data-m="import">백업 불러오기</button><input type="file" id="s-import" accept=".json,application/json" hidden><span class="hint" id="s-msg"></span></div></section>`;
  h+=`<section><h4>모두 지우기</h4><div class="brow"><button type="button" class="btn danger" data-m="wipe">명단과 기록 모두 지우기</button><span class="hint">되돌릴 수 없어요. 먼저 백업을 받아 두세요.</span></div></section>`;
  h+=`</div><div class="modal-f"><button type="button" class="btn" data-m="close">닫기</button><button type="button" class="btn primary" data-m="save">저장</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',h);
  const m=$('#modal');
  m.addEventListener('click',onModal);
  $('#s-import').addEventListener('change',importFile);
  $('#s-school').focus();
}
function closeSettings(){$('#modal')?.remove()}
function onModal(e){
  if(e.target.id==='modal')return closeSettings();
  const b=e.target.closest('[data-m]');if(!b)return;
  const a=b.dataset.m;
  if(a==='close')return closeSettings();
  const applySettings=()=>{
    const s=SET();
    s.school=$('#s-school').value.trim();s.grade=$('#s-grade').value.trim();s.cls=$('#s-cls').value.trim();s.teacher=$('#s-teacher').value.trim();
    $$('#modal [data-time]').forEach(i=>{if(i.value)s.times[Number(i.dataset.time)]=i.value});
    $$('#modal [data-subj]').forEach(i=>{const[w,j]=i.dataset.subj.split('-').map(Number);s.subj[w]=s.subj[w]||['','','','','','',''];s.subj[w][j]=i.value.trim()});
    $$('#modal [data-last]').forEach(i=>{s.last[Number(i.dataset.last)]=Number(i.value)});
    save();
  };
  if(a==='save'){applySettings();closeSettings();render();toast(SAMPLE?'예시 반 설정을 바꿨어요 (저장은 안 돼요)':'설정을 저장했어요');return}
  if(a==='export'){
    if(PREVIEW){$('#s-msg').textContent='미리 보기 화면에서는 파일을 내려받을 수 없어요. 실제 앱 주소에서 받아 주세요.';return}
    const blob=new Blob([JSON.stringify(DB,null,1)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`출결노트-백업-${TODAY.replace(/-/g,'')}.json`;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    $('#s-msg').textContent='백업 파일을 내려받았어요.';return;
  }
  if(a==='import')return $('#s-import').click();
  if(a==='roster'){applySettings();closeSettings();render();return openRoster()} // 고친 설정은 먼저 저장하고 명단 창으로
  if(a==='wipe'){
    if(!b.classList.contains('sure')){b.classList.add('sure');b.textContent='정말 지울까요? 한 번 더 누르세요';return}
    try{localStorage.removeItem(STORE)}catch(err){}
    DB=blankDB();SAMPLE=false;closeSettings();closeDrawer();st.screen='hero';render();toast('명단과 기록을 모두 지웠어요');
  }
}
function importFile(e){
  const f=e.target.files&&e.target.files[0];if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const d=migrate(JSON.parse(rd.result));
      if(!d.students.length)throw new Error('empty');
      DB=d;SAMPLE=false;save();closeSettings();enterBoard();toast(`백업을 불러왔어요 · ${d.students.length}명, 기록 ${d.records.length}건`);
    }catch(err){$('#s-msg').textContent='이 파일은 출결노트 백업이 아니에요. 다른 파일을 골라 주세요.'}
  };
  rd.readAsText(f);
}

/* ───────── 학생 명단 (번호 고치기·전출·전입) ─────────
   - 번호를 바꾸면 그 학생의 출결 기록도 새 번호로 옮겨요.
   - 전출: 전출일부터 출결판에서 빠지고, 지난 기록·서류는 그대로 남아요(번호는 비워 둬요).
   - 전입: 마지막 번호 다음 번호로, 전입일부터 출결판에 나와요.
   - 지우기: 잘못 넣은 학생만. 그 학생의 기록도 같이 지워져요. */
let RW=null,rwRemoved=new Set();
function openRoster(){
  closePop();closeDrawer();closeDrop();closeSettings();
  RW=DB.students.map(s=>({...s,orig:s.no}));rwRemoved=new Set();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-bg" id="rmodal"><div class="modal" role="dialog" aria-label="학생 명단"><div class="modal-h"><h3>학생 명단</h3><button type="button" class="icon" data-r="close" aria-label="닫기">×</button></div><div class="modal-b" id="r-body"></div><div class="modal-f"><span class="r-err" id="r-err"></span><span class="spacer"></span><button type="button" class="btn" data-r="close">취소</button><button type="button" class="btn primary" data-r="save">저장</button></div></div></div>`);
  const m=$('#rmodal');
  m.addEventListener('click',onRoster);
  m.addEventListener('input',onRosterInput);
  dropZone($('#rmodal .modal'),'rmodal');
  drawRoster();
}
function closeRoster(){$('#rmodal')?.remove();RW=null}
function drawRoster(focusLast){
  const act=RW.filter(r=>!r.left).length,gone=RW.length-act;
  const recCount=no=>DB.records.filter(x=>x.no===no).length;
  let h=`<div class="xl-row"><button type="button" class="btn" data-r="add">+ 전학 온 학생 추가</button><button type="button" class="btn" data-r="xlsx">엑셀 파일로 바꾸기</button><span class="hint" id="r-msg">재학 ${act}명${gone?` · 전출 ${gone}명`:''} · 엑셀 파일을 여기로 끌어다 놓아도 돼요</span></div>`;
  h+='<div class="rt-wrap tall"><table class="rt"><thead><tr><th>번호</th><th>이름</th><th>상태</th><th></th></tr></thead><tbody>';
  RW.forEach((r,i)=>{
    let stc;
    if(r.left)stc=`<span class="tag gone">전출</span><input type="date" class="txt date" data-f="left" value="${esc(r.left)}" aria-label="${esc(r.name)} 전출일" title="이날부터 출결판에서 빠져요">`;
    else if(r.joined)stc=`<span class="tag in">전입</span><input type="date" class="txt date" data-f="joined" value="${esc(r.joined)}" aria-label="${esc(r.name)} 전입일" title="이날부터 출결판에 나와요">`;
    else stc='<span class="na">재학</span>';
    const n=r.orig!=null?recCount(r.orig):0;
    const acts=(r.left?'<button type="button" class="btn sm" data-r="back">다시 재학</button>':'<button type="button" class="btn sm" data-r="leave">전출 처리</button>')
      +`<button type="button" class="btn sm quiet" data-r="del" data-n="${n}">지우기</button>`;
    h+=`<tr data-i="${i}" class="${r.left?'gone':''}"><td><input type="number" class="txt num" min="1" max="99" data-f="no" value="${Number.isFinite(r.no)?r.no:''}" aria-label="번호"></td><td><input class="txt" data-f="name" value="${esc(r.name)}" aria-label="이름" placeholder="이름"></td><td class="stc">${stc}</td><td class="acts">${acts}</td></tr>`;
  });
  h+='</tbody></table></div>';
  h+='<p class="hint r-help">· 번호를 바꾸면 그 학생의 출결 기록도 새 번호로 같이 옮겨져요.<br>· <b>전출 처리</b>: 전출일부터 출결판에서 빠져요. 지난 출결 기록과 서류는 그대로 남고, 번호는 비워 둬요.<br>· <b>전학 온 학생 추가</b>: 마지막 번호 다음 번호로 들어가고, 전입일부터 출결판에 나와요.<br>· <b>지우기</b>는 잘못 넣은 학생을 없앨 때만 써요. 그 학생의 기록도 같이 지워져요.</p>';
  $('#r-body').innerHTML=h;
  if(focusLast){const ins=$$('#r-body input[data-f="name"]');const last=ins[ins.length-1];if(last){last.focus();last.scrollIntoView({block:'nearest'})}}
}
function onRosterInput(e){
  const t=e.target,tr=t.closest('tr[data-i]');if(!tr||!RW)return;
  const r=RW[Number(tr.dataset.i)];if(!r)return;
  const f=t.dataset.f;
  if(f==='no')r.no=t.value===''?NaN:Number(t.value);
  else if(f==='name')r.name=t.value;
  else if(f==='left')r.left=t.value;
  else if(f==='joined')r.joined=t.value;
  $('#r-err').textContent='';
}
function rosterFromExcel(list){
  // 엑셀로 바꾸기: 번호가 같은 학생은 기록과 전입·전출이 그대로 이어져요
  RW=list.map(s=>{const old=DB.students.find(o=>o.no===s.no);const r={no:s.no,name:s.name,orig:old?old.no:null};if(old&&old.left)r.left=old.left;if(old&&old.joined)r.joined=old.joined;return r});
  rwRemoved=new Set();drawRoster();
}
function onRoster(e){
  e.stopPropagation();
  const b=e.target.closest('[data-r]');if(!b||!RW)return;
  const a=b.dataset.r,tr=b.closest('tr[data-i]'),i=tr?Number(tr.dataset.i):-1;
  if(a==='close')return closeRoster();
  if(a==='save')return saveRoster();
  if(a==='add'){const max=RW.reduce((m,r)=>Math.max(m,Number.isFinite(r.no)?r.no:0),0);RW.push({no:max+1,name:'',joined:START_DAY,orig:null});return drawRoster(true)}
  if(a==='xlsx'){pickTarget='rmodal';return $('#xlsx-in').click()}
  if(a==='leave'){RW[i].left=START_DAY;return drawRoster()}
  if(a==='back'){delete RW[i].left;return drawRoster()}
  if(a==='del'){
    const n=Number(b.dataset.n);
    if(n&&!b.classList.contains('sure')){b.classList.add('sure');b.textContent=`정말요? 기록 ${n}건도 지워져요`;return}
    if(RW[i].orig!=null)rwRemoved.add(RW[i].orig);
    RW.splice(i,1);return drawRoster();
  }
}
function saveRoster(){
  const list=RW.map(r=>({...r,name:String(r.name||'').trim()}));
  let err=rosterError(list);
  if(!err&&!list.length)err='학생이 한 명은 있어야 해요.';
  if(!err){const bad=list.find(r=>r.left&&r.joined&&r.left<=r.joined);if(bad)err=`${bad.name}의 전출일이 전입일보다 빨라요.`}
  if(err){$('#r-err').textContent=err;return}
  const before=snap();
  const map=new Map();list.forEach(r=>{if(r.orig!=null)map.set(r.orig,r.no)});
  DB.records=DB.records.filter(x=>!rwRemoved.has(x.no)).map(x=>map.has(x.no)?{...x,no:map.get(x.no)}:x);
  DB.students=list.map(r=>{const o={no:r.no,name:r.name};if(r.left)o.left=r.left;if(r.joined)o.joined=r.joined;return o}).sort((a,b)=>a.no-b.no);
  save();closeRoster();render();
  toast('학생 명단을 저장했어요',before);
}

/* ───────── 클릭 ───────── */
document.addEventListener('click',e=>{
  if(e.target.closest('#pop')||e.target.closest('#modal')||e.target.closest('#rmodal')||e.target.closest('#rsdrop'))return;
  if(draft&&!e.target.closest('#drawer [data-dr]'))closePop();
  if(!e.target.closest('.menu-wrap'))$('#blankmenu').hidden=true;
  const b=e.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act;
  if(a==='open')return openPop(Number(b.dataset.no),b.dataset.date,b.dataset.p,b);
  if(a==='card')return openDrawer(Number(b.dataset.no));
  if(a==='recv'){
    const before=snap(),r=rec(Number(b.dataset.id));if(!r)return;
    const k={form:'gotForm',report:'gotReport'}[b.dataset.what]||'gotDocs';r[k]=!r[k];save();render();
    const what=b.dataset.what==='form'?formWord(r):b.dataset.what==='report'?'보고서':'서류';
    toast(`${stu(r.no)?.name||''} ${what} ${r[k]?'받음으로 표시했어요':'안 받음으로 돌렸어요'}`,before);return;
  }
  if(a==='goday'){st.date=b.dataset.date;st.view='day';return renderBoard()}
  if(a==='prev'||a==='next'){
    const dir=a==='prev'?-1:1;
    if(st.view==='day')st.date=stepSchool(st.date,dir);else st.month=shiftMonth(st.month,dir);
    return renderBoard();
  }
  if(a==='today'){st.date=START_DAY;st.month=monthOf(START_DAY);return renderBoard()}
  if(a==='tab'){closeDrawer();return go(b.dataset.tab)}
  if(a==='go-owe'){closeDrawer();st.dfilter='owe';st.dmonth=st.view==='month'?st.month:monthOf(st.date);return go('docs')}
  if(a==='guide')return startTour();
  if(a==='settings')return openSettings();
  if(a==='home'){closeDrawer();if(SAMPLE||!DB.students.length){st.screen='hero';render();scrollTo(0,0)}else go('board');return}
  if(a==='sample'){DB=sampleDB();SAMPLE=true;return enterBoard()}
  if(a==='open-mine'){const mine=loadSaved();if(mine){DB=mine;SAMPLE=false;enterBoard()}return}
  if(a==='start-mine'){
    closeDrawer();SAMPLE=false;const mine=loadSaved();
    if(mine&&mine.students.length){DB=mine;enterBoard()}else{DB=mine||blankDB();st.screen='hero';render();$('#paste').hidden=false;$('#paste-ta').focus();scrollTo(0,0)}
    return;
  }
  if(a==='paste'){$('#paste').hidden=false;$('#paste-ta').focus();return}
  if(a==='pick-xlsx'){pickTarget=b.dataset.to||'paste-ta';return $('#xlsx-in').click()}
  if(a==='pdel'){pasteList.splice(Number(b.dataset.i),1);pasteToText();renderPasteTable();pasteStatus();return}
  if(a==='padd'){const max=pasteList.reduce((m,s)=>Math.max(m,Number.isFinite(s.no)?s.no:0),0);pasteList.push({no:max+1,name:''});pasteToText();renderPasteTable(true);pasteStatus();return}
  if(a==='roster')return openRoster();
  if(a==='build'){
    if(!pasteList.length){$('#paste-n').textContent='이름을 한 명 이상 넣어 주세요.';$('#paste-ta').focus();return}
    const err=rosterError(pasteList);
    if(err){$('#paste-n').textContent=err;$('#paste-n').classList.add('warn');return}
    DB=blankDB();DB.students=pasteList.map(s=>({no:s.no,name:s.name.trim()})).sort((a,b)=>a.no-b.no);
    DB.settings.grade=$('#paste-grade').value.trim();DB.settings.cls=$('#paste-cls').value.trim();DB.settings.teacher=$('#paste-teacher').value.trim();
    SAMPLE=false;save();return enterBoard();
  }
  /* 서류함 */
  if(a==='dprev'||a==='dnext'){st.dmonth=shiftMonth(st.dmonth,a==='dprev'?-1:1);st.focus=null;return renderDocs()}
  if(a==='dcheck'){const id=Number(b.dataset.id);b.checked?st.checked.add(id):st.checked.delete(id);return renderDocList()}
  if(a==='dfocus'){st.focus=Number(b.dataset.id);renderDocList();renderEdit();renderPaper();return}
  if(a==='blankmenu'){$('#blankmenu').hidden=!$('#blankmenu').hidden;return}
  if(a==='blank'){$('#blankmenu').hidden=true;return doPrint(null,b.dataset.type)}
  if(a==='print-one'){const r=rec(st.focus);if(r)doPrint([r]);return}
  if(a==='print-checked'){const list=[...st.checked].map(rec).filter(Boolean).sort((x,y)=>x.no-y.no||x.start.localeCompare(y.start));doPrint(list);return}
  if(a==='e-clear'){editRec(r=>{r.written=''});const i=$('#e-written');if(i)i.value='';return}
  if(a==='oppage'){
    const r=rec(st.focus);if(!r)return;
    const KEY={parent:'opParent',teacher:'opTeacher',app:'opApp',rep:'opRep'},PAIR={parent:'teacher',teacher:'parent',app:'rep',rep:'app'};
    const key=KEY[b.dataset.w],other=KEY[PAIR[b.dataset.w]];if(!key)return;
    if(r[key]!==false&&r[other]===false){toast('한 장은 남겨 두어야 해요');return}
    r[key]=r[key]===false;save();renderEdit();renderPaper();renderDocList();return;
  }
});
$$('#board .seg button').forEach(b=>b.addEventListener('click',()=>{
  closePop();st.view=b.dataset.view;
  if(st.view==='month')st.month=monthOf(st.date);
  renderBoard();
}));
$$('#dfilter button').forEach(b=>b.addEventListener('click',()=>{st.dfilter=b.dataset.f;renderDocs()}));
document.addEventListener('keydown',e=>{
  if(tour){if(e.key==='Escape')endTour();if(e.key==='ArrowRight')nextTour(1);if(e.key==='ArrowLeft')nextTour(-1);return}
  if($('#rmodal')){if(e.key==='Escape')closeRoster();return}
  if($('#modal')){if(e.key==='Escape')closeSettings();return}
  const t=e.target;
  if(!draft){if(e.key==='Escape'&&drawerNo!=null)closeDrawer();return}
  if(e.key==='Escape')return closePop();
  const typing=t.tagName==='INPUT'||t.tagName==='TEXTAREA';
  if(!typing&&/^[1-4]$/.test(e.key)){draft.gubun=GK[Number(e.key)-1];if(draft.gubun==='미인정'){draft.docs=[];draft.gotForm=false;draft.gotDocs=false}drawPop()}
  if(!typing&&e.key==='Enter'&&!t.closest('[data-pop="close"],[data-pop="del"]')){e.preventDefault();save_()}
});
let rsT;
addEventListener('resize',()=>{
  if(draft){popX=null;place()}
  if(tour)showTour();
  if(!drop.hidden)placeDrop();
  clearTimeout(rsT);rsT=setTimeout(()=>{if(st.screen==='docs')renderPaper();if(st.screen==='hero')fitArt()},120);
});

/* ───────── 가이드 (처음 출결판에 들어왔을 때 한 번만 저절로) ───────── */
const TOUR=[
  {sel:['#board .seg'],t:'하루(교시별) · 한 달(학생별)',p:'하루(교시별)는 나이스 화면처럼 교시별로 봐요. 한 달(학생별)에서는 학생별 횟수와 덜 받은 서류를 모아 봐요.'},
  {sel:['#grid tbody .name'],t:'이름을 누르면 입력',p:'이름을 누르면 그날 출결을 넣는 작은 창이 떠요. 구분과 종류만 고르고 저장하면 끝이에요.'},
  {sel:['#tour-cell','#grid td.p:not(.off)'],t:'교시를 누르면 한 번에',p:'조퇴는 누른 교시부터 종례까지, 지각은 조회부터 누른 교시까지 한 번에 채워져요. 결과는 빠진 교시만 하나씩 눌러요.'},
  {sel:['[data-tour="status"]'],t:'받으면 눌러서 체크',p:'주황 점은 아직 덜 받은 신고서·서류예요. 받으면 한 번 누르세요.'},
  {sel:['#grid .rs-in'],t:'사유는 칸에서 바로',p:'사유 칸을 누르면 전에 쓴 사유가 목록으로 떠요. 골라 넣거나, ×로 목록에서 지울 수 있어요.'},
  {sel:['#tab-docs'],t:'서류함에서 인쇄',p:'넣은 출결은 서류함에 모여요. 우리 학교 양식 그대로 채워진 신고서를 골라서 한 번에 인쇄해요.'},
  {sel:['#netState','#setBtn'],t:'인터넷이 없어도 돼요',p:'인터넷이 될 때 한 번 열어 두면, 그다음엔 인터넷이 끊겨도 이 주소로 열리고 입력·저장·인쇄가 다 돼요. 따로 켤 것은 없어요. 지금 상태는 설정의 [오프라인] 칸에서 볼 수 있어요.'},
  {sel:['#guideBtn'],t:'다시 보고 싶으면',p:'이 안내는 처음 한 번만 떠요. 다시 보려면 여기 [가이드 보기]를 누르세요.'},
];
let tour=null;
const tgt=step=>{for(const q of step.sel){const el=$(q);if(el&&el.getClientRects().length)return el}return null};
function maybeTour(){if(!tourSeen())setTimeout(()=>{if(!tourSeen()&&!tour&&st.screen==='board')startTour()},500)}
function startTour(){
  closePop();closeDrawer();closeDrop();closeSettings();
  st.screen='board';st.view='day';st.date=START_DAY;st.only=false;render();
  $('#grid').scrollTop=0;scrollTo(0,0);
  const steps=TOUR.filter(s=>tgt(s));
  if(!steps.length)return;
  tour={i:0,steps};
  const blk=document.createElement('div');blk.className='tour-block';blk.id='tour-block';
  const hole=document.createElement('div');hole.className='tour-hole';hole.id='tour-hole';
  const card=document.createElement('div');card.className='tour-card';card.id='tour-card';card.setAttribute('role','dialog');card.setAttribute('aria-label','가이드');
  document.body.append(blk,hole,card);
  card.addEventListener('click',e=>{e.stopPropagation();const b=e.target.closest('[data-t]');if(!b)return;if(b.dataset.t==='skip')endTour();else nextTour(Number(b.dataset.t))});
  showTour();
}
function nextTour(d){if(!tour)return;const n=tour.i+d;if(n<0)return;if(n>=tour.steps.length)return endTour();tour.i=n;showTour()}
function showTour(){
  const steps=tour.steps,step=steps[tour.i],el=tgt(step);
  const card=$('#tour-card'),hole=$('#tour-hole');
  if(!el)return nextTour(1);
  el.scrollIntoView({block:'nearest',inline:'nearest'});
  const r=el.getBoundingClientRect(),pad=6;
  Object.assign(hole.style,{left:r.left-pad+'px',top:r.top-pad+'px',width:r.width+pad*2+'px',height:r.height+pad*2+'px'});
  const last=tour.i===steps.length-1;
  card.innerHTML=`<div class="n">${tour.i+1} / ${steps.length}</div><h3>${step.t}</h3><p>${step.p}</p><div class="f">${last?'':'<button type="button" class="skip" data-t="skip">건너뛰기</button>'}<span class="dots">${steps.map((_,i)=>`<i class="${i===tour.i?'on':''}"></i>`).join('')}</span>${tour.i?'<button type="button" class="btn" data-t="-1">이전</button>':''}<button type="button" class="btn primary" data-t="1">${last?'시작하기':'다음'}</button></div>`;
  const cw=card.offsetWidth,ch=card.offsetHeight;
  const x=Math.min(Math.max(16,r.left),innerWidth-cw-16);
  let y=r.bottom+pad+12;
  if(y+ch>innerHeight-16)y=r.top-pad-12-ch;
  if(y<16)y=Math.min(innerHeight-ch-16,r.bottom+pad+12);
  card.style.left=x+'px';card.style.top=Math.max(16,y)+'px';
  card.querySelector('.btn.primary').focus({preventScroll:true});
}
function endTour(){
  tour=null;['tour-block','tour-hole','tour-card'].forEach(id=>document.getElementById(id)?.remove());
  try{localStorage.setItem(TOUR_KEY,'1')}catch(e){}
}
function tourSeen(){try{return localStorage.getItem(TOUR_KEY)==='1'}catch(e){return false}}

/* ───────── 오프라인 ───────── */
// 웹 주소로 열었을 때만 앱 파일·글꼴을 브라우저에 저장해 둬요(파일로 열거나 미리 보기에서는 안 써요)
const canOffline='serviceWorker' in navigator&&/^https?:$/.test(location.protocol)&&!PREVIEW;
/* 설정의 '오프라인' 칸에 보여 줄 지금 상태 */
function offlineInfo(){
  const on=navigator.onLine;
  if(PREVIEW)return {c:'wait',t:'미리 보기에서는 안 돼요',d:'배포한 웹 주소로 열면 따로 켜지 않아도 저절로 저장돼요. 미리 보기 화면은 인쇄·파일 받기·오프라인 저장이 막혀 있어요.'};
  if(!/^https?:$/.test(location.protocol))return {c:'',t:'파일로 열었어요',d:'파일로 연 앱은 원래 인터넷 없이 돼요. 다만 웹 주소에서 쓴 기록과는 따로 저장돼요.'};
  if(!('serviceWorker' in navigator))return {c:'wait',t:'이 브라우저는 오프라인 저장을 못 해요',d:'크롬이나 엣지로 열어 주세요.'};
  if(navigator.serviceWorker.controller)return {c:on?'':'off',t:on?'오프라인 준비됨':'인터넷 없음 · 계속 쓸 수 있어요',d:'이 브라우저에 앱과 글꼴이 저장돼 있어요. 인터넷이 없어도 이 주소로 열리고, 넣은 것은 이 컴퓨터에 저장돼요.'};
  return {c:'wait',t:'저장하는 중',d:on?'잠깐 기다리거나 새로고침해 보세요. 인터넷이 될 때 한 번 열면 저절로 저장돼요.':'아직 저장되지 않았어요. 인터넷이 될 때 다시 열어 주세요.'};
}
function offlineHTML(){const i=offlineInfo();return `<div class="offst"><span class="net ${i.c}">${i.t}</span><p class="hint">${i.d}</p></div>`}
function updateNet(){
  const so=$('#s-offline');if(so)so.innerHTML=offlineHTML();
  const el=$('#netState');if(!el)return;
  const ready=canOffline&&!!navigator.serviceWorker.controller;
  if(!navigator.onLine){el.hidden=false;el.className='net off';el.textContent='인터넷 없음 · 계속 쓸 수 있어요';el.title='넣은 것은 이 컴퓨터에 저장돼요.'}
  else if(ready){el.hidden=false;el.className='net';el.textContent='오프라인 준비됨';el.title='인터넷이 없어도 이 주소로 열려요.'}
  else el.hidden=true;
}
addEventListener('online',updateNet);addEventListener('offline',updateNet);
if(canOffline){
  navigator.serviceWorker.addEventListener('controllerchange',updateNet);
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
updateNet();

/* ───────── 시작 ───────── */
buildArt();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(st.screen==='hero')fitArt()});
const mine=loadSaved();
if(mine&&mine.students.length){DB=mine;st.screen='board';render();maybeTour()}
else{DB=mine||blankDB();st.screen='hero';render()}
})();
