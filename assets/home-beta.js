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
 * '조/억/만원/원'을 HTML(span)로 포맷
 * - 숫자: .money-number
 * - 단위: .money-unit
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

  // 1만원 미만 ~ 1원 이상: '원'
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
// ───────── 대출현황 금액 텍스트 자동 폰트 축소 ─────────
function autoFitLoanStatusText() {
  const els = document.querySelectorAll(".beta-loanstatus-item__value .loan-amount-text");

  els.forEach((el) => {
    const parent = el.parentElement;
    if (!parent) return;

    // 현재 적용된 폰트 크기를 기준으로 시작
    const computed = window.getComputedStyle(el);
    let fontSize = parseFloat(computed.fontSize) || 18;
    const minSize = 9;  // 이 이하로는 안 줄임

    el.style.whiteSpace = "nowrap";

    while (el.scrollWidth > parent.clientWidth && fontSize > minSize) {
      fontSize -= 1;
      el.style.fontSize = fontSize + "px";
    }
  });
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

/* =========================================================
   ✅ Navi stats widget (beta): /api/navi-stats
   - 메인 Hero 우측: 9개 상품군 월간 클릭 집계
========================================================= */
const NAVI_STATS_ENDPOINT = `${API_BASE}/api/navi-stats`;

const NAVI_STATS_CACHE_KEY = (monthKey) => `huchu_navi_stats_cache_v1:${monthKey}`;

function escapeHtml(input){
  const s = String(input ?? "");
  return s.replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}

function formatNumber(n){
  const v = Number(n) || 0;
  try { return v.toLocaleString("ko-KR"); } catch { return String(v); }
}

function getKstMonthKey(d = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).format(d); // YYYY-MM
  } catch {
    const tzOffsetMs = 9 * 60 * 60 * 1000;
    return new Date(Date.now() + tzOffsetMs).toISOString().slice(0, 7);
  }
}

// 'YYYY-MM' → 'YYYY년 M월'
function formatMonthLabel(monthKey) {
  const [y, m] = String(monthKey || "").split("-");
  const mm = String(Number(m || "0"));
  if (!y || !m) return "";
  return `${y}년 ${mm}월`;
}

// ✅ 메인 위젯 9개 항목(서버 집계 키 고정)
const NAVI_GROUPS = [
  { key: "re_collateral",   label: "부동산 담보대출",     iconSrc: "/assets/navi-icons/re_collateral.png" },
  { key: "personal_credit", label: "개인 신용대출",       iconSrc: "/assets/navi-icons/personal_credit.png" },
  { key: "corporate_credit",label: "법인 신용대출",       iconSrc: "/assets/navi-icons/corporate_credit.png" },
  { key: "stock",           label: "스탁론",             iconSrc: "/assets/navi-icons/stock.png" },
  { key: "medical",         label: "의료사업자대출",      iconSrc: "/assets/navi-icons/medical.png" },
  { key: "art",             label: "미술품 담보대출",     iconSrc: "/assets/navi-icons/art.png" },
  { key: "receivable",      label: "매출채권 유동화",     iconSrc: "/assets/navi-icons/receivable.png" },
  { key: "eao",             label: "전자어음",           iconSrc: "/assets/navi-icons/eao.png" },
  { key: "auction",         label: "경매배당금 담보대출",  iconSrc: "/assets/navi-icons/auction.png" },
];

async function fetchNaviStats(monthKey) {
  const mk = monthKey || getKstMonthKey();
  const url = `${NAVI_STATS_ENDPOINT}?month=${encodeURIComponent(mk)}&_t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`navi-stats ${res.status}`);
  return await res.json();
}

function renderNaviStatsWidget(payload, opts = {}) {
  const mount = document.getElementById("naviStatsMount");
  if (!mount) return;

  const animate = opts.animate !== false;
  const monthKey = payload?.monthKey || getKstMonthKey();
  const monthLabel = formatMonthLabel(monthKey);
  const data = payload?.productGroups || {};

  const tileHtml = NAVI_GROUPS.map((g) => {
    const raw = Number(data?.[g.key]) || 0;
    const count = Math.max(0, raw);

    // 아이콘은 img로 (영상 제공 이미지로 교체 가능)
    // onerror: 아이콘 로드 실패 시 자연스럽게 숨김
    return `
      <div class="navi-tile">
        <div class="navi-tile__icon" aria-hidden="true">
          <img class="navi-tile__img" src="${escapeHtml(g.iconSrc)}" alt="" loading="lazy"
               onerror="this.style.display='none';" />
        </div>
        <div class="navi-tile__label">${escapeHtml(g.label)}</div>
        <div class="navi-tile__count">
          <span class="num" data-target="${count}">${animate ? "0" : formatNumber(count)}</span>
          <span class="unit">건</span>
        </div>
      </div>
    `;
  }).join("");

  mount.innerHTML = `
    <div class="navi-stats-card" data-ready="true">
      <div class="navi-stats-head">
        <div class="navi-stats-title">
          <span class="navi-live" aria-label="라이브">
            <span class="navi-live__dot" aria-hidden="true"></span>LIVE
          </span>
          <span>후추 네비게이션 이용 현황</span>
        </div>
        <div class="navi-stats-month">${escapeHtml(monthLabel)}</div>
      </div>

      <div class="navi-stats-tiles">
        ${tileHtml}
      </div>
    </div>
  `;

  // 숫자 카운트업(원하면 유지) — 실패/캐시 렌더 시엔 animate=false로 호출
  if (!animate) return;

  try {
    const nums = mount.querySelectorAll(".navi-tile .num[data-target]");
    const dur = 520;
    nums.forEach((el) => {
      const target = Number(el.getAttribute("data-target")) || 0;
      if (!Number.isFinite(target) || target <= 0) {
        el.textContent = "0";
        return;
      }
      const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        const v = Math.floor(target * eased);
        el.textContent = formatNumber(v);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  } catch (_) {
    mount.querySelectorAll(".navi-tile .num[data-target]").forEach((el) => {
      const target = Number(el.getAttribute("data-target")) || 0;
      el.textContent = formatNumber(target);
    });
  }
}

async function initNaviStatsWidget() {
  const mount = document.getElementById("naviStatsMount");
  if (!mount) return;

  const monthKey = getKstMonthKey();

  // 1) 캐시 먼저 (화면 안정성)
  try {
    const cached = localStorage.getItem(NAVI_STATS_CACHE_KEY(monthKey));
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.monthKey || parsed.monthKey === "") && parsed.productGroups) {
        renderNaviStatsWidget(parsed, { animate: false });
      }
    }
  } catch (_) {}

  // 2) 최신 데이터 fetch
  try {
    const data = await fetchNaviStats(monthKey);
    try { localStorage.setItem(NAVI_STATS_CACHE_KEY(monthKey), JSON.stringify(data)); } catch (_) {}
    renderNaviStatsWidget(data, { animate: true });
  } catch (e) {
    // 통계 로드 실패는 UI를 막지 않음 (캐시가 없으면 0으로)
    console.warn("navi-stats widget failed:", e);
    renderNaviStatsWidget({ monthKey, productGroups: {} }, { animate: false });
  }
}


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
      // 49개 → 숫자/단위 분리
      label: "데이터 수집 온투업체수",
      value: summary.dataFirms != null
        ? (
            `<span class="money-number">${summary.dataFirms.toLocaleString("ko-KR")}</span>` +
            `<span class="money-unit">개</span>`
          )
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
          <div class="beta-loanstatus-item__value">
            <span class="loan-amount-text">${it.value}</span>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  autoFitLoanStatusText();
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
    <div class="beta-product-source-note">
      ※출처: 온라인투자연계금융업 중앙기록관리기관
    </div>
  `;

  const canvas   = document.getElementById("productDonut");
  const centerEl = document.getElementById("productDonutCenter");

  let centerChipEl  = null;
  let centerLabelEl = null;
  let centerValueEl = null;

  if (centerEl) {
    centerChipEl  = centerEl.querySelector(".beta-product-donut-center__chip");
    centerLabelEl = centerEl.querySelector(".beta-product-donut-center__label");
    centerValueEl = centerEl.querySelector(".beta-product-donut-center__value");
  }

  // 도넛 중앙 텍스트/칩 갱신
  function updateCenter(index) {
    if (!centerLabelEl || !centerValueEl) return;

    if (index == null || index < 0 || index >= labels.length) {
      index = 0;
    }

    centerLabelEl.textContent = labels[index];
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
        tooltip: { enabled: false }
      },
      layout: { padding: 4 },
      onClick: (evt, elements) => {
        if (!elements || !elements.length) {
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
  initNaviStatsWidget();

  initOntuStats();
  setupBetaMenu();

  window.addEventListener("resize", () => {
    autoFitLoanStatusText();
  });
});

// ===== 메인 히어로 배너 슬라이드 =====
const heroSlides = document.querySelectorAll(".beta-hero-banner__slide");
const heroPrev   = document.querySelector(".hero-nav--prev");
const heroNext   = document.querySelector(".hero-nav--next");

const HERO_SLIDE_INTERVAL = 5000;

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
