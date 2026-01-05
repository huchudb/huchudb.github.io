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
const API_BASE = (function resolveApiBase(){
  try{
    const w = (typeof window !== "undefined") ? window : null;
    let base = (w && w.API_BASE) ? String(w.API_BASE) : "";

    if (!base) {
      const host = (typeof location !== "undefined" && location.hostname) ? location.hostname : "";
      const isLocal =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".local");

      // ✅ 기본: 커스텀 도메인(운영)에서는 동일 오리진(/api/...) 우선
      // 필요 시 window.API_BASE 로 언제든 override 가능
      base = isLocal ? "" : "";
    }

    return base.replace(/\/+$/, "");
  } catch {
    return "";
  }
})();

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
function debounce(fn, wait = 120) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// ✅ HERO 배너 높이 = 네비 이용현황 카드 높이 (배너가 카드에 의해 커지는 현상 방지)
function syncNaviStatsHeight() {
  const banner = document.querySelector(".beta-hero-banner");
  const card = document.querySelector(".navi-stats-card");
  if (!banner || !card) return;

  // 모바일(세로 스택)에서는 높이 강제하지 않음
  const stacked = window.matchMedia && window.matchMedia("(max-width: 980px)").matches;
  if (stacked) {
    card.style.height = "";
    return;
  }

  const h = Math.round(banner.getBoundingClientRect().height);
  if (!h) return;

  const prev = parseInt(String(card.style.height || "").replace("px", ""), 10) || 0;
  if (Math.abs(prev - h) <= 2) return; // 미세 차이는 무시(깜빡임 방지)

  card.style.height = `${h}px`;
}
const syncNaviStatsHeightDebounced = debounce(syncNaviStatsHeight, 120);

function hookHeroBannerHeightSync() {
  // 중복 바인딩 방지
  if (window.__naviHeroSyncBound) {
    syncNaviStatsHeightDebounced();
    return;
  }
  window.__naviHeroSyncBound = true;

  const banner = document.querySelector(".beta-hero-banner");
  if (!banner) return;

  const sync = () => syncNaviStatsHeightDebounced();

  // 초기 1회(레이아웃 안정화 후)
  requestAnimationFrame(sync);

  // 이미지 로딩 후 1회
  [...banner.querySelectorAll("img")].forEach((img) => {
    if (!img.complete) img.addEventListener("load", sync, { once: true });
  });

  // 리사이즈(디바운스)
  window.addEventListener("resize", sync);

  // 페이지 로드 완료 후 1회
  window.addEventListener("load", sync, { once: true });
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
  const monthKey = (payload && payload.monthKey) ? String(payload.monthKey) : getKstMonthKey();
  const counts = (payload && payload.productGroups) ? payload.productGroups : {};

  const tilesHtml = NAVI_GROUPS.map((g, i) => {
    const v = Number(counts[g.key] || 0) || 0;
    const initial = animate ? 0 : v;

    return `
      <div class="navi-tile" data-key="${escapeHtml(g.key)}" style="--delay:${i * 45}ms">
        <div class="navi-tile__icon" aria-hidden="true">
          ${g.iconSrc ? `<img class="navi-tile__img" src="${escapeHtml(g.iconSrc)}" alt="" loading="lazy" decoding="async" />` : ""}
        </div>
        <div class="navi-tile__count" aria-label="${escapeHtml(g.label)} ${v}건">
          <span class="num" data-target="${v}">${initial}</span><span class="unit">건</span>
        </div>
        <div class="navi-tile__label">${escapeHtml(g.label)}</div>
      </div>
    `;
  }).join("");

  mount.innerHTML = `
    <section class="navi-stats-card${animate ? " is-anim" : ""}" aria-label="후추 네비게이션 이용 현황">
      <header class="navi-stats-head">
        <div class="navi-stats-title">
          <span class="navi-live"><span class="navi-live__dot" aria-hidden="true"></span>LIVE</span>
          <span>후추 네비게이션 이용 현황</span>
        </div>
        <div class="navi-stats-month">${escapeHtml(formatMonthLabel(monthKey))}</div>
      </header>
      <div class="navi-stats-tiles">${tilesHtml}</div>
    </section>
  `;

  // ✅ 숫자 카운트업(레이아웃 영향 없음)
  if (animate) {
    const prefersReduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const animateCountUp = (el, target, duration = 900) => {
      if (!el) return;
      const from = Number(String(el.textContent || "0").replace(/[^\d.-]/g, "")) || 0;
      const to = Number(target) || 0;

      if (prefersReduced || duration <= 0 || from === to) {
        el.textContent = String(to);
        return;
      }

      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const v = Math.round(from + (to - from) * easeOutCubic(p));
        el.textContent = String(v);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    // 타일 입장 애니메이션은 CSS로 처리, 여기서는 숫자만 업데이트
    mount.querySelectorAll(".navi-tile__count .num").forEach((el) => {
      const target = Number(el.getAttribute("data-target") || "0") || 0;
      animateCountUp(el, target, 900);
    });

    // 애니메이션 클래스는 1회만(재렌더 시에도 깜빡임 최소화)
    setTimeout(() => {
      const card = mount.querySelector(".navi-stats-card");
      if (card) card.classList.remove("is-anim");
    }, 900);
  }

  // ✅ 배너와 높이 동기화(안정 버전)
  hookHeroBannerHeightSync();
  syncNaviStatsHeightDebounced();
}

async function initNaviStatsWidget() {
  const mount = document.getElementById("naviStatsMount");
  if (!mount) return;

  const monthKey = getKstMonthKey();

  // 1) 캐시(또는 0값)로 즉시 렌더 + 애니메이션(숫자/타일은 레이아웃 영향 없음)
  let cached = null;
  try {
    cached = JSON.parse(localStorage.getItem(NAVI_STATS_CACHE_KEY(monthKey)) || "null");
  } catch {
    cached = null;
  }

  const seed = (cached && typeof cached === "object")
    ? { ...cached, monthKey }
    : { monthKey, productGroups: {} };

  // requestAnimationFrame으로 첫 레이아웃 확정 후 렌더
  requestAnimationFrame(() => renderNaviStatsWidget(seed, { animate: true }));

  // 2) (선택) 서버/동일오리진 API가 준비되면 아래 주석 해제해서 최신값 갱신 가능
  // try {
  //   const fresh = await fetchNaviStats(monthKey);
  //   if (fresh && fresh.productGroups) {
  //     localStorage.setItem(NAVI_STATS_CACHE_KEY(monthKey), JSON.stringify(fresh));
  //     renderNaviStatsWidget(fresh, { animate: false }); // 2번 애니메이션 방지
  //   }
  // } catch (e) {
  //   // 무시: 캐시만으로도 동작
  // }
}


const ONTU_API  = `${API_BASE}/api/ontu-stats`;

// ───────── 온투업 통계 가져오기 ─────────
async function fetchOntuStats() {
  try {
    const res = await fetch(`${API_BASE}/api/ontu-stats?t=${Date.now()}`, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();

    // ✅ 서버 응답 형태가 바뀌어도(예: byMonth 루트, products.byType 등) 최신 월을 자동으로 잡아서 렌더링
    const isMonthKey = (k) => /^\d{4}-\d{2}$/.test(String(k || ""));
    let month = String(json?.month || "").trim();
    let summary = json?.summary || null;
    let byType = json?.byType || json?.products?.byType || null;

    // Case A) { byMonth: { "2025-11": { summary, byType }, ... } }
    if (json && json.byMonth && typeof json.byMonth === "object") {
      const keys = Object.keys(json.byMonth).filter(isMonthKey).sort();
      const latest = keys.length ? keys[keys.length - 1] : "";
      const node = latest ? (json.byMonth[latest] || {}) : {};

      month = latest || month;
      summary = node.summary || node?.products?.summary || summary;
      byType = node.byType || node?.products?.byType || byType;
    }

    // Case B) { months:[...], latestMonth:"2025-11", data:{...} } 등: 가능한 필드 최대한 흡수
    month = month || String(json?.latestMonth || json?.latest || "").trim();

    if (!summary || !byType) {
      throw new Error("Invalid payload: missing summary/byType");
    }
    if (!month) {
      // 최소한 화면 표시용 월 라벨을 만들기 위해 summary 안의 month 같은 필드도 체크
      month = String(summary?.month || "").trim() || "unknown";
    }
    return { month, summary, byType };
  } catch (err) {
    console.warn("ontu-stats fetch failed:", err);
    return {
      month: DEFAULT_ONTU_MONTH,
      summary: DEFAULT_ONTU_STATS.summary,
      byType: DEFAULT_ONTU_STATS.byType,
    };
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
    // 오차범위(±%) 계산
  const byTypeSum = amounts.reduce((acc, v) => acc + (Number(v) || 0), 0);
  const diff = byTypeSum - balance;
  const halfDiff = Math.abs(diff) / 2;
  const mid = (balance + byTypeSum) / 2;
  const errPct = mid ? (halfDiff / mid) * 100 : 0;
  errPctStr = errPct.toFixed(8);

  section.innerHTML = `
      <div class="notice error">
        <p>상품유형별 대출잔액 정보를 불러오지 못했습니다.</p>
      </div>
    `;
    return;
  }

  const balance = Number(summary.balance || 0);

  // ✅ 오차범위 계산 (A=요약 대출잔액, B=상품유형별 합계)
  // 편차 = (B - A)
  // 오차범위(±원) = |편차| / 2
  // 중앙값 = (A + B) / 2
  // 오차범위(±%) = (오차범위(±원) / 중앙값) * 100
  let errPctStr = "0.00000000";

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
    <div class="beta-product-footnote">
      <div class="beta-product-footnote__source">※출처: 온라인투자연계금융업 중앙기록관리기관</div>
      <div class="beta-product-footnote__errline">
        <span class="beta-product-footnote__err">※오차범위 : ±${errPctStr}%</span>
        <span class="beta-help">
          <button type="button" class="beta-help__btn" aria-label="오차범위 안내" aria-expanded="false">?</button>
          <div class="beta-help__popover" role="tooltip">
            표시된 오차범위는 온투업중앙기록관리기관에서 제공되는 정보 대출현황의 대출잔액과 업체별통계의 대출잔액과의 편차를 기반으로 계산됩니다.
          </div>
        </span>
      </div>
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
  hookHeroBannerHeightSync();
  // 네비 위젯 렌더 이후 한번 더
  setTimeout(syncNaviStatsHeightDebounced, 0);

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
  syncNaviStatsHeightDebounced();
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


/* =========================================================
   ✅ 상품유형별 대출잔액: '?' 도움말 툴팁 (hover + tap)
   - 레이아웃을 밀지 않도록 absolute popover 사용
   - 모바일 1회 탭으로 바로 표시
========================================================= */
function __bindBetaHelpTooltips() {
  if (window.__betaHelpTooltipsBound) return;
  window.__betaHelpTooltipsBound = true;

  const closeAll = (exceptEl) => {
    document.querySelectorAll(".beta-help.is-open").forEach((el) => {
      if (exceptEl && el === exceptEl) return;
      el.classList.remove("is-open");
      const btn = el.querySelector(".beta-help__btn");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  };

  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest(".beta-help__btn") : null;
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const wrap = btn.closest(".beta-help");
      if (!wrap) return;

      const isOpen = wrap.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      closeAll(wrap);
      return;
    }

    // 바깥 클릭 시 닫기
    closeAll(null);
  }, true);

  // ESC로 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll(null);
  }, true);
}
__bindBetaHelpTooltips();
