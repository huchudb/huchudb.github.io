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

/**
 * '조/억/만원' + HTML(span) 포맷
 * - 숫자는 .money-number
 * - 단위(조·억·만원·원)는 .money-unit
 */
function formatKoreanCurrencyJo(num) {
  const n = Math.max(0, Math.floor(num));

  const ONE_MAN = 10_000;
  const ONE_EOK = 100_000_000;
  const ONE_JO  = 1_000_000_000_000;

  const parts = [];

  const pushPart = (value, unit) => {
    if (!value) return;
    parts.push(
      `<span class="money-number">${value.toLocaleString("ko-KR")}</span>` +
      `<span class="money-unit">${unit}</span>`
    );
  };

  // 1만원 이상: 조/억/만원 분해
  if (n >= ONE_MAN) {
    let remain = n;

    const jo  = Math.floor(remain / ONE_JO);
    remain   %= ONE_JO;

    const eok = Math.floor(remain / ONE_EOK);
    remain   %= ONE_EOK;

    const man = Math.floor(remain / ONE_MAN);

    pushPart(jo,  "조");
    pushPart(eok, "억");
    pushPart(man, "만원");

    return parts.join(" ");
  }

  // 1만원 미만 ~ 1원 이상: '원' 단위
  if (n > 0) {
    return (
      `<span class="money-number">${n.toLocaleString("ko-KR")}</span>` +
      `<span class="money-unit">원</span>`
    );
  }

  // 0 처리
  return (
    `<span class="money-number">0</span>` +
    `<span class="money-unit">원</span>`
  );
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
const API_BASE  = "https://huchudb-github-io.vercel.app";
const ONTU_API  = `${API_BASE}/api/ontu-stats`;

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
    if (!json || json.ok === false || !json.summary || !json.byType) {
      throw new Error("invalid ontu-stats payload");
    }

    // 메인에서 필요한 형태로만 리턴
    return {
      month:   json.month,
      summary: json.summary,
      byType:  json.byType
    };
  } catch (e) {
    console.error("[ontu-stats] API 실패, 기본 샘플 사용:", e);
    return { ...DEFAULT_ONTU_STATS };
  }
}

// ───────── 대출현황 렌더 ─────────
function renderLoanStatus(summary, monthStr) {
  const container = document.getElementById("ontuLoanStatus");
  const monthEl   = document.getElementById("dashboardMonth");
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
    monthEl.textContent = formatMonthLabel(monthStr);
  }

  const items = [
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

  // 메인 카드 + 도넛 + 유형별 금액 카드
  section.innerHTML = `
    <div class="beta-product-card">
      <div class="beta-product-card__header">
        <span class="beta-product-card__title">상품유형별 대출잔액</span>
      </div>
      <div class="beta-product-grid">
        <div class="beta-product-donut-wrap">
          <div class="beta-product-donut-inner">
            <canvas id="productDonut" aria-label="상품유형별 대출잔액 도넛 차트"></canvas>
            <div class="beta-product-donut-center" id="productDonutCenter">
              <div class="beta-product-donut-center__label-row">
                <span class="beta-product-donut-center__chip"></span>
                <span class="beta-product-donut-center__label"></span>
              </div>
              <div class="beta-product-donut-center__value"></div>
            </div>
          </div>
        </div>
        <div class="beta-product-boxes">
          ${labels
            .map((name, idx) => {
              const color = PRODUCT_COLORS[idx] || "#e5e7eb";
              return `
                <div class="beta-product-box" style="--product-color:${color};">
                  <div class="beta-product-box__title">${name}</div>
                  <div class="beta-product-box__amount">${formatKoreanCurrencyJo(
                    amounts[idx]
                  )}</div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    </div>
  `;

  const canvas   = document.getElementById("productDonut");
  const centerEl = document.getElementById("productDonutCenter");

  let centerRowEl   = null;
  let centerChipEl  = null;
  let centerLabelEl = null;
  let centerValueEl = null;

  if (centerEl) {
    centerRowEl   = centerEl.querySelector(".beta-product-donut-center__label-row");
    centerChipEl  = centerEl.querySelector(".beta-product-donut-center__chip");
    centerLabelEl = centerEl.querySelector(".beta-product-donut-center__label");
    centerValueEl = centerEl.querySelector(".beta-product-donut-center__value");
  }

  // 도넛 중앙 텍스트/칩 갱신
  function updateCenter(index) {
    if (!centerLabelEl || !centerValueEl) return;

    // 유효한 index가 없으면 항상 0번(부동산담보)로 fallback
    if (index == null || index < 0 || index >= labels.length) {
      index = 0;
    }

    centerLabelEl.textContent = labels[index];
    // 🔹 HTML(span) 그대로 넣어주기
    centerValueEl.innerHTML   = formatKoreanCurrencyJo(amounts[index]);

    if (centerChipEl) {
      const color = PRODUCT_COLORS[index] || "#e5e7eb";
      centerChipEl.style.visibility = "visible";
      centerChipEl.style.backgroundColor = color;
    }
  }

  // 기본 상태: 0번(부동산담보) 정보 표시
  updateCenter(0);

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
        // 검은 툴팁(hover/click 박스) 전면 비활성화
        tooltip: {
          enabled: false
        }
      },
      layout: { padding: 4 },
      onClick: (evt, elements) => {
        if (!elements || !elements.length) {
          // 빈 영역 클릭: 다시 0번(부동산담보)
          updateCenter(0);
          return;
        }
        const idx = elements[0].index;
        updateCenter(idx);
      },
      onHover: (evt, elements) => {
        const target = evt?.native?.target || evt?.target;
        if (target && target.style) {
          target.style.cursor = elements && elements.length ? "pointer" : "default";
        }
      }
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
    renderProductSection({ ...summary, month }, byType);
  } catch (e) {
    console.error("[initOntuStats] 치명적 오류:", e);
    renderLoanStatus(DEFAULT_ONTU_STATS.summary, DEFAULT_ONTU_STATS.month);
    renderProductSection(
      { ...DEFAULT_ONTU_STATS.summary, month: DEFAULT_ONTU_STATS.month },
      DEFAULT_ONTU_STATS.byType
    );
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
  setupBetaMenu();
});

// ===== 메인 히어로 배너 슬라이드 =====
const heroSlides = document.querySelectorAll(".beta-hero-banner__slide");
const heroPrev   = document.querySelector(".hero-nav--prev");
const heroNext   = document.querySelector(".hero-nav--next");

// 자동 넘김 시간(ms)
const HERO_SLIDE_INTERVAL = 5000; // 5000ms = 5초

let heroIndex = 0;
let heroTimer = null;

function showHeroSlide(index) {
  heroSlides.forEach((slide, i) => {
    slide.classList.toggle("is-active", i === index);
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
    heroPrev.addEventListener("click", () => {
      showPrevHero();
      startHeroAutoSlide();
    });
  }

  if (heroNext) {
    heroNext.addEventListener("click", () => {
      showNextHero();
      startHeroAutoSlide();
    });
  }
}
