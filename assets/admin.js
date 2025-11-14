/* 관리자 진입 게이트 + 입력 포맷팅 + (있을 경우) 저장 API 연동
   - admin.html 은 기존대로 두고, 이 파일만 포함되어 있으면 동작합니다.
   - JWT 없으면 로그인 레이어를 만들어 비번 요청 → /api/admin/login 호출 → token 저장
   - 숫자 입력 자동 콤마: input[data-comma] 에 붙습니다.
   - % → 금액 자동계산: input[data-percent-of][data-output] 패턴에 붙습니다. (있으면 동작)
   - 공지 저장/통계 저장은 해당 폼/버튼이 있을 때만 안전하게 붙습니다. */

const TOKEN_KEY = 'huchu.jwt';

function getToken(){ return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t){ if(t) localStorage.setItem(TOKEN_KEY, t); }
function authHeader(){
  const t = getToken();
  return t ? { 'Authorization': `Bearer ${t}` } : {};
}

/* ============ 로그인 레이어 ============ */
function ensureLogin(){
  if(getToken()) return Promise.resolve(true);

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(2,6,23,.6)';
  overlay.style.backdropFilter = 'blur(2px)';
  overlay.style.display = 'grid';
  overlay.style.placeItems = 'center';
  overlay.style.zIndex = '999999';

  const panel = document.createElement('div');
  panel.style.width = 'min(92vw, 420px)';
  panel.style.background = '#fff';
  panel.style.border = '1px solid #d0d7e2';
  panel.style.borderRadius = '12px';
  panel.style.boxShadow = '0 16px 48px rgba(2,6,23,.35)';
  panel.style.padding = '18px';

  panel.innerHTML = `
    <h3 style="margin:0 0 10px;color:#0b2a66">관리자 로그인</h3>
    <p style="margin:0 0 12px;color:#475569;font-size:14px">관리자 비밀번호를 입력하세요.</p>
    <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
      <input id="adminPwd" type="password" placeholder="Password" style="padding:10px;border:1px solid #cbd5e1;border-radius:8px" />
      <button id="adminLoginBtn" style="padding:10px 14px;border:0;border-radius:8px;background:#1a365d;color:#fff;font-weight:800;cursor:pointer">로그인</button>
    </div>
    <div id="adminLoginMsg" style="margin-top:8px;color:#b91c1c;font-size:12px;min-height:16px"></div>
  `;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  return new Promise((resolve)=>{
    const btn = panel.querySelector('#adminLoginBtn');
    const pwd = panel.querySelector('#adminPwd');
    const msg = panel.querySelector('#adminLoginMsg');

    async function doLogin(){
      msg.textContent = '';
      const password = (pwd.value||'').trim();
      if(!password){ msg.textContent = '비밀번호를 입력하세요.'; return; }
      try{
        const r = await fetch('/api/admin/login', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ password })
        });
        if(!r.ok){
          msg.textContent = '로그인 실패. 비밀번호를 확인하세요.';
          return;
        }
        const j = await r.json();
        if(j && j.token){
          setToken(j.token);
          overlay.remove();
          resolve(true);
        }else{
          msg.textContent = '응답 오류. 다시 시도하세요.';
        }
      }catch(e){
        console.error(e);
        msg.textContent = '네트워크 오류. 다시 시도하세요.';
      }
    }

    btn.addEventListener('click', doLogin);
    pwd.addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
    setTimeout(()=> pwd.focus(), 50);
  });
}

/* ============ 숫자/퍼센트 포맷팅 ============ */
function onlyDigits(s){ return String(s||'').replace(/[^0-9]/g,''); }
function toNumber(s){ return Number(onlyDigits(s)) || 0; }

function attachNumberCommaFormatting(){
  // data-comma 가 붙은 모든 input에 콤마 자동 적용
  document.querySelectorAll('input[data-comma]').forEach(el=>{
    const format = ()=>{
      const raw = onlyDigits(el.value);
      el.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
      // 프리뷰가 필요하면 data-preview="#id" 로 표기
      const pvSel = el.getAttribute('data-preview');
      if(pvSel){
        const pv = document.querySelector(pvSel);
        if(pv) pv.textContent = raw
          ? Number(raw).toLocaleString('ko-KR')
          : '0';
      }
    };
    format();
    el.addEventListener('input', format);
    el.addEventListener('blur', format);
  });

  // 퍼센트 입력 → 금액 자동 계산
  // 예) <input id="rate" data-percent-of="#base" data-output="#amount">
  document.querySelectorAll('input[data-percent-of][data-output]').forEach(el=>{
    const baseSel = el.getAttribute('data-percent-of');
    const outSel  = el.getAttribute('data-output');
    const baseEl = document.querySelector(baseSel);
    const outEl  = document.querySelector(outSel);
    const format = ()=>{
      const pct = toNumber(el.value);   // 0~100 가정
      const base = baseEl ? toNumber(baseEl.value) : 0;
      const amount = Math.floor(base * (pct/100));
      if(outEl){
        outEl.value = amount ? amount.toLocaleString('ko-KR') : '';
        outEl.dispatchEvent(new Event('input')); // 다른 포맷터 연쇄
      }
    };
    el.addEventListener('input', format);
  });
}

/* ============ 관리자 폼(존재할 때만) ============ */
function wireNoticeFormIfExists(){
  const form = document.getElementById('noticeForm');
  if(!form) return;

  const titleEl = form.querySelector('[name="title"]');
  const linkEl  = form.querySelector('[name="linkUrl"]');
  const imgEl   = form.querySelector('[name="imageUrl"]');
  const activeEl= form.querySelector('[name="active"]');
  const pubEl   = form.querySelector('[name="publishedAt"]');
  const fileEl  = form.querySelector('[type="file"]');
  const saveBtn = form.querySelector('[data-action="save-notice"]');
  const msgEl   = form.querySelector('[data-msg]');

  async function uploadIfNeeded(){
    if(!fileEl || !fileEl.files || fileEl.files.length===0) return null;
    const f = fileEl.files[0];
    // presign
    const r = await fetch('/api/admin/presign', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', ...authHeader() },
      body: JSON.stringify({ filename: f.name, contentType: f.type || 'application/octet-stream' })
    });
    if(!r.ok) throw new Error('presign 실패');
    const j = await r.json();
    // PUT 업로드
    await fetch(j.url, { method:'PUT', headers:{ 'Content-Type': f.type || 'application/octet-stream' }, body: f });
    return j.publicUrl || j.url.split('?')[0]; // API가 publicUrl 제공하면 우선 사용
  }

  async function onSave(){
    msgEl && (msgEl.textContent = '');
    try{
      let imageUrl = imgEl?.value?.trim() || '';
      const up = await uploadIfNeeded();
      if(up) imageUrl = up;

      const payload = {
        title: titleEl?.value?.trim() || '',
        linkUrl: linkEl?.value?.trim() || '',
        imageUrl,
        active: !!(activeEl && (activeEl.checked || activeEl.value==='true')),
        publishedAt: pubEl?.value ? new Date(pubEl.value).toISOString() : new Date().toISOString()
      };
      const r = await fetch('/api/admin/notices/save', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...authHeader() },
        body: JSON.stringify(payload)
      });
      if(!r.ok) throw new Error('저장 실패');
      msgEl && (msgEl.style.color = '#166534', msgEl.textContent = '저장 완료');
    }catch(e){
      console.error(e);
      msgEl && (msgEl.style.color = '#b91c1c', msgEl.textContent = '오류: 저장 실패');
    }
  }

  if(saveBtn) saveBtn.addEventListener('click', (e)=>{ e.preventDefault(); onSave(); });
}

function wireStatsFormIfExists(){
  const form = document.getElementById('statsForm');
  if(!form) return;

  const ymEl    = form.querySelector('[name="ym"]');

  // kpi2
  const loanEl  = form.querySelector('[name="kpi2.cumulative_loan_krw"]');
  const repayEl = form.querySelector('[name="kpi2.cumulative_repayment_krw"]');
  const balEl   = form.querySelector('[name="kpi2.balance_krw"]');

  // kpi2_prev
  const loanPrevEl  = form.querySelector('[name="kpi2_prev.cumulative_loan_krw"]');
  const repayPrevEl = form.querySelector('[name="kpi2_prev.cumulative_repayment_krw"]');
  const balPrevEl   = form.querySelector('[name="kpi2_prev.balance_krw"]');

  // kpi1_rows (간단 버전: product/balance 한 쌍만 예시. 실제로는 행 추가 UI에 맞춰 반복 수집)
  const prodEls = form.querySelectorAll('[name="kpi1_rows.product_type_name_kr"]');
  const balEls  = form.querySelectorAll('[name="kpi1_rows.balance_krw"]');

  const saveBtn = form.querySelector('[data-action="save-stats"]');
  const msgEl   = form.querySelector('[data-msg]');

  function valNum(el){ return el ? toNumber(el.value) : 0; }
  function valStr(el){ return (el && el.value || '').trim(); }

  async function onSave(){
    msgEl && (msgEl.textContent = '');
    try{
      const rows = [];
      prodEls.forEach((p, i)=>{
        const name = valStr(p);
        const b = toNumber(balEls?.[i]?.value || '');
        if(name){ rows.push({ product_type_name_kr: name, balance_krw: b }); }
      });

      const payload = {
        ym: valStr(ymEl),
        kpi2: {
          cumulative_loan_krw:  valNum(loanEl),
          cumulative_repayment_krw: valNum(repayEl),
          balance_krw: valNum(balEl)
        },
        kpi2_prev: {
          cumulative_loan_krw:  valNum(loanPrevEl),
          cumulative_repayment_krw: valNum(repayPrevEl),
          balance_krw: valNum(balPrevEl)
        },
        kpi1_rows: rows,
        // 필요시 kpi1_prev 도 같은 방식으로 수집 가능
      };

      const r = await fetch('/api/admin/stats/set', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...authHeader() },
        body: JSON.stringify(payload)
      });
      if(!r.ok) throw new Error('저장 실패');
      msgEl && (msgEl.style.color = '#166534', msgEl.textContent = '저장 완료');
    }catch(e){
      console.error(e);
      msgEl && (msgEl.style.color = '#b91c1c', msgEl.textContent = '오류: 저장 실패');
    }
  }

  if(saveBtn) saveBtn.addEventListener('click', (e)=>{ e.preventDefault(); onSave(); });
}

/* ============ 시작 ============ */
document.addEventListener('DOMContentLoaded', async ()=>{
  // 관리자 진입 보호
  await ensureLogin();

  // 숫자/퍼센트 포맷터 연결
  attachNumberCommaFormatting();

  // 관리자 폼(있으면) 연결
  wireNoticeFormIfExists();
  wireStatsFormIfExists();
});
