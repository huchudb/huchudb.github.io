import { Store, fmtManRoundKRW, percentDelta, prevMonthYYYYMM, latestExistingOr, ymToDisplay } from './shared.js';

/* 도넛 레이블 플러그인 */
const DonutLabelPlugin = {
  id: 'donutCenterLabels',
  afterDatasetDraw(chart, args){
    if(args.index !== 0) return;
    const meta = args.meta;
    const data = meta.data;
    const total = chart.config.data.datasets[0].data.reduce((a,b)=>a+b,0);
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

/* ===== 메인 섹션(공지 그리드/FAQ/근거) 표시 제어 =====
   요구사항: 기본 비노출. 상단 메뉴 클릭으로 #faq / #methodology 해시가 있을 때만 보이기.
   '공지사항' 메뉴는 #notices(상단 캐러셀)로 가므로, 하단 '공지 그리드' 섹션은 기본 숨김 유지. */
function updateSectionVisibilityByHash(){
  const hash = (location.hash || '').replace('#','');

  // 하단 공지 그리드 섹션 (기본 숨김)
  const noticeGridSection = document.querySelector('section.notices .notice-grid')?.closest('section');
  if (noticeGridSection) {
    // 현재는 메뉴가 #notices(캐러셀)로만 이동하므로 항상 숨김 처리
    noticeGridSection.hidden = true;
  }

  // FAQ / Methodology 섹션
  const faq = document.getElementById('faq')?.closest('section');
  const meth = document.getElementById('methodology')?.closest('section');

  if (faq) faq.hidden = hash !== 'faq';
  if (meth) meth.hidden = hash !== 'methodology';

  // 해당 섹션으로 스크롤
  if (hash === 'faq' && faq) {
    faq.scrollIntoView({behavior:'smooth', block:'start'});
  } else if (hash === 'methodology' && meth) {
    meth.scrollIntoView({behavior:'smooth', block:'start'});
  }
}

/* ===== 렌더 ===== */
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

  // KPI
  const k = rec.kpi2||{}, kPrev = rec.kpi2_prev||{};
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
  const prevMap = Object.fromEntries(prevRows.map(r=>[r.product_type_name_kr, Number(r.balance_krw)||0]));

  const canvas = document.getElementById('huchuDonut');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  if(donutChart) donutChart.destroy();
  // eslint-disable-next-line no-undef
  donutChart = new Chart(ctx, {
    type:'doughnut',
    data:{ labels, datasets:[{ data, backgroundColor: labels.map(l=> colorMap[l] || '#94a3b8'), borderWidth:0, hoverOffset:3 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'58%', plugins:{ legend:{ display:false } } },
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

/* ===== 공지 캐러셀/그리드 ===== */
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

/* ===== 시작 ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  initPeriodPicker();
  initNotices();

  // 섹션 숨김/표시 제어
  updateSectionVisibilityByHash();
  window.addEventListener('hashchange', updateSectionVisibilityByHash);
});
