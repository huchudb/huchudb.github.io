// /assets/ontu-stats.js

// ───────── 공통 유틸 ─────────

// '조/억/만원' 포맷 (home-beta.js와 동일 로직)
function formatKoreanCurrencyJo(num) {
  const n = Math.max(0, Math.floor(Number(num) || 0));

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

// 전월 대비 증감 텍스트 구성
function buildDeltaChip(current, prev) {
  const cur = Number(current || 0);
  const pre = Number(prev || 0);

  if (!pre || cur === pre) return "";

  const diff = cur - pre;
  const up   = diff > 0;
  const arrow = up ? "▲" : "▼";
  const label = up ? "증가" : "감소";

  return `
    <span class="beta-delta beta-delta--${up ? "up" : "down"}">
      ${arrow} ${formatKoreanCurrencyJo(Math.abs(diff))} ${label}
    </span>
  `;
}

// ───────── API 설정 ─────────

const API_BASE = "https://huchudb-github-io.vercel.app";
const ONTU_API = `${API_BASE}/api/ontu-stats`;

/**
 * 온투업 통계 조회
 * @param {string|null} monthKey 'YYYY-MM' 또는 null(최근 기준월)
 * 기대하는 응답 형태:
 *  {
 *    month: "2025-10",
 *    summary: { ... },
 *    byType: { "부동산담보": {ratio, amount}, ... },
 *    prevMonth?: "2025-09",
 *    prevSummary?: { ... }
 *  }
 */
async function fetchOntuStats(monthKey = null) {
  const params = monthKey ? `?month=${encodeURIComponent(monthKey)}&t=${Date.now()}` 
                          : `?t=${Date.now()}`;

  const res = await fetch(`${ONTU_API}${params}`, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`ontu-stats GET 실패: HTTP ${res.status}`);
  }
  return await res.json();
}

// ───────── 대출현황 렌더 ─────────

function renderLoanStatus(summary, monthStr, prevSummary, prevMonthStr) {
  const container = document.getElementById("ontuLoanStatus");
  const monthEl   = document.getElementById("loanStatusMonth");
  if (!container) return;

  if (!summary) {
    container.innerHTML = `
      <div class="notice error">
        <p>선택한 기준월의 대출현황 데이터를 찾을 수 없습니다.</p>
      </div>
    `;
    if (monthEl) monthEl.textContent = "";
    return;
  }

  if (monthEl) {
    const base = `기준월: ${formatMonthLabel(monthStr)}`;
    const prevTxt = prevMonthStr ? ` (전월: ${formatMonthLabel(prevMonthStr)})` : "";
    monthEl.textContent = base + prevTxt;
  }

  const items = [
    {
      key:  "registeredFirms",
      label: "금융위원회 등록 온투업체수",
      value: summary.registeredFirms != null
        ? `${summary.registeredFirms.toLocaleString("ko-KR")}개`
        : "-",
      prev: prevSummary?.registeredFirms ?? null
    },
    {
      key:  "dataFirms",
      label: "데이터 수집 온투업체수",
      value: summary.dataFirms != null
        ? `${summary.dataFirms.toLocaleString("ko-KR")}개`
        : "-",
      prev: prevSummary?.dataFirms ?? null
    },
    {
      key:  "totalLoan",
      label: "누적대출금액",
      value: summary.totalLoan != null ? formatKoreanCurrencyJo(summary.totalLoan) : "-",
      prev: prevSummary?.totalLoan ?? null
    },
    {
      key:  "totalRepaid",
      label: "누적상환금액",
      value: summary.totalRepaid != null ? formatKoreanCurrencyJo(summary.totalRepaid) : "-",
      prev: prevSummary?.totalRepaid ?? null
    },
    {
      key:  "balance",
      label: "대출잔액",
      value: summary.balance != null ? formatKoreanCurrencyJo(summary.balance) : "-",
      prev: prevSummary?.balance ?? null
    }
  ];

  container.innerHTML = `
    <div class="beta-loanstatus-grid">
      ${items
        .map((it) => {
          const deltaHtml =
            it.key === "balance" || it.key === "totalLoan" || it.key === "totalRepaid"
              ? buildDeltaChip(summary[it.key], it.prev)
              : "";
          return `
            <div class="beta-loanstatus-item">
              <div class="beta-loanstatus-item__label">${it.label}</div>
              <div class="beta-loanstatus-item__value">
                ${it.value}
                ${deltaHtml}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

// ───────── 상품유형별 대출잔액 렌더 ─────────

let donutChart = null;

// 도넛 색상 (home-beta.js와 동일 팔레트)
const PRODUCT_COLORS = [
  "#1d4ed8", // 부동산담보
  "#f97316", // 부동산PF
  "#f43f5e", // 어음·매출채권담보
  "#facc15", // 기타담보(주식 등)
  "#22c55e", // 개인신용
  "#a855f7"  // 법인신용
];

function renderProductSection(monthStr, byType) {
  const section = document.getElementById("ontuProductSection");
  const monthEl = document.getElementById("productStatusMonth");
  if (!section) return;

  if (monthEl) {
    monthEl.textContent = monthStr ? `기준월: ${formatMonthLabel(monthStr)}` : "";
  }

  if (!byType || !Object.keys(byType).length) {
    section.innerHTML = `
      <div class="notice error">
        <p>선택한 기준월의 상품유형별 대출잔액 데이터를 찾을 수 없습니다.</p>
      </div>
    `;
    return;
  }

  const labels   = [];
  const percents = [];
  const amounts  = [];

  for (const [name, cfg] of Object.entries(byType)) {
    // 서버에서 ratio(0.43) 또는 ratioPercent(43) 중 하나 제공한다고 가정
    let ratio = null;
    if (cfg.ratio != null) {
      ratio = Number(cfg.ratio);
    } else if (cfg.ratioPercent != null) {
      ratio = Number(cfg.ratioPercent) / 100;
    } else if (cfg.share != null) {
      ratio = Number(cfg.share);
    } else {
      ratio = 0;
    }

    const amount = Number(cfg.amount || 0);

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
            const color = PRODUCT_COLORS[idx] || "#e5e7eb";
            return `
              <div class="beta-product-box" style="--product-color:${color};">
                <div class="beta-product-box__title">${name}</div>
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

// ───────── 월 선택 & 초기화 ─────────

async function loadAndRenderStats(monthKey = null) {
  const monthInput = document.getElementById("statsMonthPicker");
  const loanContainer = document.getElementById("ontuLoanStatus");

  if (loanContainer) {
    loanContainer.innerHTML = `<p style="padding:16px;font-size:13px;color:#6b7280;">통계 데이터를 불러오는 중입니다...</p>`;
  }

  try {
    const data = await fetchOntuStats(monthKey);

    const month       = data.month || monthKey || "";
    const summary     = data.summary || null;
    const byType      = data.byType || data.products || {};
    const prevMonth   = data.prevMonth || null;
    const prevSummary = data.prevSummary || null;

    // 월 선택값 자동 세팅 (최초 로드 시)
    if (monthInput && !monthInput.value && month) {
      monthInput.value = month;
    }

    renderLoanStatus(summary, month, prevSummary, prevMonth);
    renderProductSection(month, byType);
  } catch (e) {
    console.error("[ontu-stats] load error:", e);
    if (loanContainer) {
      loanContainer.innerHTML = `
        <div class="notice error">
          <p>통계 API 호출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
        </div>
      `;
    }
  }
}

function setupMonthPicker() {
  const monthInput = document.getElementById("statsMonthPicker");
  if (!monthInput) return;

  monthInput.addEventListener("change", () => {
    const v = (monthInput.value || "").trim();
    if (!v) return;
    loadAndRenderStats(v);
  });
}

function setupBetaMenuSimple() {
  const toggle = document.getElementById("betaMenuToggle");
  const panel  = document.getElementById("betaMenuPanel");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = panel.classList.contains("hide");
    if (isHidden) {
      panel.classList.remove("hide");
      toggle.setAttribute("aria-expanded", "true");
    } else {
      panel.classList.add("hide");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("click", (e) => {
    if (!panel.classList.contains("hide")) {
      if (!panel.contains(e.target) && e.target !== toggle) {
        panel.classList.add("hide");
        toggle.setAttribute("aria-expanded", "false");
      }
    }
  });
}

// ───────── 초기 실행 ─────────

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ ontu-stats.js loaded");
  setupBetaMenuSimple();
  setupMonthPicker();
  // 최초 로드는 서버에서 "최근 기준월"을 반환한다고 가정
  loadAndRenderStats(null);
});
