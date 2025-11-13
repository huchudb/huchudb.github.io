/* ===== 네비 토글 & 드롭다운 ===== */
document.addEventListener('DOMContentLoaded', () => {
  const navBtn = document.querySelector('.nav-toggle');
  const nav = document.getElementById('siteNav');
  if (navBtn && nav) {
    navBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  document.querySelectorAll('.has-sub>.menu-group').forEach(btn => {
    btn.addEventListener('click', () => {
      const li = btn.closest('.has-sub');
      const open = li.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  // 현재 메뉴 강조
  const path = location.pathname.replace(/\/index\.html$/, '/');
  document.querySelectorAll('.nav-menu a[href]').forEach(a => {
    const href = a.getAttribute('href');
    const isActive =
      (href === '/index.html' && (path === '/' || path === '/')) ||
      (href === '/calculator.html' && path.endsWith('/calculator.html'));
    if (isActive) a.setAttribute('aria-current', 'page');
  });

  // 로고: src 없으면 폴백 경로 지정, 로드 실패 시 텍스트 폴백 표시
  const img = document.getElementById('siteLogo');
  const fallback = document.getElementById('logoFallback');
  if (img && !img.getAttribute('src')) {
    // 정확한 기본 경로: /assets/logo/huchu-logo.png
    img.setAttribute('src', '/assets/logo/huchu-logo.png');
  }
  if (img) {
    const showImg = () => { img.style.display = 'block'; if (fallback) fallback.style.display = 'none'; };
    const showFallback = () => { img.style.display = 'none'; if (fallback) fallback.style.display = 'inline-flex'; };
    if (img.complete) {
      (img.naturalWidth > 0 ? showImg : showFallback)();
    } else {
      img.addEventListener('load', showImg);
      img.addEventListener('error', showFallback);
    }
  }

  // 기타 공용
  const y = document.getElementById('copyrightYear');
  if (y) y.textContent = String(new Date().getFullYear());
  const mail = document.getElementById('correctionEmailLink');
  if (mail && !mail.getAttribute('href')) mail.setAttribute('href', 'mailto:hello@huchu.example');
});

/* ===== 스토어 ===== */
export const Store = {
  noticesKey: 'huchu.notices',
  statsKey: 'huchu.statsMap',
  pickKey: 'huchu.selectedPeriod',
  getNotices(){ try{return JSON.parse(localStorage.getItem(this.noticesKey)||'[]')}catch(_){return []} },
  getStatsMap(){ try{return JSON.parse(localStorage.getItem(this.statsKey)||'{}')}catch(_){return {}} },
  setPick(ym){ localStorage.setItem(this.pickKey, ym); },
  getPick(){ return localStorage.getItem(this.pickKey) || ''; }
};

/* ===== 유틸 ===== */
export function insertComma4(n){
  return String(n).padStart(4,'0').replace(/\B(?=(\d{3})+(?!\d))/g,',');
}
export function fmtManRoundKRW(won){
  const man = Math.round((Number(won)||0)/10000);
  const eok = Math.floor(man/10000);
  const manR = man%10000;
  const jo = Math.floor(eok/10000);
  const eokR = eok%10000;
  if(jo>0) return `${jo}조 ${insertComma4(eokR)}억 ${insertComma4(manR)}만원`;
  if(eok>0) return `${eok}억 ${insertComma4(manR)}만원`;
  return `${man.toLocaleString('ko-KR')}만원`;
}
export function percentDelta(curr, prev){
  const c = Number(curr)||0, p = Number(prev)||0;
  if(p<=0) return { text:'0.0%', cls:'flat' };
  const d = ((c-p)/p)*100;
  const fixed = (Math.round(d*10)/10).toFixed(1)+'%';
  return { text: fixed, cls: d>0?'up':(d<0?'down':'flat') };
}
export const ymToDisplay = (ym)=> (ym||'').replace('-','/');
export function prevMonthYYYYMM(){
  const d = new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const pm = new Date(y, m-1, 1);
  const yy = pm.getFullYear();
  const mm = String(pm.getMonth()+1).padStart(2,'0');
  return `${yy}-${mm}`;
}
export function latestExistingOr(targetYM, map){
  if(map && map[targetYM]) return targetYM;
  const keys = Object.keys(map||{}).sort();
  if(keys.length===0) return targetYM;
  let pick = keys[0];
  for(const k of keys){ if(k<=targetYM) pick = k; }
  return pick;
}

/* ===== 계산기에서 공용 쓸 포맷 ===== */
export const onlyDigits = (s) => (s||"").replace(/[^0-9]/g,"");
export const toNumber = (s) => Number(onlyDigits(s)) || 0;
export function formatKoreanCurrency(num){
  const n = Math.max(0, Math.floor(num));
  if (n >= 100000000){
    const eok = Math.floor(n/100000000);
    const restMan = Math.floor((n%100000000)/10000);
    if (restMan > 0) return `${eok.toLocaleString('ko-KR')}억 ${restMan.toLocaleString('ko-KR')}만원`;
    return `${eok.toLocaleString('ko-KR')}억 원`;
  }else if(n >= 10000){
    return `${Math.floor(n/10000).toLocaleString('ko-KR')}만원`;
  }else{
    return `${n.toLocaleString('ko-KR')}원`;
  }
}
