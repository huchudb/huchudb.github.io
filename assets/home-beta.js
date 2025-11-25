// /assets/home-beta.js

// ───────── 도넛 안 % 라벨 플러그인 ─────────
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

// Chart.js v3/v4용 플러그인 등록
if (window.Chart && Chart.register) {
  Chart.register(donutInsideLabelsPlugin);
}

// ───────── 유틸 ─────────
const onlyDigits = (s) => (s || "").replace(/[^0-9]/g, "");
const toNumber   = (s) => Number(onlyDigits(s)) || 0;

// '조/억/만원' 포맷
function formatKoreanCurrencyJo(num) {
  const n = Math.max(0, Math.floor(num));

  const ONE_MAN = 10_000;
  const ONE_EOK = 100_000_000;
  const ONE_JO  = 1_000_000_000_000;

  if (n >= ONE_JO) {
    const jo           = Math.floor(n / ONE_JO);
    const restAfterJo  = n % ONE_JO;
    const eok          = Math.floor(restAfterJo / ONE_EOK);
    const restAfterEok = restAfterJo % ONE_EOK;
    const man          = Math.floor(restAfterEok / ONE_MAN);

    const parts = [];
    if (jo  > 0) parts.push(`${jo.toLocaleString("ko-KR")}조`);
    if (eok > 0) parts.push(`${eok.toLocaleString("ko-KR")}억`);
    if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만원`);
    return parts.join(" ");
  }

  if (n >= ONE_EOK) {
    const eok  = Math.floor(n / ONE_EOK);
    const rest = n % ONE_EOK;
    const man  = Math.floor(rest / ONE_MAN);
    if (man > 0) return `${eok.toLocaleString("ko-KR")}억 ${man.toLocaleString("ko-KR")}만원`;
    return `${eok.toLocaleString("ko-KR")}억 원`;
  }

  if (n >= ONE_MAN) {
    const man = Math.floor(n / ONE_MAN);
    return `${man.toLocaleString("ko-KR")}만원`;
  }

  return `${n.toLocaleString("ko-KR")}원`;
}

// 'YYYY-MM' → 'YYYY년 M월'
function formatMonthLabel(ym) {
  if (!ym || typeof ym !== "string") return "";
  const [y, m] = ym.split("-");
  if (!y || !m) return "";
  return `${y}년 ${Number(m)}월`;
}

// ───────── 기본 샘플 통계 (2025년 10월) ─────────
const DEFAULT_ONTU_STATS = {
  month: "2025-10",
  summary: {
    registeredFirms: 51,
    dataFirms: 49,
    // 18조 3,580억 776만원
    totalLoan: 18_358_007_760_000,
    // 16조 9,241억 4,401만원
    totalRepaid: 16_924_144_010_000,
    // 1조 4,338억 6,375만원
    balance: 1_433_867_500_000
  },
  byType: {
    // 퍼센트는 공시 비율 기준 (합계 ≒ 100%)
    "부동산담보": {
      ratio: 0.43,
      // 6조 1,650억 6,141만원
      amount: 6_165_061_410_000
    },
    "부동산PF": {
      ratio: 0.02,
      // 286억 7,727만원
      amount: 286_077_270_000
    },
    "어음·매출채권담보": {
      ratio: 0.09,
      // 1조 2,900억 4,773만원
      amount: 1_290_047_730_000
    },
    "기타담보(주식 등)": {
      ratio: 0.38,
      // 5조 4,480억 6,822만원
      amount: 5_448_068_220_000
    },
    "개인신용": {
      ratio: 0.06,
      // 860억 3,182만원
      amount: 860_031_820_000
    },
    "법인신용": {
      ratio: 0.03,
      // 430억 1,591만원
      amount: 430_015_910_000
    }
  }
};

// ───────── API 베이스 ─────────
const API_BASE        = "https://huchudb-github-io.vercel.app";
const ONTU_API        = `${API_BASE}/api/ontu-stats`;
const DAILY_USERS_API = `${API_BASE}/api/daily-users`;

// ───────── 온투업 통계 가져오기 ─────────
async function fetchOntuStats() {
  try {
    const res = await fetch(`${ONTU_API}?t=${Date.now()}`, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json;
  } catch (e) {
    console.error("[ontu-stats] API 실패, 기본 샘플 사용:", e);
    return { ...DEFAULT_ONTU_STATS };
  }
}

// ───────── 대출현황 렌더 ─────────
function renderLoanStatus(summary, monthStr) {
  const container = document.getElementById("ontuLoanStatus");
  const monthEl   = document.getElementById("loanStatusMonth");
  if (!container) return;

  if (!summary) {
    container.innerHTML = `
      <div class="notice error">
        <p>온투업 통계를 불러오지 못했습니다.</p>
      </div>
    `;
    if (monthEl) monthEl.textContent = "";
    return;
  }

  if (monthEl) {
    monthEl.textContent = `최근 기준월: ${formatMonthLabel(monthStr)}`;
  }

  const items = [
    {
      label: "금융위원회 등록 온투업체수",
      value: summary.registeredFirms != null
        ? `${summary.registeredFirms.toLocaleString("ko-KR")}개`
        : "-"
    },
    {
      label: "데이터 수집 온투업체수",
      value: summary.dataFirms != null
        ? `${summary.dataFirms.toLocaleString("ko-KR")}개`
        : "-"
    },
    {
      label: "누적대출금액",
      value: summary.totalLoan != null ? formatKoreanCurrencyJo(summary.totalLoan) : "-"
    },
    {
      label: "누적상환금액",
      value: summary.totalRepaid != null ? formatKoreanCurrencyJo(summary.totalRepaid) : "-"
    },
    {
      label: "대출잔액",
      value: summary.balance != null ? formatKoreanCurrencyJo(summary.balance) : "-"
    }
  ];

  container.innerHTML = `
    <div class="beta-loanstatus-grid">
      ${items
        .map(
          (it) => `
        <div class="beta-loanstatus-item">
          <div class="beta-loanstatus-item__label">${it.label}</div>
          <div class="beta-loanstatus-item__value">${it.value}</div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// ───────── 상품유형별 대출잔액 렌더 ─────────

// 도넛 & 우측 카드 공통 색상 (라벨 순서와 매칭)
const PRODUCT_COLORS = [
  "#1d4ed8", // 부동산담보
  "#f97316", // 부동산PF
  "#f43f5e", // 어음·매출채권담보
  "#facc15", // 기타담보(주식 등)
  "#22c55e", // 개인신용
  "#a855f7"  // 법인신용
];
// ───────── 상품유형별 대출잔액 렌더 ─────────
let donutChart = null;

function renderProductSection(summary, byType) {
  const section = document.getElementById("ontuProductSection");
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

  const labels   = [];
  const percents = [];
  const amounts  = [];

  for (const [name, cfg] of Object.entries(byType)) {
    const ratio  = Number(cfg.ratio ?? cfg.share ?? 0);
    const amount =
      cfg.amount != null ? Number(cfg.amount) : balance ? Math.round(balance * ratio) : 0;

    labels.push(name);
    percents.push(Math.round(ratio * 1000) / 10); // 0.425 → 42.5
    amounts.push(amount);
  }

  section.innerHTML = `
    <div class="beta-product-grid">
      <div class="beta-product-donut-wrap">
        <canvas id="productDonut"></canvas>
      </div>
      <div class="beta-product-boxes">
        ${labels
        .map((name, idx) => {
          const color = PRODUCT_COLORS[idx] || "#e5e7eb"; // 색 없으면 회색
          return `
            <div class="beta-product-box" style="--product-color:${color};">
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
          `;
        })
        .join("")}
    </div>
  </div>
`;

  const canvas = document.getElementById("productDonut");
  if (!canvas || !window.Chart) return;

  const ctx = canvas.getContext("2d");
  if (donutChart) {
    donutChart.destroy();
    donutChart = null;
  }

  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: percents,
         backgroundColor: PRODUCT_COLORS,
         borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || "";
              const val   = ctx.raw ?? 0;
              return `${label}: ${Number(val).toFixed(1)}%`;
            }
          }
        }
      },
      layout: { padding: 4 }
    }
  });
}

// ───────── 초기화 ─────────
async function initOntuStats() {
  try {
    let data = await fetchOntuStats();
    if (!data || !data.summary || !Object.keys(data.byType || {}).length) {
      data = { ...DEFAULT_ONTU_STATS };
    }
    const month   = data.month || data.monthKey || DEFAULT_ONTU_STATS.month;
    const summary = data.summary || DEFAULT_ONTU_STATS.summary;
    const byType  = data.byType || DEFAULT_ONTU_STATS.byType;

    renderLoanStatus(summary, month);
    renderProductSection(summary, byType);
  } catch (e) {
    console.error("[initOntuStats] 치명적 오류:", e);
    renderLoanStatus(DEFAULT_ONTU_STATS.summary, DEFAULT_ONTU_STATS.month);
    renderProductSection(DEFAULT_ONTU_STATS.summary, DEFAULT_ONTU_STATS.byType);
  }
}

// 금일 이용자수 (조회만)
async function initDailyUsers() {
  const el = document.getElementById("todayUsersCount");
  if (!el) return;

  try {
    const res = await fetch(`${DAILY_USERS_API}?t=${Date.now()}`, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!res.ok) throw new Error("failed");
    const json  = await res.json();
    const total = Number(json.count || 0);
    el.textContent = total.toLocaleString("ko-KR");
  } catch (e) {
    console.error(e);
    el.textContent = "-";
  }
}

// 상단 MENU 드롭다운
function setupBetaMenu() {
  const btn   = document.getElementById("betaMenuToggle");
  const panel = document.getElementById("betaMenuPanel");
  if (!btn || !panel) return;

  const close = () => {
    panel.classList.add("hide");
    btn.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    panel.classList.remove("hide");
    btn.setAttribute("aria-expanded", "true");
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const expanded = btn.getAttribute("aria-expanded") === "true";
    if (expanded) close();
    else open();
  });

  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      close();
    }
  });
}

// DOM 로드 후 실행
document.addEventListener("DOMContentLoaded", () => {
  initOntuStats();
  initDailyUsers();
  setupBetaMenu();
});

// ===== 메인 히어로 배너 슬라이드 =====
const heroSlides = document.querySelectorAll('.beta-hero-banner__slide');
const heroPrev = document.querySelector('.hero-nav--prev');
const heroNext = document.querySelector('.hero-nav--next');

// ★ 자동 넘김 시간(ms) – 여기 숫자만 바꾸면 됨
const HERO_SLIDE_INTERVAL = 5000; // 5000ms = 5초

let heroIndex = 0;
let heroTimer = null;

function showHeroSlide(index) {
  heroSlides.forEach((slide, i) => {
    slide.classList.toggle('is-active', i === index);
  });
  heroIndex = index;
}

function showNextHero() {
  const next = (heroIndex + 1) % heroSlides.length;
  showHeroSlide(next);
}

function showPrevHero() {
  const prev = (heroIndex - 1 + heroSlides.length) % heroSlides.length;
  showHeroSlide(prev);
}

function startHeroAutoSlide() {
  if (heroTimer) clearInterval(heroTimer);
  heroTimer = setInterval(showNextHero, HERO_SLIDE_INTERVAL);
}

if (heroSlides.length > 0) {
  showHeroSlide(0);
  startHeroAutoSlide();

  if (heroPrev) {
    heroPrev.addEventListener('click', () => {
      showPrevHero();
      startHeroAutoSlide(); // 클릭 후에도 자동 넘김 계속
    });
  }

  if (heroNext) {
    heroNext.addEventListener('click', () => {
      showNextHero();
      startHeroAutoSlide();
    });
  }
}
