(async function injectLayout(){
  // Header/Footers를 index에서 가져와서 필요한 블록만 삽입
  async function fetchHTML(url){ const res = await fetch(url, {cache:'no-store'}); return await res.text(); }
  const parser = new DOMParser();

  // 헤더
  try{
    const html = await fetchHTML('/calculator.html'); // 동일 구조 헤더
    const doc = parser.parseFromString(html, 'text/html');
    const header = doc.querySelector('.huchu-header');
    if (header) {
      const mount = document.querySelector('[data-include="header"]') || document.body;
      mount.insertAdjacentElement('afterbegin', header);
    }
  }catch(_){}

  // 푸터
  try{
    const html = await fetchHTML('/index.html');
    const doc = parser.parseFromString(html, 'text/html');
    const footer = doc.querySelector('.huchu-footer');
    const bar = doc.querySelector('.huchu-footer__bar');
    if (footer) document.body.appendChild(footer);
    if (bar) document.body.appendChild(bar);
  }catch(_){}

  // shared.js (네비 토글/로고)
  const s = document.createElement('script');
  s.src = '/assets/shared.js?v=20251113-split';
  s.defer = true;
  document.body.appendChild(s);
})();
