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

// 'YYYY-MM' → '25년 7월' 형식
function formatShortMonthLabel(ym) {
  if (!ym || typeof ym !== "string") return "";
  const [y, m] = ym.split("-");
  if (!y || !m) return "";
  const yy = String(y).slice(2);
  return `${yy}년 ${Number(m)}월`;
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

// 끝 월 기준으로 과거 n개월 키 배열 (오래된 순)
function getMonthRangeTill(endMonthKey, count) {
  const arr = [];
  let cur = endMonthKey;
  for (let i = 0; i < count; i++) {
    if (!cur) break;
    arr.unshift(cur);
    cur = getPrevMonthKey(cur);
  }
  return arr;
}

// id용 안전한 문자열
function toSafeIdFragment(str) {
  return String(str || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "_");
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
    const url = monthKey
      ? `${ONTU_API}?month=${encodeURIComponent(monthKey)}`
      : `${ONTU_API}`;

    const res = await fetch(`${url}&t=${Date.now()}`, {
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
    console.error("[ontu-stats] fetch error:", e);
    return null;
  }
}

// ───────── Chart.js 설정 (도넛 + 스파크라인 공통) ─────────

let donutChart = null;
const sparkCharts = {}; // 스파크라인 chart 인스턴스 저장

// 도넛 색
const PRODUCT_COLORS = [
  "#1d4ed8", // 부동산담보
  "#f97316", // 부동산PF
  "#f43f5e", // 어음·매출채권담보
  "#facc15", // 기타담보(주식 등)
  "#22c55e", // 개인신용
  "#a855f7"  // 법인신용
];

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

if (window.Chart && Chart.register) {
  Chart.register(donutInsideLabelsPlugin);
}

// 공통 스파크라인 생성기
function createSparklineChart(canvasId, labels, data, opts = {}) {
  if (!window.Chart) return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  // 이전 차트 제거
  if (sparkCharts[canvasId]) {
    sparkCharts[canvasId].destroy();
    delete sparkCharts[canvasId];
  }

  const cleanData = (data || []).map(v => (v == null ? null : Number(v)));

  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          data: cleanData,
          borderColor: "#2563eb",              // 진한 파란색 라인
          backgroundColor: "transparent",      // 면적 채우기 X
          borderWidth: 1.8,                    // 살짝 얇게
          pointRadius: 0,                      // 기본 점 숨김
          pointHoverRadius: 3,                 // 호버 시 작은 점
          tension: 0.25,                       // 너무 꺾이지 않도록 살짝 곡선
          fill: false,                         // 면적 채우기 안함
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      spanGaps: true,                          // 중간에 null 있어도 자연스럽게 이어주기
      animation: false,                        // 애니메이션 제거(깜빡임 방지)
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            title(items) {
              if (!items || !items.length) return "";
              const idx = items[0].dataIndex;
              const key = labels[idx];
              return formatShortMonthLabel(key);   // '25년 7월'
            },
            label(ctx) {
              const v = ctx.parsed.y;
              if (v == null || isNaN(v)) return "";
              if (typeof opts.valueFormatter === "function") {
                return opts.valueFormatter(v);
              }
              return v.toLocaleString("ko-KR");
            }
          }
        }
      },
      elements: {
        point: { hitRadius: 8 }
      },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });

  sparkCharts[canvasId] = chart;
}


// ───────── 대출현황 카드 렌더 (전월 대비 + 스파크라인) ─────────

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

      const deltaHtml = delta.text
        ? `<div class="beta-loanstatus-item__delta ${delta.className}">
             ${delta.html || delta.text}
           </div>`
        : `<div class="beta-loanstatus-item__delta delta-flat">변동 없음</div>`;

      return `
        <div class="beta-loanstatus-item loan-card">
          <div class="loan-card__top">
            <div class="beta-loanstatus-item__label">${it.label}</div>
            ${deltaHtml}
          </div>
          <div class="beta-loanstatus-item__value">${valueHtml}</div>
          <div class="loan-card__spark">
            <canvas class="beta-sparkline" id="loanSpark_${it.key}"></canvas>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="beta-loanstatus-grid">
      ${html}
    </div>
  `;

  // 스파크라인은 별도 히스토리 로딩 후 그려짐
}

// ───────── 상품유형별 대출잔액 도넛 + 카드 (전월 대비 + 스파크라인) ─────────

// 상품유형 설명 텍스트 (필요하면 나중에 수정)
const PRODUCT_SUBTITLES = {
  "부동산담보": "아파트·주택·토지 등 부동산 담보 대출",
  "부동산PF": "부동산 개발·공사비 프로젝트 파이낸싱",
  "어음·매출채권담보": "기업 어음·매출채권 담보 대출",
  "기타담보(주식 등)": "주식·지분 등 금융자산 담보 대출",
  "개인신용": "담보 없이 신용으로 취급된 개인대출",
  "법인신용": "기업 신용 기반의 운영·투자 자금"
};

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
    const ratio  = Number(
      cfg.ratio ?? cfg.share ?? (cfg.ratioPercent != null ? cfg.ratioPercent / 100 : 0)
    );
    const amount =
      cfg.amount != null ? Number(cfg.amount) : balance ? Math.round(balance * ratio) : 0;

    labels.push(name);
    percents.push(Math.round(ratio * 1000) / 10); // 0.425 → 42.5
    amounts.push(amount);

    // 전월 금액
    let prevAmt = null;
    if (prevByType && prevByType[name]) {
      const pCfg   = prevByType[name];
      const pRatio = Number(
        pCfg.ratio ?? pCfg.share ?? (pCfg.ratioPercent != null ? pCfg.ratioPercent / 100 : 0)
      );
      const prevBalance = Number((prevByType.summaryBalance ?? 0)) || null;
      const base = prevBalance || 0;
      prevAmt =
        pCfg.amount != null ? Number(pCfg.amount) : base ? Math.round(base * pRatio) : 0;
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
      const share = percents[idx] != null ? `${percents[idx].toFixed(1)}%` : "";

      const subtitle = PRODUCT_SUBTITLES[name] || "";
      const safeName = toSafeIdFragment(name);

      const deltaHtml = delta.text
        ? `<div class="beta-product-box__delta ${delta.className}">
             ${delta.html || delta.text}
           </div>`
        : `<div class="beta-product-box__delta delta-flat">변동 없음</div>`;

      return `
        <div class="beta-product-box" style="--product-color:${color};">
          <div class="beta-product-box__left">
            <div class="beta-product-box__title-row">
              <div class="beta-product-box__title">${name}</div>
              <div class="beta-product-box__share">${share}</div>
            </div>
            <div class="beta-product-box__subtitle">${subtitle}</div>
          </div>
          <div class="beta-product-box__right">
            <div class="beta-product-box__amount">
              ${formatKoreanCurrencyJoHtml(amt)}
            </div>
            ${deltaHtml}
            <div class="beta-product-box__spark">
              <canvas class="beta-sparkline" id="typeSpark_${safeName}"></canvas>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // 🔹 도넛 없이, 카드만 풀넓이로 배치
  section.innerHTML = `
    <div class="beta-product-boxes beta-product-boxes--full">
      ${boxesHtml}
    </div>
  `;
}

// ───────── 6개월 히스토리 불러와서 스파크라인 그리기 ─────────

async function loadHistoryAndRenderSparklines(monthKey) {
  const HISTORY_MONTHS = 6;
  const months = getMonthRangeTill(monthKey, HISTORY_MONTHS);
  if (!months.length) return;

  const results = await Promise.all(months.map(m => fetchOntuStats(m)));

  // 요약 시계열
  const summarySeries = {
    dataFirms: [],
    totalLoan: [],
    totalRepaid: [],
    balance: []
  };

  for (let i = 0; i < months.length; i++) {
    const data = results[i];
    const s = data && data.summary;
    summarySeries.dataFirms.push(s ? Number(s.dataFirms || 0) : null);
    summarySeries.totalLoan.push(s ? Number(s.totalLoan || 0) : null);
    summarySeries.totalRepaid.push(s ? Number(s.totalRepaid || 0) : null);
    summarySeries.balance.push(s ? Number(s.balance || 0) : null);
  }

  // 대출현황 스파크라인
  createSparklineChart("loanSpark_dataFirms", months, summarySeries.dataFirms, {
    valueFormatter: (v) => `${v.toLocaleString("ko-KR")}개`
  });
  createSparklineChart("loanSpark_totalLoan", months, summarySeries.totalLoan, {
    valueFormatter: (v) => formatKoreanCurrencyJo(v)
  });
  createSparklineChart("loanSpark_totalRepaid", months, summarySeries.totalRepaid, {
    valueFormatter: (v) => formatKoreanCurrencyJo(v)
  });
  createSparklineChart("loanSpark_balance", months, summarySeries.balance, {
    valueFormatter: (v) => formatKoreanCurrencyJo(v)
  });

  // 상품유형별 시계열 (현재월 기준으로 타입 목록 고정)
  const latest = results[results.length - 1];
  if (!latest || !latest.byType || !latest.summary) return;

  const typeNames = Object.keys(latest.byType);
  const byTypeSeries = {};
  typeNames.forEach((n) => { byTypeSeries[n] = []; });

  for (let i = 0; i < months.length; i++) {
    const data = results[i];
    const s = data && data.summary;
    const balance = s ? Number(s.balance || 0) : 0;
    const byType = data && data.byType;

    typeNames.forEach((name) => {
      if (byType && byType[name]) {
        const cfg = byType[name];
        const ratio = Number(
          cfg.ratio ?? cfg.share ?? (cfg.ratioPercent != null ? cfg.ratioPercent / 100 : 0)
        );
        const amount =
          cfg.amount != null ? Number(cfg.amount) : balance ? Math.round(balance * ratio) : 0;
        byTypeSeries[name].push(amount);
      } else {
        byTypeSeries[name].push(null);
      }
    });
  }

  typeNames.forEach((name) => {
    const safe = toSafeIdFragment(name);
    createSparklineChart(`typeSpark_${safe}`, months, byTypeSeries[name], {
      valueFormatter: (v) => formatKoreanCurrencyJo(v)
    });
  });
}

// ───────── 초기화: 기준월 + 전월 + 히스토리 함께 로딩 ─────────

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

  // prevByType에서 balance 참조용으로 summaryBalance 넣어두기
  if (prevData && prevData.byType && prevData.summary) {
    const sumBal = Number(prevData.summary.balance || 0);
    Object.keys(prevData.byType).forEach((k) => {
      if (!prevData.byType[k]) return;
      prevData.byType[k].summaryBalance = sumBal;
    });
  }

  renderProductSection(
    current.summary,
    current.byType,
    prevData && prevData.byType,
    currMonthKey,
    prevKey
  );

  // 6개월 히스토리 기반 스파크라인
  await loadHistoryAndRenderSparklines(currMonthKey);
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

  // 2) 최신월 + 전월 렌더 + 히스토리
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
