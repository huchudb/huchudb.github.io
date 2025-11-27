// /assets/ontu-stats.js  (대출 통계 상세 페이지 전용)

// ───────── 공통 유틸 ─────────
function formatKoreanCurrencyJoHtml(num) {
  const text = formatKoreanCurrencyJo(num);
  // 12,345조 / 678억 / 910만원 / 123원 이런 패턴에서 숫자와 단위를 분리
  return text.replace(/(\d[\d,]*)(조|억|만원|원)/g, (match, numPart, unit) => {
    return `<span class="money-number">${numPart}</span><span class="money-unit">${unit}</span>`;
  });
}

// '조/억/만원' 포맷
function formatKoreanCurrencyJo(num) {
  const n = Math.max(0, Math.floor(num || 0));

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

// 'YYYY-MM' → 이전달 'YYYY-MM'
function getPrevMonthKey(monthKey) {
  if (!monthKey) return null;
  const [yStr, mStr] = monthKey.split("-");
  let y = Number(yStr);
  let m = Number(mStr);
  if (!y || !m) return null;

  m -= 1;
  if (m === 0) {
    y -= 1;
    m = 12;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

// 증감 텍스트 & 클래스 계산
function buildDeltaInfo(currRaw, prevRaw, opts = {}) {
  const { type = "money" } = opts; // 'money' | 'count'

  // 전월 데이터가 아예 없으면 표시 안 함
  if (prevRaw == null || isNaN(prevRaw)) {
    return { text: "", html: "", className: "" };
  }

  const diff = (currRaw || 0) - (prevRaw || 0);

  // 값은 있는데 그대로면 → "변동 없음"
  if (diff === 0) {
    return {
      text: "변동 없음",
      html: "변동 없음",
      className: "delta-flat"
    };
  }

  const isUp = diff > 0;
  const arrow = isUp ? "▲" : "▼";
  const abs = Math.abs(diff);

  let bodyText;
  let bodyHtml;

  if (type === "count") {
    bodyText = `${abs.toLocaleString("ko-KR")}개`;
    bodyHtml = bodyText;
  } else {
    bodyText = formatKoreanCurrencyJo(abs);
    bodyHtml = formatKoreanCurrencyJoHtml(abs);
  }

  return {
    text: `${arrow} ${bodyText}`,
    html: `${arrow} ${bodyHtml}`,
    className: isUp ? "delta-up" : "delta-down"
  };
}

// ───────── API 설정 ─────────

const API_BASE = "https://huchudb-github-io.vercel.app";
const ONTU_API = `${API_BASE}/api/ontu-stats`;

// 한 달 데이터만 가져오기
async function fetchOntuStats(monthKey) {
  try {
    const res = await fetch(
  `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`,
  {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    headers: { Accept: "application/json" },
    cache: "no-store"
  }
);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json;
  } catch (e) {
    console.error("[ontu-stats] fetch error:", e);
    return null;
  }
}

// ───────── 대출현황 렌더 (전월 대비 포함) ─────────

function renderLoanStatus(currentSummary, monthKey, prevSummary, prevMonthKey) {
  const container = document.getElementById("ontuLoanStatus");
  const monthEl   = document.getElementById("loanStatusMonth");
  if (!container) return;

  if (!currentSummary) {
    container.innerHTML = `
      <div class="notice error">
        <p>온투업 통계를 불러오지 못했습니다.</p>
      </div>
    `;
    if (monthEl) monthEl.textContent = "";
    return;
  }

  // 상단 "기준월 / 전월" 표시
  if (monthEl) {
    let txt = `기준월: ${formatMonthLabel(monthKey)}`;
    if (prevMonthKey) {
      txt += ` · 전월: ${formatMonthLabel(prevMonthKey)}`;
    }
    monthEl.textContent = txt;
  }

  const s  = currentSummary;
  const ps = prevSummary || {};

  const items = [
    {
      key: "registeredFirms",
      label: "금융위원회 등록 온투업체수",
      type: "count"
    },
    {
      key: "dataFirms",
      label: "데이터 수집 온투업체수",
      type: "count"
    },
    {
      key: "totalLoan",
      label: "누적대출금액",
      type: "money"
    },
    {
      key: "totalRepaid",
      label: "누적상환금액",
      type: "money"
    },
    {
      key: "balance",
      label: "대출잔액",
      type: "money"
    }
  ];

  const html = items
    .map((it) => {
      const currRaw = s[it.key] ?? 0;
      const prevRaw = ps[it.key];

      let valueHtml;
      if (it.type === "count") {
        valueHtml = `${(currRaw || 0).toLocaleString("ko-KR")}개`;
      } else {
        valueHtml = formatKoreanCurrencyJoHtml(currRaw);
      }

      const delta = buildDeltaInfo(currRaw, prevRaw, { type: it.type });

      return `
        <div class="beta-loanstatus-item">
          <div class="beta-loanstatus-item__label">${it.label}</div>
          <div class="beta-loanstatus-item__value">${valueHtml}</div>
          ${
            delta.text
              ? `<div class="beta-loanstatus-item__delta ${delta.className}">
                   ${delta.html || delta.text}
                 </div>`
              : `<div class="beta-loanstatus-item__delta delta-flat">-</div>`
          }
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="beta-loanstatus-grid">
      ${html}
    </div>
  `;
}

// ───────── 상품유형별 대출잔액 도넛 + 카드 (전월 대비 포함) ─────────

let donutChart = null;

// 도넛 색
const PRODUCT_COLORS = [
  "#1d4ed8", // 부동산담보
  "#f97316", // 부동산PF
  "#f43f5e", // 어음·매출채권담보
  "#facc15", // 기타담보(주식 등)
  "#22c55e", // 개인신용
  "#a855f7"  // 법인신용
];

// 도넛 안 % 라벨 플러그인 (선택사항)
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

if (window.Chart && Chart.register) {
  Chart.register(donutInsideLabelsPlugin);
}

function renderProductSection(currentSummary, currentByType, prevByType, monthKey, prevMonthKey) {
  const section = document.getElementById("ontuProductSection");
  const monthEl = document.getElementById("productStatusMonth");
  if (!section) return;

  if (!currentSummary || !currentByType || !Object.keys(currentByType).length) {
    section.innerHTML = `
      <div class="notice error">
        <p>상품유형별 대출잔액 정보를 불러오지 못했습니다.</p>
      </div>
    `;
    if (monthEl) monthEl.textContent = "";
    return;
  }

  if (monthEl) {
    let txt = `기준월: ${formatMonthLabel(monthKey)}`;
    if (prevMonthKey) {
      txt += ` · 전월: ${formatMonthLabel(prevMonthKey)}`;
    }
    monthEl.textContent = txt;
  }

  const balance = Number(currentSummary.balance || 0);
  const labels   = [];
  const percents = [];
  const amounts  = [];
  const prevAmounts = [];

  for (const [name, cfg] of Object.entries(currentByType)) {
    const ratio  = Number(cfg.ratio ?? cfg.share ?? (cfg.ratioPercent != null ? cfg.ratioPercent / 100 : 0));
    const amount =
      cfg.amount != null ? Number(cfg.amount) : balance ? Math.round(balance * ratio) : 0;

    labels.push(name);
    percents.push(Math.round(ratio * 1000) / 10); // 0.425 → 42.5
    amounts.push(amount);

    // 전월 금액
    let prevAmt = 0;
    if (prevByType && prevByType[name]) {
      const pCfg   = prevByType[name];
      const pRatio =
        Number(pCfg.ratio ?? pCfg.share ?? (pCfg.ratioPercent != null ? pCfg.ratioPercent / 100 : 0));
      prevAmt =
        pCfg.amount != null ? Number(pCfg.amount) : (prevByType.balance ? Math.round(prevByType.balance * pRatio) : 0);
    } else {
      prevAmt = null;
    }
    prevAmounts.push(prevAmt);
  }

  // 카드 HTML
const boxesHtml = labels
  .map((name, idx) => {
    const color = PRODUCT_COLORS[idx] || "#e5e7eb";
    const amt   = amounts[idx];
    const prev  = prevAmounts[idx];
    const delta = buildDeltaInfo(amt, prev, { type: "money" });

    return `
      <div class="beta-product-box" style="--product-color:${color};">
        <div class="beta-product-box__left">
          <div class="beta-product-box__title">${name}</div>
        </div>
        <div class="beta-product-box__right">
          <div class="beta-product-box__amount">
            ${formatKoreanCurrencyJoHtml(amt)}
          </div>
          ${
            delta.text
              ? `<div class="beta-product-box__delta ${delta.className}">
                   ${delta.html || delta.text}
                 </div>`
              : `<div class="beta-product-box__delta delta-flat">-</div>`
          }
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

// ───────── 초기화: 기준월 + 전월 함께 로딩 ─────────

async function loadAndRenderForMonth(monthKey, preFetchedCurrent) {
  if (!monthKey) return;

  const prevMonthKey = getPrevMonthKey(monthKey);

  const currentPromise = preFetchedCurrent
    ? Promise.resolve(preFetchedCurrent)
    : fetchOntuStats(monthKey);

  const prevPromise = prevMonthKey
    ? fetchOntuStats(prevMonthKey)
    : Promise.resolve(null);

  const [current, prev] = await Promise.all([currentPromise, prevPromise]);

  if (!current || !current.summary) {
    renderLoanStatus(null, monthKey, null, prevMonthKey);
    renderProductSection(null, null, null, monthKey, prevMonthKey);
    return;
  }

  const currMonthKey = current.month || current.monthKey || monthKey;
  const prevData     = prev && prev.summary ? prev : null;
  const prevKey      = prevData ? (prevData.month || prevData.monthKey || prevMonthKey) : null;

  renderLoanStatus(current.summary, currMonthKey, prevData && prevData.summary, prevKey);
  renderProductSection(
    current.summary,
    current.byType,
    prevData && prevData.byType,
    currMonthKey,
    prevKey
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  const monthPicker = document.getElementById("statsMonthPicker");

  // 1) 우선 최신월 한 번 가져오기
  const latest = await fetchOntuStats(null);
  const initialMonth =
    (latest && (latest.month || latest.monthKey)) || "2025-10";

  if (monthPicker) {
    monthPicker.value = initialMonth; // 'YYYY-MM'
  }

  // 2) 최신월 + 전월 렌더
  await loadAndRenderForMonth(initialMonth, latest);

  // 3) 기준월 변경 시마다 다시 로딩
  if (monthPicker) {
    monthPicker.addEventListener("change", async () => {
      const val = monthPicker.value;
      if (!val) return;
      await loadAndRenderForMonth(val);
    });
  }
});
