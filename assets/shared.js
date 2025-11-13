/* ===== 공용 네비/로고 ===== */
function initHeaderNav() {
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

  // 현재 페이지 표시
  const path = location.pathname.replace(/\/index\.html$/, '/');
  document.querySelectorAll('.nav-menu a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;
    const target = href.replace(/\/index\.html$/, '/');
    if (target === path) a.setAttribute('aria-current', 'page');
  });
}

function initLogoSwap() {
  const img = document.getElementById('siteLogo');
  const fallback = document.getElementById('logoFallback');
  if (!img) return;

  // 다크모드 대응
  const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const base = '/assets/logo/';
  const lightSrc = base + 'huchu-logo.png';
  const darkSrc  = base + 'huchu-logo-dark.png';
  img.src = dark ? darkSrc : lightSrc;
  img.srcset = `${img.src} 1x, ${img.src.replace('.png','@2x.png')} 2x`;

  // 로드되면 표시
  img.addEventListener('load', () => {
    img.style.display = 'block';
    if (fallback) fallback.style.display = 'none';
  });
  img.addEventListener('error', () => {
    // 이미지 없으면 폴백
    img.style.display = 'none';
    if (fallback) fallback.style.display = 'inline-flex';
  });
}

/* ===== 저장소(키 이름은 예전과 동일 유지) ===== */
const Store = {
  noticesKey: 'huchu.notices',
  statsKey:   'huchu.statsMap',
  pickKey:    'huchu.selectedPeriod',
  getNotices(){ try{return JSON.parse(localStorage.getItem(this.noticesKey)||'[]')}catch(_){return []} },
  getStatsMap(){ try{return JSON.parse(localStorage.getItem(this.statsKey)||'{}')}catch(_){return {}} },
  setPick(ym){ localStorage.setItem(this.pickKey, ym); },
  getPick(){ return localStorage.getItem(this.pickKey) || ''; }
};
window.HUCHU_STORE = Store;

/* ===== 공용 유틸 ===== */
function onlyDigits(s){ return (s||'').replace(/[^0-9]/g, ''); }
function toNumber(s){ return Number(onlyDigits(s)) || 0; }
function formatKoreanCurrency(num){
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
window.HUCHU_UTIL = { onlyDigits, toNumber, formatKoreanCurrency };

function initFooterMisc(){
  const y = document.getElementById('copyrightYear');
  if (y) y.textContent = String(new Date().getFullYear());
  const mail = document.getElementById('correctionEmailLink');
  if (mail && !mail.getAttribute('href')) mail.setAttribute('href','mailto:hello@huchu.example');
}

/* ===== 시작 ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  initHeaderNav();
  initLogoSwap();
  initFooterMisc();
});
