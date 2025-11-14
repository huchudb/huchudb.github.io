/* home.js — 공개 API로 공지/KPI 렌더 */

const API = {
  notices: '/api/public/notices/list', // ?limit=3 (캐러셀)
  kpi:     '/api/public/kpi/get',      // ?ym=YYYY-MM (없으면 최신 1건)
};

function byId(id){ return document.getElementById(id); }

function fmtComma4(n){
  return String(n).padStart(4,'0').replace(/\B(?=(\d{3})+(?!\d))/g,',');
}
function fmtManRoundKRW(won){
  const man = Math.round((Number(won)||0)/10000);
  const eok = Math.floor(man/10000);
  const manR = man%10000;
  const jo = Math.floor(eok/10000);
  const eokR = eok%10000;
  if(jo>0) return `${jo}조 ${fmtComma4(eokR)}억 ${fmtComma4(manR)}만원`;
  if(eok>0) return `${eok}억 ${fmtComma4(manR)}만원`;
  return `${man.toLocaleString('ko-KR')}만원`;
}
function percentDelta(curr, prev){
  const c = Number(curr)||0, p = Number(prev)||0;
  if(p<=0) return { text:'0.0%', cls:'flat' };
  const d = ((c-p)/p)*100;
  const fixed = (Math.round(d*10)/10).toFixed(1)+'%';
  return { text: fixed, cls: d>0?'up':(d<0?'down':'flat') };
}

function renderNoticesCarousel(items){
  const wrap = byId('noticeCarousel');
  const dots = byId('noticeDots');
  if (!wrap) return;

  const list = (items||[]).slice(0,3);
  if (list.length===0){
    wrap.innerHTML = `<div class="nc-slide active"><div class="nc-caption">등록된 공지가 없습니다.</div></div>`;
    if (dots) dots.innerHTML = '';
    return;
  }
  wrap.innerHTML = list.map((n,i)=>`
    <div class="nc-slide ${i===0?'active':''}">
      <a href="${n.link_url||'#'}" target="_blank" rel="noopener">
        <img src="${n.image_url||''}" alt="${n.title||'공지'}"/>
      </a>
      <div class="nc-caption">${n.title||''}</div>
    </div>
  `).join('');
  if (dots){
    dots.innerHTML = list.map((_,i)=>`<button data-idx="${i}" class="${i===0?'active':''}" aria-label="${i+1}번 공지 보기"></button>`).join('');
    dots.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{
        const idx = Number(b.dataset.idx);
        wrap.querySelectorAll('.nc-slide').forEach((s,i)=> s.classList.toggle('active', i===idx));
        dots.querySelectorAll('button').forEach((d,i)=> d.classList.toggle('active', i===idx));
      });
    });
    let cur = 0;
    if(list.length>1){
      setInterval(()=>{ cur=(cur+1)%list.length; dots.querySelector(`button[data-idx="${cur}"]`)?.click(); }, 4000);
    }
  }
}

function renderNoticesGrid(items){
  const grid = byId('noticeGrid');
  if (!grid) return;
  const all = items||[];
  grid.innerHTML = all.length
    ? all.map(n=>`
        <a class="notice-card" href="${n.link_url||'#'}" target="_blank" rel="noopener">
          <img src="${n.image_url||''}" alt="${n.title||'공지'}"/>
          <div class="n-title">${n.title||''}</div>
        </a>
      `).join('')
    : `<div class="n-help">등록된 공지가 없습니다.</div>`;
}

function renderKPI(rec){
  const k = rec?.kpi2 || {}, kPrev = rec?.kpi2_prev || {};
  const setK = (id, val) => { const el = byId(id); if (el) el.textContent = fmtManRoundKRW(val); };
  setK('kpi2-loan', k.cumulative_loan_krw);
  setK('kpi2-repay', k.cumulative_repayment_krw);
  setK('kpi2-balance', k.balance_krw);

  const applyDelta = (id, curr, prev)=>{
    const el = byId(id);
    if(!el) return;
    const d = percentDelta(curr, prev);
    el.textContent = d.text;
    el.className = `delta-badge ${d.cls}`;
  };
  applyDelta('kpi2-loan-delta', k.cumulative_loan_krw, kPrev.cumulative_loan_krw);
  applyDelta('kpi2-repay-delta', k.cumulative_repayment_krw, kPrev.cumulative_repayment_krw);
  applyDelta('kpi2-balance-delta', k.balance_krw, kPrev.balance_krw);

  const rows = rec?.kpi1_rows || [];
  const prevRows = rec?.kpi1_prev || [];
  const colorMap = {
    '부동산PF':'#fa3343','부동산담보':'#ffde59','어음·매출채권담보':'#228b7d',
    '기타담보':'#2d8bba','개인신용':'#7a70ae','법인신용':'#7a4900'
  };
  const labels = rows.map(r=>r.product_type_name_kr);
  const data = rows.map(r=> Number(r.balance_krw)||0 );
  const prevMap = Object.fromEntries(prevRows.map(r=>[r.product_type_name_kr, Number(r.balance_krw)||0]));

  const canvas = byId('huchuDonut');
  if (!canvas) return;
  if (window.__donutChart) { window.__donutChart.destroy(); window.__donutChart = null; }
  const ctx = canvas.getContext('2d');
  window.__donutChart = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels, datasets:[{ data, backgroundColor: labels.map(l=> colorMap[l] || '#94a3b8'), borderWidth:0, hoverOffset:3 }]
    },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'58%', plugins:{ legend:{ display:false } } }
  });

  const lg = byId('huchuLegend');
  if (lg){
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

async function loadPublicNotices(){
  // 캐러셀용(3) + 그리드용(전체)
  const j3 = await fetch(API.notices + '?limit=3').then(r=>r.json()).catch(()=>({items:[]}));
  const ja = await fetch(API.notices).then(r=>r.json()).catch(()=>({items:[]}));
  renderNoticesCarousel(j3.items||[]);
  renderNoticesGrid(ja.items||[]);
}

async function loadPublicKPI(){
  const j = await fetch(API.kpi).then(r=>r.json()).catch(()=>({item:null}));
  if (j?.item){
    const ymDisp = (j.item.ym||'').replace('-','/');
    const hpi = byId('huchuPeriodInline'); if (hpi) hpi.textContent = ymDisp || 'YYYY/MM';
    renderKPI(j.item);
  } else {
    // 데이터 없음 UI
    ['kpi2-loan','kpi2-repay','kpi2-balance'].forEach(id=>{ const el=byId(id); if(el) el.textContent='0조 0억 0만원'; });
    ['kpi2-loan-delta','kpi2-repay-delta','kpi2-balance-delta'].forEach(id=>{ const el=byId(id); if(el){ el.textContent='0.0%'; el.className='delta-badge flat'; } });
    const lg=byId('huchuLegend'); if(lg) lg.innerHTML = `<div class="huchu-legend-item"><div class="legend-name" style="opacity:.7">데이터가 없습니다.</div></div>`;
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadPublicNotices().catch(console.error);
  loadPublicKPI().catch(console.error);

  // 기준월 모달(열기/닫기만 유지. 실제 KPI는 최신값 렌더)
  const btn = byId('periodPickerBtn');
  const modal = byId('periodModal');
  const overlay = modal?.querySelector('.overlay');
  const cancel = byId('monthCancel');
  const close = ()=>{ if(modal){ modal.classList.add('hide'); document.body.classList.remove('modal-open'); } };
  const open = ()=>{ if(modal){ modal.classList.remove('hide'); document.body.classList.add('modal-open'); } };
  btn?.addEventListener('click', open);
  overlay?.addEventListener('click', close);
  cancel?.addEventListener('click', close);

  // 적용 버튼은 선택 ym 로딩을 지원 (있으면 해당 ym으로 재조회)
  const apply = byId('monthApply');
  const input = byId('monthInput');
  apply?.addEventListener('click', async ()=>{
    const ym = input?.value || '';
    const u = new URL(API.kpi, location.origin);
    if (ym) u.searchParams.set('ym', ym);
    const j = await fetch(u.pathname + u.search).then(r=>r.json()).catch(()=>({item:null}));
    if (j?.item){
      const ymDisp = (j.item.ym||'').replace('-','/');
      const hpi = byId('huchuPeriodInline'); if (hpi) hpi.textContent = ymDisp || 'YYYY/MM';
      renderKPI(j.item);
    }
    close();
  });
});
