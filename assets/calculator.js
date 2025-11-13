// 공용 유틸/스토어
const { onlyDigits, toNumber, formatKoreanCurrency } = window.HUCHU_UTIL;

// LTV 한도 (기존 값 유지)
const LTV_LIMITS = {
  "서울":   { "아파트": 0.73,   "다세대/연립": 0.70,   "단독/다가구": 0.70,   "토지/임야": 0.70 },
  "서울 외":{ "아파트": 0.6998, "다세대/연립": 0.65,   "단독/다가구": 0.65,   "토지/임야": 0.4999 }
};

/* ===== Input 프리뷰 ===== */
function updatePreview(inputId, viewId){
  const el = document.getElementById(inputId);
  const pv = document.getElementById(viewId);
  const raw = onlyDigits(el.value);
  el.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
  pv.textContent = formatKoreanCurrency(Number(raw||'0'));
}
function attachCommaWithPreview(id, viewId){
  const el = document.getElementById(id);
  if(!el) return;
  updatePreview(id, viewId);
  el.addEventListener('input', ()=> updatePreview(id, viewId));
}
function parseSharePercent(raw){
  const n = Number(onlyDigits(raw));
  if (!n) return 0;
  return Math.min(100, Math.max(1, n));
}
function updatePercentPreview(id, viewId){
  const el = document.getElementById(id);
  if(!el) return;
  const n = parseSharePercent(el.value);
  el.value = n ? String(n) : '';
  const pv = document.getElementById(viewId);
  if(pv) pv.textContent = n ? `${n}%` : '100%';
}
function attachPercentWithPreview(id, viewId){
  const el = document.getElementById(id);
  if(!el) return;
  updatePercentPreview(id, viewId);
  el.addEventListener('input', ()=> updatePercentPreview(id, viewId));
  el.addEventListener('blur',  ()=> updatePercentPreview(id, viewId));
}

/* ===== 핵심 계산 ===== */
const monthlyPayment = (principal, annualRate) => principal * annualRate / 12;

function computeLtv({region, propertyType, marketValue, seniorLoan, deduction, requestedLoan, sharePercent}){
  const ratio = LTV_LIMITS?.[region]?.[propertyType];
  if (!ratio) throw new Error('지역/부동산 종류를 다시 선택해주세요.');

  const isShare = sharePercent && sharePercent >= 1 && sharePercent <= 100;
  const baseValue = isShare ? (marketValue * (sharePercent/100)) : marketValue;
  const limit = baseValue * ratio;

  if (isShare){
    const maxRequested = Math.max(0, limit - seniorLoan);
    const status = (requestedLoan > 0)
      ? (seniorLoan > limit ? 'exceeded' : (requestedLoan <= maxRequested ? 'possible' : 'exceeded'))
      : 'no-request';
    return { mode:'share', ratio, limitBase: baseValue, limit, maxRequested, usedDeduction: 0, status };
  } else {
    const d = Math.max(0, Math.min(deduction, seniorLoan, requestedLoan));
    const maxRequested = Math.max(0, limit - seniorLoan + d);
    const status = (requestedLoan > 0)
      ? (requestedLoan <= maxRequested ? 'possible' : 'exceeded')
      : 'no-request';
    return { mode:'normal', ratio, limitBase: baseValue, limit, maxRequested, usedDeduction: d, status };
  }
}

/* ===== 모달 ===== */
const calcModal = {
  el:null, body:null, closeBtn:null, statusEl:null,
  open(html, status){
    if(!this.el){
      this.el = document.getElementById('resultModal');
      this.body = document.getElementById('modalBody');
      this.closeBtn = document.getElementById('modalCloseBtn');
      this.statusEl = document.getElementById('modalStatus');
      this.el.addEventListener('click', (e)=>{ if(e.target.dataset.close==='true') calcModal.close(); });
      this.closeBtn.addEventListener('click', ()=> calcModal.close());
      document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') calcModal.close(); });
    }
    if(this.statusEl){
      this.statusEl.className = 'status-pill';
      this.statusEl.classList.add(status?.type||'info');
      this.statusEl.textContent = status?.text||'안내';
      this.statusEl.classList.remove('hide');
    }
    this.body.innerHTML = html;
    this.el.classList.remove('hide');
    document.body.classList.add('modal-open');
    this.closeBtn.focus({preventScroll:true});
  },
  close(){ if(this.el){ this.el.classList.add('hide'); document.body.classList.remove('modal-open'); } }
};

function buildInputChips({region, propertyType, marketValue, seniorLoan, requestedLoan, deduction, sharePercent}){
  const shareUsed = sharePercent && sharePercent >= 1 && sharePercent <= 100;
  const shareBase = shareUsed ? Math.floor(marketValue * (sharePercent/100)) : null;
  const chips = [
    `<span class="chip"><span class="label">지역</span><span class="val">${region || '-'}</span></span>`,
    `<span class="chip"><span class="label">종류</span><span class="val">${propertyType || '-'}</span></span>`,
    `<span class="chip"><span class="label">시세</span><span class="val">${formatKoreanCurrency(marketValue)}</span></span>`,
    `<span class="chip"><span class="label">선순위+보증금</span><span class="val">${formatKoreanCurrency(seniorLoan)}</span></span>`,
    `<span class="chip"><span class="label">요청금액</span><span class="val">${formatKoreanCurrency(requestedLoan)}</span></span>`,
  ];
  if (deduction > 0){ chips.push(`<span class="chip"><span class="label">상환/반환</span><span class="val">${formatKoreanCurrency(deduction)}</span></span>`); }
  if (shareUsed){
    chips.push(`<span class="chip"><span class="label">지분율</span><span class="val">${sharePercent}%</span></span>`);
    chips.push(`<span class="chip"><span class="label">지분 시세</span><span class="val">${formatKoreanCurrency(shareBase)}</span></span>`);
  }
  return `
    <div class="breakdown-card input-summary" aria-labelledby="inputsTitle">
      <div id="inputsTitle" class="card-title">입력 요약</div>
      <div class="chip-row">${chips.join('')}</div>
    </div>
  `;
}

function validateRequired(){
  const missing = [];
  const ids = {
    '1. 지역': 'region',
    '2. 부동산 종류': 'propertyType',
    '3. 시세': 'marketValue',
    '4. 선순위 잔액+보증금': 'seniorLoan',
    '5. 필요 대출금액': 'requestedLoan'
  };
  const getRaw = id => document.getElementById(id).value.trim();
  const hasNum = id => !!onlyDigits(document.getElementById(id).value);

  if(!getRaw(ids['1. 지역'])) missing.push('1. 지역');
  if(!getRaw(ids['2. 부동산 종류'])) missing.push('2. 부동산 종류');
  if(!hasNum(ids['3. 시세'])) missing.push('3. 시세');
  if(getRaw(ids['4. 선순위 잔액+보증금']) === '') missing.push('4. 선순위 잔액+보증금');
  if(!hasNum(ids['5. 필요 대출금액'])) missing.push('5. 필요 대출금액');

  return { missing, focusId: ids[missing[0]] };
}

function kpisHTML(label1, val1, label2, val2){
  return `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">${label1}</div><div class="kpi-value">${formatKoreanCurrency(val1)}</div></div>
      <div class="kpi"><div class="kpi-label">${label2}</div><div class="kpi-value">${formatKoreanCurrency(val2)}</div></div>
    </div>`;
}
const kpisForPossible = (req, addAvail) => kpisHTML('요청 금액(총 실행)', req, '추가 가능 금액', addAvail);
const kpisForDenied   = (req, maxReq) => kpisHTML('요청 금액(총 실행)', req, '가능 요청금액', Math.max(0, maxReq));

/* ===== 일일 이용자수 (기존 API 그대로) ===== */
const API_BASE = 'https://huchudb-github-io.vercel.app';
const DAILY_API = `${API_BASE}/api/daily-users`;
const dailyNumEl = () => document.getElementById('todayUsersCount');
const typeCountEl = id => document.getElementById(id);
const DAILY_FLAG_PREFIX = 'huchu.dailyUsers.bumped.';
function getKSTDateKey(ts = Date.now()){
  const msKST = ts + 9 * 60 * 60 * 1000;
  const d = new Date(msKST);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2,'0');
  const dd = String(d.getUTCDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
const todayFlagKey = () => DAILY_FLAG_PREFIX + getKSTDateKey();
function animateCount(el, to, duration = 500){
  if (!el) return;
  const from = Number((el.textContent||"").replace(/[^0-9]/g,"")) || 0;
  const start = performance.now();
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  function frame(now){
    const p = Math.min(1, (now - start) / duration);
    const val = Math.round(from + (to - from) * easeOutCubic(p));
    el.textContent = val.toLocaleString('ko-KR');
    if(p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
async function serverGetCount(){
  const r = await fetch(`${DAILY_API}?t=${Date.now()}`, { method:'GET', mode:'cors', credentials:'omit', headers:{ 'Accept':'application/json' }, cache:'no-store' });
  const j = await r.json();
  return { total:Number(j.count||0), byType:j.byType || {'아파트':0,'다세대/연립':0,'단독/다가구':0,'토지/임야':0} };
}
async function serverIncrementOncePerDay(typeKor){
  const flag = todayFlagKey();
  if (localStorage.getItem(flag) === '1') return null;
  const r = await fetch(`${DAILY_API}?t=${Date.now()}`, {
    method:'POST', mode:'cors', credentials:'omit',
    headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
    body: JSON.stringify({ type: String(typeKor||'') }),
    cache:'no-store'
  });
  const j = await r.json();
  localStorage.setItem(flag, '1');
  return { total:Number(j.count||0), byType:j.byType || {'아파트':0,'다세대/연립':0,'단독/다가구':0,'토지/임야':0} };
}
function renderDaily({ total, byType }){
  animateCount(dailyNumEl(), total);
  if (byType){
    const set = (id, v) => { const el = typeCountEl(id); if (el) el.textContent = (v||0).toLocaleString('ko-KR'); };
    set('aptCount', byType['아파트']); set('multiCount', byType['다세대/연립']);
    set('houseCount', byType['단독/다가구']); set('landCount', byType['토지/임야']);
  }
}
async function initDailyUsersUI(){
  try{ renderDaily(await serverGetCount()); }catch(_){}
  setInterval(async ()=>{ try{ renderDaily(await serverGetCount()); }catch(_){} }, 60000);
}
async function bumpDailyUsersOncePerDay(propertyTypeKor){
  try{ const data = await serverIncrementOncePerDay(propertyTypeKor); if (data) renderDaily(data); }catch(_){}
}

/* ===== 계산 클릭 ===== */
function validateAndCompute(){
  const missing = [];
  const ids = {
    '1. 지역': 'region',
    '2. 부동산 종류': 'propertyType',
    '3. 시세': 'marketValue',
    '4. 선순위 잔액+보증금': 'seniorLoan',
    '5. 필요 대출금액': 'requestedLoan'
  };
  const getRaw = id => document.getElementById(id).value.trim();
  const hasNum = id => !!onlyDigits(document.getElementById(id).value);

  if(!getRaw(ids['1. 지역'])) missing.push('1. 지역');
  if(!getRaw(ids['2. 부동산 종류'])) missing.push('2. 부동산 종류');
  if(!hasNum(ids['3. 시세'])) missing.push('3. 시세');
  if(getRaw(ids['4. 선순위 잔액+보증금']) === '') missing.push('4. 선순위 잔액+보증금');
  if(!hasNum(ids['5. 필요 대출금액'])) missing.push('5. 필요 대출금액');

  return { missing, focusId: ids[missing[0]] };
}

function kpisForInfo(msg){
  return `<div class="notice info"><p>${msg}</p><p class="disclaimer">※ 실제 온투업체 심사 결과와 다를 수 있습니다.</p></div>`;
}

async function onCalculate(){
  const { missing, focusId } = validateAndCompute();
  if(missing.length){
    const list = missing.map(t => `<li>${t}</li>`).join('');
    calcModal.open(`
      <div class="notice info">
        <p><strong>필수 입력(1~5)</strong>을 모두 작성해주세요.</p>
        <ul style="margin:6px 0 0 18px; color:#334155;">${list}</ul>
        <p class="disclaimer">※ 안심하세요~ 입력하신 정보는 저장되지 않습니다.</p>
      </div>
    `, {type:'info', text:'안내'});
    if(focusId){ setTimeout(()=> document.getElementById(focusId).focus({preventScroll:true}), 150); }
    return;
  }

  const region        = document.getElementById('region').value;
  const propertyType  = document.getElementById('propertyType').value;
  const marketValue   = toNumber(document.getElementById('marketValue').value);
  const seniorLoan    = toNumber(document.getElementById('seniorLoan').value);
  const requestedLoan = toNumber(document.getElementById('requestedLoan').value);
  let deduction       = toNumber(document.getElementById('deduction').value);
  const sharePercent  = parseSharePercent(document.getElementById('sharePercent').value);

  if (deduction > requestedLoan) { alert('상환/반환 금액이 "필요한 대출 금액"을 초과할 수 없습니다. 자동조정합니다.'); deduction = requestedLoan; }
  if (deduction > seniorLoan)    { alert('상환/반환 금액이 선순위 잔액을 초과할 수 없습니다. 자동조정합니다.'); deduction = seniorLoan; }
  document.getElementById('deduction').value = deduction.toLocaleString('ko-KR');
  updatePreview('deduction','deduction_view');

  let r;
  try { r = computeLtv({region, propertyType, marketValue, seniorLoan, deduction, requestedLoan, sharePercent}); }
  catch (e) {
    const inputs = buildInputChips({region, propertyType, marketValue, seniorLoan, requestedLoan, deduction, sharePercent});
    calcModal.open(`${inputs}<div class="notice error"><p>${e.message}</p></div>`, {type:'error', text:'오류'});
    return;
  }

  const inputs = buildInputChips({region, propertyType, marketValue, seniorLoan, requestedLoan, deduction, sharePercent});

  if (seniorLoan > r.limit || r.status === 'exceeded') {
    const kpis = kpisForDenied(requestedLoan, r.maxRequested);
    calcModal.open(`${inputs}${kpis}
      <div class="notice error"><p><strong>요청하신 금액으로는 대출이 어렵습니다.</strong></p><p><strong>가능 요청금액</strong>만큼 가능합니다.</p><p class="disclaimer">※ 실제 온투업체 심사 결과와 다를 수 있습니다.</p></div>
    `, {type:'error', text:'대출 불가'});
    await bumpDailyUsersOncePerDay(propertyType);
    return;
  }

  if (r.status === 'no-request') {
    calcModal.open(`${inputs}${kpisForInfo('요청 금액을 입력하면 가능 여부를 알려드립니다.')}`, {type:'info', text:'안내'});
    return;
  }

  const addAvail = Math.max(0, r.maxRequested - requestedLoan);
  const mMin = monthlyPayment(requestedLoan, 0.068);
  const mMax = monthlyPayment(requestedLoan, 0.148);
  const feeMin = requestedLoan * 0.01;
  const feeMax = requestedLoan * 0.015;

  const kpis = kpisForPossible(requestedLoan, addAvail);
  const breakdownCosts = `
    <div class="breakdown-card" aria-labelledby="costsTitle">
      <div id="costsTitle" class="card-title">예상 비용 상세</div>
      <div class="card-section">
        <div class="section-title"><span class="icon-dot dot-blue"></span>매월 이자 금액</div>
        <div class="chip-row rate">
          <span class="chip plain"><span class="label rate-min">6.8%</span><span class="val">${formatKoreanCurrency(mMin)}</span></span>
          <span class="chip-tilde">~</span>
          <span class="chip plain"><span class="label rate-max">14.8%</span><span class="val">${formatKoreanCurrency(mMax)}</span></span>
        </div>
      </div>
      <div class="card-section compact">
        <div class="section-title"><span class="icon-dot dot-gold"></span>플랫폼수수료 (연 1회)</div>
        <div class="chip-row rate">
          <span class="chip plain"><span class="label rate-min">1%</span><span class="val">${formatKoreanCurrency(feeMin)}</span></span>
          <span class="chip-tilde">~</span>
          <span class="chip plain"><span class="label rate-max">1.5%</span><span class="val">${formatKoreanCurrency(feeMax)}</span></span>
        </div>
      </div>
    </div>`;
  const breakdownInfo = `
    <div class="breakdown-card" aria-labelledby="infoTitle">
      <div id="infoTitle" class="card-title">기타 안내</div>
      <div class="rowlist">
        <div class="row"><span class="icon-dot dot-navy"></span><span class="label">대출기간</span><span class="value">평균 1년</span></div>
        <div class="row"><span class="icon-dot dot-green"></span><span class="label">중도상환수수료</span><span class="value">없음</span></div>
        <div class="row"><span class="icon-dot dot-slate"></span><span class="label">대출연장수수료</span><span class="value">0%~1% (업체별 상이)</span></div>
      </div>
    </div>`;

  const html = `${inputs}${kpis}
    <div class="notice success"><p><strong>요청하신 금액으로 대출이 가능합니다.</strong></p><p>추가 가능 금액 내에서 <strong>증액</strong>도 가능합니다.</p><p class="disclaimer">※ 실제 온투업체 심사 결과와 다를 수 있습니다.</p></div>
    ${breakdownCosts}${breakdownInfo}`;
  calcModal.open(html, {type:'success', text:'대출 가능'});
  await bumpDailyUsersOncePerDay(propertyType);
}

/* ===== 시작 ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  attachCommaWithPreview('marketValue','marketValue_view');
  attachCommaWithPreview('seniorLoan','seniorLoan_view');
  attachCommaWithPreview('requestedLoan','requestedLoan_view');
  attachCommaWithPreview('deduction','deduction_view');
  attachPercentWithPreview('sharePercent','sharePercent_view');
  document.getElementById('calcBtn')?.addEventListener('click', onCalculate);

  initDailyUsersUI();
});
