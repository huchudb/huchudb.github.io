// /assets/home-beta.js

// 도넛 안 % 라벨 플러그인
const donutInsideLabelsPlugin = {
  id: "donutInsideLabels",
  afterDraw(chart) {
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data) return;

    const { ctx } = chart;
    const data = chart.data;

    ctx.save();
    ctx.font = "bold 11px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    meta.data.forEach((elem, idx) => {
      const raw = data.datasets[0].data[idx];
      if (!raw || raw <= 0) return;
      const pos = elem.tooltipPosition();
      const text = `${Number(raw).toFixed(1)}%`;
      ctx.fillText(text, pos.x, pos.y);
    });

    ctx.restore();
  }
};

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

// ====================== 기본 샘플 통계 (2025년 10월) ======================

const DEFAULT_ONTU_STATS = {
  month: '2025-10',
  summary: {
    registeredFirms: 51,  // 금융위 등록 온투업체 수
    dataFirms: 49,        // 데이터 수집 온투업체 수 (예: 49개)
    // 18조 3,580억 776만원
    totalLoan: 18_000_000_000_000 + 3_580_000_000_000 + 7_760_0000,
    // 16조 9,241억 4,401만원
    totalRepaid: 16_000_000_000_000 + 9_241_000_000_000 + 4_401_0000,
    // 1조 4,338억 6,375만원
    balance: 1_000_000_000_000 + 4_338_000_000_000 + 6_375_0000,
  },
  byType: {
    // 퍼센트는 공시 비율 기준 (합계 약 100%)
    '부동산담보': {
      ratio: 0.43,
      // 6,165억 6,141만원
      amount: 6_165_000_000_000 + 6_141_0000,
    },
    '부동산PF': {
      ratio: 0.02,
      // 286억 7,727만원
      amount: 286_000_000_000 + 7_727_0000,
    },
    '어음·매출채권담보': {
      ratio: 0.09,
      // 1,290억 4,773만원
      amount: 1_290_000_000_000 + 4_773_0000,
    },
    '기타담보(주식 등)': {
      ratio: 0.38,
      // 5,448억 6,822만원
      amount: 5_448_000_000_000 + 6_822_0000,
    },
    '개인신용': {
      ratio: 0.06,
      // 860억 3,182만원
      amount: 860_000_000_000 + 3_182_0000,
    },
    '법인신용': {
      ratio: 0.03,
      // 430억 1,591만원
      amount: 430_000_000_000 + 1_591_0000,
    },
  }
};

// API 베이스
const API_BASE         = 'https://huchudb-github-io.vercel.app';
const ONTU_API         = `${API_BASE}/api/ontu-stats`;
const DAILY_USERS_API  = `${API_BASE}/api/daily-users`;

// ====================== 온투업 통계 ======================

async function fetchOntuStats() {
  try {
    const res = await fetch(`${ONTU_API}?t=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json;
  } catch (e) {
    console.error('[ontu-stats] API 실패, 기본 샘플 사용:', e);
    // 실패 시 샘플 반환
    return { ...DEFAULT_ONTU_STATS };
  }
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

  const labels  = [];
  const percents= [];
  const amounts = [];

  for (const [name, cfg] of Object.entries(byType)) {
    const ratio = Number(cfg.ratio ?? cfg.share ?? 0);   // 0.43 등
    const amount = cfg.amount != null
      ? Number(cfg.amount)
      : (balance ? Math.round(balance * ratio) : 0);

    labels.push(name);
    percents.push(Math.round(ratio * 1000) / 10);        // 42.5 등
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
              ${name}
              <span style="color:#6b7280;font-weight:500;">
                ${percents[idx].toFixed(1)}%
              </span>
            </div>
            <div class="beta-product-box__amount">
              ${formatKoreanCurrencyJo(amounts[idx])}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const canvas = document.getElementById("productDonut");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (donutChart) {
    donutChart.destroy();
    donutChart = null;
  }

  // Chart.js 2/3/4 어디서든 동작하도록 처리
  let extraPlugins = [];
  if (window.Chart && Chart.register) {
    // v3 / v4
    extraPlugins = [donutInsideLabelsPlugin];
  } else if (window.Chart && Chart.pluginService) {
    // v2
    Chart.pluginService.register(donutInsideLabelsPlugin);
    extraPlugins = []; // 전역 등록이라 개별 플러그인 배열은 비워둠
  }

  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: percents,  // 43.0, 2.0 이런 값
        backgroundColor: [
          "#1d4ed8",
          "#f97316",
          "#f43f5e",
          "#facc15",
          "#22c55e",
          "#a855f7"
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: { display:false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || "";
              const val = ctx.raw ?? 0;
              return `${label}: ${Number(val).toFixed(1)}%`;
            }
          }
        }
      },
      layout: { padding: 4 }
    },
    plugins: extraPlugins
  });


async function initOntuStats() {
  try {
    let data = await fetchOntuStats();

    // 형식이 비어있거나 summary/byType가 없으면 샘플로 대체
    if (!data || !data.summary || !Object.keys(data.byType || {}).length) {
      data = { ...DEFAULT_ONTU_STATS };
    }

    const month   = data.month || data.monthKey || DEFAULT_ONTU_STATS.month;
    const summary = data.summary || DEFAULT_ONTU_STATS.summary;
    const byType  = data.byType  || DEFAULT_ONTU_STATS.byType;

    renderLoanStatus(summary, month);
    renderProductSection(summary, byType);
  } catch (e) {
    console.error('[initOntuStats] 치명적 오류:', e);
    // 그래도 샘플로 그려줌
    renderLoanStatus(DEFAULT_ONTU_STATS.summary, DEFAULT_ONTU_STATS.month);
    renderProductSection(DEFAULT_ONTU_STATS.summary, DEFAULT_ONTU_STATS.byType);
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
