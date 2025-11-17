// /assets/home-beta.js

// 숫자만 추출
const onlyDigits = (s) => (s || "").replace(/[^0-9]/g, "");
const toNumber = (s) => Number(onlyDigits(s)) || 0;

// '조/억/만원' 포맷
function formatKoreanCurrencyJo(num) {
  const n = Math.max(0, Math.floor(num));

  const ONE_MAN = 10_000;
  const ONE_EOK = 100_000_000;
  const ONE_JO  = 1_000_000_000_000;

  if (n >= ONE_JO) {
    const jo = Math.floor(n / ONE_JO);
    const restAfterJo = n % ONE_JO;
    const eok = Math.floor(restAfterJo / ONE_EOK);
    const restAfterEok = restAfterJo % ONE_EOK;
    const man = Math.floor(restAfterEok / ONE_MAN);

    const parts = [];
    if (jo > 0)  parts.push(`${jo.toLocaleString('ko-KR')}조`);
    if (eok > 0) parts.push(`${eok.toLocaleString('ko-KR')}억`);
    if (man > 0) parts.push(`${man.toLocaleString('ko-KR')}만원`);
    return parts.join(' ');
  }

  if (n >= ONE_EOK) {
    const eok = Math.floor(n / ONE_EOK);
    const rest = n % ONE_EOK;
    const man  = Math.floor(rest / ONE_MAN);
    if (man > 0) return `${eok.toLocaleString('ko-KR')}억 ${man.toLocaleString('ko-KR')}만원`;
    return `${eok.toLocaleString('ko-KR')}억 원`;
  }

  if (n >= ONE_MAN) {
    const man = Math.floor(n / ONE_MAN);
    return `${man.toLocaleString('ko-KR')}만원`;
  }

  return `${n.toLocaleString('ko-KR')}원`;
}

// 'YYYY-MM' → 'YYYY년 M월'
function formatMonthLabel(ym) {
  if (!ym || typeof ym !== 'string') return '';
  const [y, m] = ym.split('-');
  if (!y || !m) return '';
  return `${y}년 ${Number(m)}월`;
}

// API 베이스
const API_BASE       = 'https://huchudb-github-io.vercel.app';
const ONTU_API       = `${API_BASE}/api/ontu-stats`;
const DAILY_USERS_API = `${API_BASE}/api/daily-users`;

// ====================== 온투업 통계 ======================

async function fetchOntuStats() {
  const res = await fetch(`${ONTU_API}?t=${Date.now()}`, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('온투업 통계를 불러오지 못했습니다.');
  const json = await res.json();
  return json;
}

function renderLoanStatus(summary, monthStr) {
  const container = document.getElementById('ontuLoanStatus');
  const monthEl   = document.getElementById('loanStatusMonth');
  if (!container) return;

  if (!summary) {
    container.innerHTML = `
      <div class="notice error">
        <p>온투업 통계를 불러오지 못했습니다.</p>
      </div>
    `;
    if (monthEl) monthEl.textContent = '';
    return;
  }

  if (monthEl) {
    monthEl.textContent = `최근 기준월: ${formatMonthLabel(monthStr)}`;
  }

  const items = [
    {
      label: '금융위원회 등록 온투업체수',
      value: summary.registeredFirms != null ? `${summary.registeredFirms.toLocaleString('ko-KR')}개` : '-'
    },
    {
      label: '데이터 수집 온투업체수',
      value: summary.dataFirms != null ? `${summary.dataFirms.toLocaleString('ko-KR')}개` : '-'
    },
    {
      label: '누적대출금액',
      value: summary.totalLoan != null ? formatKoreanCurrencyJo(summary.totalLoan) : '-'
    },
    {
      label: '누적상환금액',
      value: summary.totalRepaid != null ? formatKoreanCurrencyJo(summary.totalRepaid) : '-'
    },
    {
      label: '대출잔액',
      value: summary.balance != null ? formatKoreanCurrencyJo(summary.balance) : '-'
    },
  ];

  container.innerHTML = `
    <div class="beta-loanstatus-grid">
      ${items.map(it => `
        <div class="beta-loanstatus-item">
          <div class="beta-loanstatus-item__label">${it.label}</div>
          <div class="beta-loanstatus-item__value">${it.value}</div>
        </div>
      `).join('')}
    </div>
  `;
}

let donutChart = null;

function renderProductSection(summary, byType) {
  const section = document.getElementById('ontuProductSection');
  if (!section) return;

  if (!summary || !byType || !Object.keys(byType).length) {
    section.innerHTML = `
      <div class="notice error">
        <p>상품유형별 대출잔액 정보를 불러오지 못했습니다.</p>
      </div>
    `;
    return;
  }

  const balance = Number(summary.balance || 0);

  const labels = [];
  const percents = [];
  const amounts = [];

  for (const [name, cfg] of Object.entries(byType)) {
    const ratio = Number(cfg.ratio ?? cfg.share ?? 0);         // 0.43 이런 값
    const amount = cfg.amount != null
      ? Number(cfg.amount)
      : (balance ? Math.round(balance * ratio) : 0);

    labels.push(name);
    percents.push(Math.round(ratio * 1000) / 10);              // 0.425 → 42.5
    amounts.push(amount);
  }

  section.innerHTML = `
    <div class="beta-product-grid">
      <div class="beta-product-donut-wrap">
        <canvas id="productDonut"></canvas>
      </div>
      <div class="beta-product-boxes">
        ${labels.map((name, idx) => `
          <div class="beta-product-box">
            <div class="beta-product-box__title">
              ${name} <span style="color:#6b7280;font-weight:500;">${percents[idx].toFixed(1)}%</span>
            </div>
            <div class="beta-product-box__amount">
              ${formatKoreanCurrencyJo(amounts[idx])}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const canvas = document.getElementById('productDonut');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (donutChart) {
    donutChart.destroy();
    donutChart = null;
  }

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: percents,
        backgroundColor: [
          '#1d4ed8', '#f97316', '#f43f5e',
          '#facc15', '#22c55e', '#a855f7'
        ],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || '';
              const val   = ctx.raw ?? 0;
              return `${label}: ${val.toFixed(1)}%`;
            }
          }
        }
      }
    }
  });
}

async function initOntuStats() {
  try {
    const data = await fetchOntuStats();
    const month   = data.month || data.monthKey || '';
    const summary = data.summary || null;
    const byType  = data.byType  || {};

    renderLoanStatus(summary, month);
    renderProductSection(summary, byType);
  } catch (e) {
    console.error(e);
    const container = document.getElementById('ontuLoanStatus');
    const product   = document.getElementById('ontuProductSection');
    if (container) {
      container.innerHTML = `
        <div class="notice error">
          <p>온투업 통계를 불러오지 못했습니다.</p>
        </div>
      `;
    }
    if (product) {
      product.innerHTML = `
        <div class="notice error">
          <p>상품유형별 대출잔액 정보를 불러오지 못했습니다.</p>
        </div>
      `;
    }
  }
}

// ====================== 금일 이용자수 (조회만) ======================

async function initDailyUsers() {
  const el = document.getElementById('todayUsersCount');
  if (!el) return;

  try {
    const res = await fetch(`${DAILY_USERS_API}?t=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('failed');
    const json = await res.json();
    const total = Number(json.count || 0);
    el.textContent = total.toLocaleString('ko-KR');
  } catch (e) {
    console.error(e);
    el.textContent = '-';
  }
}

// ====================== 상단 MENU 드롭다운 ======================

function setupBetaMenu() {
  const btn   = document.getElementById('betaMenuToggle');
  const panel = document.getElementById('betaMenuPanel');
  if (!btn || !panel) return;

  const close = () => {
    panel.classList.add('hide');
    btn.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    panel.classList.remove('hide');
    btn.setAttribute('aria-expanded', 'true');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    if (expanded) close();
    else open();
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      close();
    }
  });
}

// ====================== 기타 초기화 ======================

document.addEventListener('DOMContentLoaded', () => {
  initOntuStats();
  initDailyUsers();
  setupBetaMenu();

  const y = document.getElementById('copyrightYear');
  if (y) y.textContent = String(new Date().getFullYear());
});
