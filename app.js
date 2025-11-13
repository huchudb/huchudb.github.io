/* ===== 라우터 ===== */
function showRoute(name){
  document.querySelectorAll('main[data-route]').forEach(m=>{
    m.hidden = m.dataset.route !== name;
  });
  document.querySelectorAll('[data-route-link]').forEach(a=>{
    const href = (a.getAttribute('href')||'').replace('#','');
    a.setAttribute('aria-current', href===name ? 'page' : null);
  });
}
function currentHashRoute(){ return (location.hash||'#home').replace('#','') || 'home'; }
function initRouter(){
  const navBtn = document.querySelector('.nav-toggle');
  const nav = document.getElementById('siteNav');
  if(navBtn && nav){
    navBtn.addEventListener('click', ()=>{
      const open = nav.classList.toggle('is-open');
      navBtn.setAttribute('aria-expanded', open?'true':'false');
    });
  }
  document.querySelectorAll('.has-sub>.menu-group').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const li = btn.closest('.has-sub');
      const open = li.classList.toggle('open');
      btn.setAttribute('aria-expanded', open?'true':'false');
    });
  });
  document.querySelectorAll('[data-route-link]').forEach(a=>{
    a.addEventListener('click',(e)=>{
      const to = (a.getAttribute('href')||'#home').replace('#','');
      showRoute(to);
      if(nav) nav.classList.remove('is-open');
      e.preventDefault();
      history.replaceState(null,'','#'+to);
    });
  });
  window.addEventListener('hashchange', ()=> showRoute(currentHashRoute()));
  showRoute(currentHashRoute());
}

/* ===== 로고 fallback ===== */
(function(){
  const img = document.getElementById('siteLogo');
  const fallback = document.getElementById('logoFallback');
  if(img && img.getAttribute('src')){ img.style.display = 'block'; if(fallback) fallback.style.display = 'none'; }
})();

/* ===== 저장소 ===== */
const Store = {
  noticesKey: 'huchu.notices',
  statsKey: 'huchu.statsMap',
  pickKey: 'huchu.selectedPeriod',
  getNotices(){ try{return JSON.parse(localStorage.getItem(this.noticesKey)||'[]')}catch(_){return []} },
  getStatsMap(){ try{return JSON.parse(localStorage.getItem(this.statsKey)||'{}')}catch(_){return {}} },
  setPick(ym){ localStorage.setItem(this.pickKey, ym); },
  getPick(){ return localStorage.getItem(this.pickKey) || ''; }
};

/* ===== 유틸 ===== */
function insertComma4(n){ // 4자리 묶음에 3자리 쉼표 삽입 (예: 3580 -> 3,580)
  return String(n).padStart(4,'0').replace(/\B(?=(\d{3})+(?!\d))/g,',');
}
function fmtManRoundKRW(won){
  const man = Math.round((Number(won)||0)/10000);
  const eok = Math.floor(man/10000);
  const manR = man%10000;
  const jo = Math.floor(eok/10000);
  const eokR = eok%10000;
  if(jo>0) return `${jo}조 ${insertComma4(eokR)}억 ${insertComma4(manR)}만원`;
  if(eok>0) return `${eok}억 ${insertComma4(manR)}만원`;
  return `${man.toLocaleString('ko-KR')}만원`;
}
function percentDelta(curr, prev){
  const c = Number(curr)||0, p = Number(prev)||0;
  if(p<=0) return { text:'0.0%', cls:'flat' };
  const d = ((c-p)/p)*100;
  const fixed = (Math.round(d*10)/10).toFixed(1)+'%';
  return { text: fixed, cls: d>0?'up':(d<0?'down':'flat') };
}
function ymToDisplay(ym){ return (ym||'').replace('-','/'); }
function prevMonthYYYYMM(){
  const d = new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const pm = new Date(y, m-1, 1);
  const yy = pm.getFullYear();
  const mm = String(pm.getMonth()+1).padStart(2,'0');
  return `${yy}-${mm}`;
}
function latestExistingOr(targetYM, map){
  if(map && map[targetYM]) return targetYM;
  const keys = Object.keys(map||{}).sort();
  if(keys.length===0) return targetYM;
  let pick = keys[0];
  for(const k of keys){ if(k<=targetYM) pick = k; }
  return pick;
}

/* ===== Chart.js donut label plugin ===== */
const DonutLabelPlugin = {
  id: 'donutCenterLabels',
  afterDatasetDraw(chart, args){
    if(args.index !== 0) return;
    const meta = args.meta;
    const data = meta.data;
    const total = meta._parsedTotal || meta.total || chart.config.data.datasets[0].data.reduce((a,b)=>a+b,0);
    const {ctx} = chart;
    ctx.save();
    ctx.fillStyle = '#0b2a66';
    ctx.font = '600 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    data.forEach((arc)=>{
      const val = arc.$context.raw || 0;
      const pct = total ? (val/total)*100 : 0;
      if(pct < 3) return;
      const p = arc.getProps(['x','y','startAngle','endAngle','innerRadius','outerRadius'], true);
      const angle = (p.startAngle + p.endAngle)/2;
      const r = (p.innerRadius + p.outerRadius)/2;
      const x = p.x + Math.cos(angle)*r;
      const y = p.y + Math.sin(angle)*r;
      const text = (Math.round(pct*10)/10)+'%';
      ctx.fillText(text, x, y);
    });
    ctx.restore();
  }
};
let donutChart = null;

/* ===== 홈 렌더 ===== */
function renderByPeriod(ym){
  const map = Store.getStatsMap();
  const rec = map[ym];
  const disp = ymToDisplay(ym);
  const hpi = document.getElementById('huchuPeriodInline'); if(hpi) hpi.textContent = disp;

  if(!rec){
    ['kpi2-loan','kpi2-repay','kpi2-balance'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.textContent = '0조 0억 0만원';
    });
    ['kpi2-loan-delta','kpi2-repay-delta','kpi2-balance-delta'].forEach(id=>{
      const el = document.getElementById(id); if(el){ el.textContent='0.0%'; el.className='delta-badge flat'; }
    });
    if(donutChart){ donutChart.destroy(); donutChart=null; }
    const lg = document.getElementById('huchuLegend');
    if(lg){ lg.innerHTML = `<div class="huchu-legend-item"><div class="legend-name" style="opacity:.7">선택한 기준월 데이터가 없습니다.</div></div>`; }
    return;
  }

  // KPI 값 + 전월대비
  const k = rec.kpi2||{};
  const kPrev = rec.kpi2_prev||{};
  const setK = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = fmtManRoundKRW(val); };
  setK('kpi2-loan', k.cumulative_loan_krw);
  setK('kpi2-repay', k.cumulative_repayment_krw);
  setK('kpi2-balance', k.balance_krw);

  const applyDelta = (id, curr, prev)=>{
    const el = document.getElementById(id);
    if(!el) return;
    const d = percentDelta(curr, prev);
    el.textContent = d.text;
    el.className = `delta-badge ${d.cls}`;
  };
  applyDelta('kpi2-loan-delta', k.cumulative_loan_krw, kPrev.cumulative_loan_krw);
  applyDelta('kpi2-repay-delta', k.cumulative_repayment_krw, kPrev.cumulative_repayment_krw);
  applyDelta('kpi2-balance-delta', k.balance_krw, kPrev.balance_krw);

  // 도넛 + 범례
  const rows = rec.kpi1_rows||[];
  const prevRows = rec.kpi1_prev||[];
  const colorMap = {
    '부동산PF':'#fa3343','부동산담보':'#ffde59','어음·매출채권담보':'#228b7d',
    '기타담보':'#2d8bba','개인신용':'#7a70ae','법인신용':'#7a4900'
  };
  const labels = rows.map(r=>r.product_type_name_kr);
  const data = rows.map(r=> Number(r.balance_krw)||0 );
  const total = data.reduce((a,b)=>a+b,0) || 1;

  const prevMap = Object.fromEntries(prevRows.map(r=>[r.product_type_name_kr, Number(r.balance_krw)||0]));

  const canvas = document.getElementById('huchuDonut');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  if(donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels,
      datasets:[{
        data,
        backgroundColor: labels.map(l=> colorMap[l] || '#94a3b8'),
        borderWidth:0,
        hoverOffset:3
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      cutout:'58%',
      plugins:{ legend:{ display:false } }
    },
    plugins:[DonutLabelPlugin]
  });

  const lg = document.getElementById('huchuLegend');
  if(lg){
    lg.innerHTML = labels.map((l, i)=>{
      const val = data[i]||0;
      const prev = prevMap[l]||0;
      const d = percentDelta(val, prev);
      return `
        <div class="huchu-legend-item" title="${l}">
          <div class="huchu-legend-left">
            <span class="huchu-legend-dot" style="background:${colorMap[l]||'#94a3b8'}"></span>
            <div class="legend-name">${l}</div>
          </div>
          <div class="huchu-legend-right">
            <span class="legend-amount">${fmtManRoundKRW(val)}</span>
            <span class="legend-delta ${d.cls}">${d.text}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

/* ===== 기준월 모달 ===== */
function initPeriodPicker(){
  const btn = document.getElementById('periodPickerBtn');
  const modal = document.getElementById('periodModal');
  const overlay = modal?.querySelector('.overlay');
  const apply = document.getElementById('monthApply');
  const cancel = document.getElementById('monthCancel');
  const input = document.getElementById('monthInput');

  const open = ()=>{ if(modal){ modal.classList.remove('hide'); document.body.classList.add('modal-open'); } };
  const close = ()=>{ if(modal){ modal.classList.add('hide'); document.body.classList.remove('modal-open'); } };

  if(btn) btn.addEventListener('click', open);
  if(overlay) overlay.addEventListener('click', close);
  if(cancel) cancel.addEventListener('click', close);
  if(apply){
    apply.addEventListener('click', ()=>{
      const ym = input && input.value ? input.value : prevMonthYYYYMM();
      Store.setPick(ym);
      renderByPeriod(ym);
      close();
    });
  }

  const map = Store.getStatsMap();
  const baseYM = prevMonthYYYYMM();
  let pick = Store.getPick() || baseYM;
  pick = latestExistingOr(pick, map);
  if(input) input.value = pick;
  Store.setPick(pick);
  renderByPeriod(pick);
}

/* ===== 공지 ===== */
function initNotices(){
  const list = (Store.getNotices()||[]).filter(n=>n.active);
  const wrap = document.getElementById('noticeCarousel');
  const dots = document.getElementById('noticeDots');

  const sorted = [...list].sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,3);
  if(wrap){
    if(sorted.length===0){
      wrap.innerHTML = `<div class="nc-slide active"><div class="nc-caption">등록된 공지가 없습니다.</div></div>`;
      if(dots) dots.innerHTML = '';
    }else{
      wrap.innerHTML = sorted.map((n,i)=>`
        <div class="nc-slide ${i===0?'active':''}">
          <a href="${n.linkUrl||'#'}" target="_blank" rel="noopener">
            <img src="${n.imageUrl}" alt="${n.title||'공지'}"/>
          </a>
          <div class="nc-caption">${n.title||''}</div>
        </div>
      `).join('');
      if(dots){
        dots.innerHTML = sorted.map((_,i)=>`<button data-idx="${i}" class="${i===0?'active':''}" aria-label="${i+1}번 공지 보기"></button>`).join('');
        dots.querySelectorAll('button').forEach(b=>{
          b.addEventListener('click', ()=>{
            const idx = Number(b.dataset.idx);
            wrap.querySelectorAll('.nc-slide').forEach((s,i)=> s.classList.toggle('active', i===idx));
            dots.querySelectorAll('button').forEach((d,i)=> d.classList.toggle('active', i===idx));
          });
        });
        let cur = 0;
        if(sorted.length>1){
          setInterval(()=>{ cur=(cur+1)%sorted.length; dots.querySelector(`button[data-idx="${cur}"]`)?.click(); }, 4000);
        }
      }
    }
  }

  const grid = document.getElementById('noticeGrid');
  if(grid){
    const all = (Store.getNotices()||[]).filter(n=>n.active).sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
    grid.innerHTML = all.length
      ? all.map(n=>`
          <a class="notice-card" href="${n.linkUrl||'#'}" target="_blank" rel="noopener">
            <img src="${n.imageUrl}" alt="${n.title||'공지'}"/>
            <div class="n-title">${n.title||''}</div>
          </a>
        `).join('')
      : `<div class="n-help">등록된 공지가 없습니다.</div>`;
  }
}

/* ===== 계산기 (기존 로직) ===== */
const LTV_LIMITS = {
  "서울":   { "아파트": 0.73,   "다세대/연립": 0.70,   "단독/다가구": 0.70,   "토지/임야": 0.70 },
  "서울 외":{ "아파트": 0.6998, "다세대/연립": 0.65,   "단독/다가구": 0.65,   "토지/임야": 0.4999 }
};
const onlyDigits = (s) => (s||"").replace(/[^0-9]/g,"");
const toNumber = (s) => Number(onlyDigits(s)) || 0;
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
function updatePreview(inputId, viewId){
  const el = document.getElementById(inputId);
  const pv = document.getElementById(viewId);
  const raw = onlyDigits(el.value);
  el.value = raw ? Number(raw).toLocaleString('ko-KR') : "";
  pv.textContent = formatKoreanCurrency(Number(raw||"0"));
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
  el.addEventListener('blur', ()=> updatePercentPreview(id, viewId));
}
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

/* 계산 결과 모달 구성 */
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

async function onCalculate(){
  const { missing, focusId } = validateRequired();
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
    calcModal.open(`
      ${inputs}
      ${kpis}
      <div class="notice error">
        <p><strong>요청하신 금액으로는 대출이 어렵습니다.</strong></p>
        <p><strong>가능 요청금액</strong>만큼 가능합니다.</p>
        <p class="disclaimer">※ 실제 온투업체 심사 결과와 다를 수 있습니다.</p>
      </div>
    `, {type:'error', text:'대출 불가'});
    await bumpDailyUsersOncePerDay(propertyType);
    return;
  }

  if (r.status === 'no-request') {
    calcModal.open(`
      ${inputs}
      <div class="notice info">
        <p><strong>요청 금액</strong>을 입력하면 가능 여부를 알려드립니다.</p>
        <p class="disclaimer">※ 실제 온투업체 심사 결과와 다를 수 있습니다.</p>
      </div>
    `, {type:'info', text:'안내'});
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
    <div class="notice success">
      <p><strong>요청하신 금액으로 대출이 가능합니다.</strong></p>
      <p>추가 가능 금액 내에서 <strong>증액</strong>도 가능합니다.</p>
      <p class="disclaimer">※ 실제 온투업체 심사 결과와 다를 수 있습니다.</p>
    </div>
    ${breakdownCosts}${breakdownInfo}`;
  calcModal.open(html, {type:'success', text:'대출 가능'});
  await bumpDailyUsersOncePerDay(propertyType);
}
function initCalculator(){
  attachCommaWithPreview('marketValue','marketValue_view');
  attachCommaWithPreview('seniorLoan','seniorLoan_view');
  attachCommaWithPreview('requestedLoan','requestedLoan_view');
  attachCommaWithPreview('deduction','deduction_view');
  attachPercentWithPreview('sharePercent','sharePercent_view');
  document.getElementById('calcBtn')?.addEventListener('click', onCalculate);
}

/* ===== 계산기: 금일 이용자수 ===== */
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

/* ===== 기타 ===== */
function initMisc(){
  const y = document.getElementById('copyrightYear');
  if(y) y.textContent = String(new Date().getFullYear());
  const mail = document.getElementById('correctionEmailLink');
  if(mail && !mail.getAttribute('href')) mail.setAttribute('href','mailto:hello@huchu.example');
}

/* ===== 시작 ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  initRouter();
  initNotices();
  initPeriodPicker();
  initCalculator();
  initDailyUsersUI();
  initMisc();
});
