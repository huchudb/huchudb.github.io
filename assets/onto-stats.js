// /assets/ontu-stats.js
// 온투업 대출 통계 상세 페이지 전용 스크립트
// - 기준월 선택 (input[type="month"])
// - 현재월 + 전월 데이터 불러와서
//   · 대출현황 카드 + 전월 대비 증감 ▲ ▼
//   · 상품유형별 대출잔액 도넛 + 카드 + 전월 대비 증감 표시

// ───────── API 베이스 ─────────
const API_BASE = "https://huchudb-github-io.vercel.app";
const ONTU_API = `${API_BASE}/api/ontu-stats`;

// ───────── 유틸 ─────────

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

// 현재 monthKey에서 전월 key 구하기 ('2025-10' → '2025-09')
function getPrevMonthKey(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [yStr, mStr] = monthKey.split("-");
  let y = Number(yStr);
  let m = Number(mStr);
  if (!y || !m) return null;

  m -= 1;
  if (m <= 0) {
    y -= 1;
    m = 12;
  }
  const mm = String(m).padStart(2, "0");
  return `${y}-${mm}`;
}

// 전월 대비 증감 HTML 만들기
function buildDeltaHtml(curr, prev, options = {}) {
  const { isMoney = false, unit = "" } = options;
  if (prev == null || isNaN(prev)) return ""; // 전월 데이터 없으면 표시 X

  const c = Number(curr || 0);
  const p = Number(prev || 0);
  const diff = c - p;

  if (!diff) {
    // 변동 없음이면 굳이 안 보여도 되면 ""로, 보여주고 싶으면 주석 해제
    // return `<div class="stats-delta" style="font-size:11px;color:#6b7280;">변동 없음</div>`;
    return "";
  }

  const isUp = diff > 0;
  const arrow = isUp ? "▲" : "▼";
  const color = isUp ? "#16a34a" : "#dc2626";
  const absVal = Math.abs(diff);

  let valueText;
  if (isMoney) {
    valueText = formatKoreanCurrencyJo(absVal);
  } else {
    valueText = `${absVal.toLocaleString("ko-KR")}${unit || ""}`;
  }

  return `
    <div class="stats-delta" style="margin-top:2px;font-size:11px;color:${color};">
      ${arrow} ${valueText}
    </div>
  `;
}

// ───────── API 호출 ─────────

// monthKey가 있으면 ?month=YYYY-MM, 없으면 latest
async function fetchOntuStatsByMonth(monthKey) {
  let url = ONTU_API;
  if (monthKey) {
    url += `?month=${encodeURIComponent(monthKey)}`;
  }
  // 캐시 방지용 t 파라미터 추가
  const sep = url.includes("?") ? "&" : "?";
  url += `${sep}t=${Date.now()}`;

  const res = await fetch(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (res.status === 404) {
    // 해당 월 데이터 없음
    return null;
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`ontu-stats GET 실패: HTTP ${res.status} ${txt}`);
  }
  const json = await res.json();
  if (!json || !json.summary) return null;
  return json; // { month, summary, byType }
}

// ───────── 렌더링: 대출현황 ─────────

function renderLoanStatus(summaryCurr, summaryPrev, monthKey, prevKey) {
  const container = document.getElementById("ontuLoanStatus");
  const monthEl   = document.getElementById("loanStatusMonth");
  if (!container) return;

  if (!summaryCurr) {
    container.innerHTML = `
      <div class="notice error">
        <p>대출현황 데이터를 불러오지 못했습니다.</p>
      </div>
    `;
    if (monthEl) monthEl.textContent = "";
    return;
  }

  if (monthEl) {
    if (prevKey && summaryPrev) {
      monthEl.textContent = `기준월: ${formatMonthLabel(monthKey)} (전월: ${formatMonthLabel(prevKey)} 기준 비교)`;
    } else {
      monthEl.textContent = `기준월: ${formatMonthLabel(monthKey)}`;
    }
  }

  const curr = summaryCurr;
  const prev = summaryPrev || {};

  const items = [
    {
      key: "registeredFirms",
      label: "금융위원회 등록 온투업체수",
      value: curr.registeredFirms != null
        ? `${Number(curr.registeredFirms).toLocaleString("ko-KR")}개`
        : "-",
      rawCurr: curr.registeredFirms,
      rawPrev: prev.registeredFirms,
      isMoney: false,
      unit: "개"
    },
    {
      key: "dataFirms",
      label: "데이터 수집 온투업체수",
      value: curr.dataFirms != null
        ? `${Number(curr.dataFirms).toLocaleString("ko-KR")}개`
        : "-",
      rawCurr: curr.dataFirms,
      rawPrev: prev.dataFirms,
      isMoney: false,
      unit: "개"
    },
    {
      key: "totalLoan",
      label: "누적대출금액",
      value: curr.totalLoan != null ? formatKoreanCurrencyJo(curr.totalLoan) : "-",
      rawCurr: curr.totalLoan,
      rawPrev: prev.totalLoan,
      isMoney: true
    },
    {
      key: "totalRepaid",
      label: "누적상환금액",
      value: curr.totalRepaid != null ? formatKoreanCurrencyJo(curr.totalRepaid) : "-",
      rawCurr: curr.totalRepaid,
      rawPrev: prev.totalRepaid,
      isMoney: true
    },
    {
      key: "balance",
      label: "대출잔액",
      value: curr.balance != null ? formatKoreanCurrencyJo(curr.balance) : "-",
      rawCurr: curr.balance,
      rawPrev: prev.balance,
      isMoney: true
    }
  ];

  const html = `
    <div class="beta-loanstatus-grid">
      ${items
        .map((it) => {
          const deltaHtml = buildDeltaHtml(it.rawCurr, it.rawPrev, {
            isMoney: it.isMoney,
            unit: it.unit
          });
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

  container.innerHTML = html;
}

// ───────── 렌더링: 상품유형별 대출잔액 ─────────

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

function renderProductSection(byTypeCurr, byTypePrev, monthKey, prevKey) {
  const section = document.getElementById("ontuProductSection");
  const monthEl = document.getElementById("productStatusMonth");
  if (!section) return;

  if (!byTypeCurr || !Object.keys(byTypeCurr).length) {
    section.innerHTML = `
      <div class="notice error">
        <p>상품유형별 대출잔액 데이터를 불러오지 못했습니다.</p>
      </div>
    `;
    if (monthEl) monthEl.textContent = "";
    return;
  }

  if (monthEl) {
    if (prevKey && byTypePrev && Object.keys(byTypePrev).length) {
      monthEl.textContent = `기준월: ${formatMonthLabel(monthKey)} (전월: ${formatMonthLabel(prevKey)} 기준 비교)`;
    } else {
      monthEl.textContent = `기준월: ${formatMonthLabel(monthKey)}`;
    }
  }

  const labels   = [];
  const percents = [];
  const amounts  = [];
  const prevAmounts = [];

  const entries = Object.entries(byTypeCurr);

  entries.forEach(([name, cfg], idx) => {
    const ratio  = Number(cfg.ratio ?? 0);
    const amount = Number(cfg.amount ?? 0);

    labels.push(name);
    percents.push(Math.round(ratio * 1000) / 10); // 0.425 → 42.5
    amounts.push(amount);

    const prevCfg = byTypePrev && byTypePrev[name] ? byTypePrev[name] : null;
    prevAmounts.push(prevCfg ? Number(prevCfg.amount ?? 0) : null);
  });

  // HTML 구성 (도넛 + 우측 카드들)
  const boxesHtml = labels
    .map((name, idx) => {
      const color  = PRODUCT_COLORS[idx] || "#e5e7eb";
      const amount = amounts[idx];
      const prev   = prevAmounts[idx];

      const deltaHtml = buildDeltaHtml(amount, prev, {
        isMoney: true
      });

      return `
        <div class="beta-product-box" style="--product-color:${color};">
          <div class="beta-product-box__title">
            ${name}
          </div>
          <div class="beta-product-box__amount">
            ${formatKoreanCurrencyJo(amount)}
            ${deltaHtml}
          </div>
        </div>
      `;
    })
    .join("");

  section.innerHTML = `
    <div class="beta-product-grid">
      <div class="beta-product-donut-wrap">
        <canvas id="productDonut"></canvas>
      </div>
      <div class="beta-product-boxes">
        ${boxesHtml}
      </div>
    </div>
  `;

  // 도넛 차트 렌더
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

// ───────── 메인 로직: 기준월 선택 + 렌더 ─────────

async function loadAndRenderStats(monthKeyOrNull) {
  const monthInput = document.getElementById("statsMonthPicker");

  try {
    // 1) 현재월 데이터
    const current = await fetchOntuStatsByMonth(monthKeyOrNull || null);
    if (!current || !current.summary) {
      alert("해당 기준월 통계 데이터를 찾을 수 없습니다.");
      return;
    }

    const currMonthKey = current.month;
    if (monthInput && currMonthKey) {
      monthInput.value = currMonthKey; // 선택값 동기화
    }

    // 2) 전월 데이터
    const prevKey = getPrevMonthKey(currMonthKey);
    let prev = null;
    if (prevKey) {
      try {
        prev = await fetchOntuStatsByMonth(prevKey);
      } catch (e) {
        console.warn("전월 데이터 조회 오류 (무시 가능):", e);
      }
    }

    // 3) 렌더
    renderLoanStatus(current.summary, prev ? prev.summary : null, currMonthKey, prevKey);
    renderProductSection(
      current.byType || {},
      prev ? prev.byType || {} : null,
      currMonthKey,
      prevKey
    );
  } catch (e) {
    console.error("loadAndRenderStats error:", e);
    alert("통계 데이터를 불러오는 중 오류가 발생했습니다.");
  }
}

// ───────── 상단 MENU 토글 (ontu-stats.html 전용) ─────────
function setupBetaMenu() {
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

// ───────── 초기화 ─────────
document.addEventListener("DOMContentLoaded", () => {
  setupBetaMenu();

  const monthInput = document.getElementById("statsMonthPicker");
  if (monthInput) {
    // 월 선택 변경 시
    monthInput.addEventListener("change", () => {
      const val = (monthInput.value || "").trim();
      if (!val) return;
      loadAndRenderStats(val);
    });
  }

  // 최초 진입 시: latest 기준월 자동 로딩
  loadAndRenderStats(null);
});
