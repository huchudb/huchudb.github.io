// /assets/ontu-stats.js
// 온투업 담보대출 통계 상세 페이지 전용 JS
// - /api/ontu-stats (month 단건 조회)에 맞춘 버전
// - 대출현황 카드 렌더
// - 상품유형별 대출잔액 카드 렌더 (+ 모바일 슬라이더 기본 지원)

// ───────── 공통 유틸 ─────────

// 금액 → '12조 3,580억 7,760만원' 포맷
function formatKoreanCurrencyJo(num) {
  const n = Math.max(0, Math.floor(num || 0));

  const ONE_MAN = 10_000;
  const ONE_EOK = 100_000_000;
  const ONE_JO = 1_000_000_000_000;

  if (n >= ONE_JO) {
    const jo = Math.floor(n / ONE_JO);
    const restAfterJo = n % ONE_JO;
    const eok = Math.floor(restAfterJo / ONE_EOK);
    const restAfterEok = restAfterJo % ONE_EOK;
    const man = Math.floor(restAfterEok / ONE_MAN);

    const parts = [];
    if (jo > 0) parts.push(`${jo.toLocaleString("ko-KR")}조`);
    if (eok > 0) parts.push(`${eok.toLocaleString("ko-KR")}억`);
    if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만원`);
    return parts.join(" ");
  }

  if (n >= ONE_EOK) {
    const eok = Math.floor(n / ONE_EOK);
    const rest = n % ONE_EOK;
    const man = Math.floor(rest / ONE_MAN);
    if (man > 0) {
      return `${eok.toLocaleString("ko-KR")}억 ${man.toLocaleString("ko-KR")}만원`;
    }
    return `${eok.toLocaleString("ko-KR")}억 원`;
  }

  if (n >= ONE_MAN) {
    const man = Math.floor(n / ONE_MAN);
    return `${man.toLocaleString("ko-KR")}만원`;
  }

  return `${n.toLocaleString("ko-KR")}원`;
}

// 금액 → HTML (숫자/단위 분리)
function formatKoreanCurrencyJoHtml(num) {
  const text = formatKoreanCurrencyJo(num);
  return text.replace(/(\d[\d,]*)(조|억|만원|원)/g, (match, numPart, unit) => {
    return `<span class="money-number">${numPart}</span><span class="money-unit">${unit}</span>`;
  });
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
// type: 'money' | 'count'
function buildDeltaInfo(currRaw, prevRaw, opts = {}) {
  const { type = "money" } = opts;

  if (prevRaw == null || isNaN(prevRaw)) {
    return {
      text: "",
      html: "",
      className: "",
      pctValue: null,
      pctText: "",
      pctHtml: "",
      pctDisplay: ""
    };
  }

  const curr = Number(currRaw || 0);
  const prev = Number(prevRaw || 0);
  const diff = curr - prev;

  let pctValue = null;
  if (prev !== 0) {
    pctValue = (diff / prev) * 100;
  }

  const isUp = diff > 0;
  const isDown = diff < 0;
  const arrow = isUp ? "▲" : isDown ? "▼" : "";
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

  const baseText = diff === 0 ? "변동 없음" : `${arrow} ${bodyText}`;
  const baseHtml = diff === 0 ? "변동 없음" : `${arrow} ${bodyHtml}`;

  let pctText = "";
  let pctHtml = "";
  if (pctValue !== null) {
    const sign = isUp ? "+" : isDown ? "-" : "";
    const pctCore = `${Math.abs(pctValue).toFixed(1)}%`;
    pctText = `(${sign ? sign + " " : ""}${pctCore})`;
    pctHtml = pctText;
  }
  const pctDisplay = pctText || "(0.0%)";

  return {
    text: baseText,
    html: baseHtml,
    className: diff === 0 ? "delta-flat" : isUp ? "delta-up" : "delta-down",
    pctValue,
    pctText,
    pctHtml,
    pctDisplay
  };
}

// ───────── API 설정 ─────────

const API_BASE = "https://huchudb-github-io.vercel.app";
const ONTU_API = `${API_BASE}/api/ontu-stats`;

// 한 달 데이터만 가져오기 (백엔드 구조에 그대로 맞춤)
// GET /api/ontu-stats?month=YYYY-MM  → { month, summary, byType }
// GET /api/ontu-stats               → latest { month, summary, byType }
async function fetchOntuStats(monthKey) {
  try {
    const url = monthKey
      ? `${ONTU_API}?month=${encodeURIComponent(monthKey)}`
      : `${ONTU_API}`;

    const sep = url.includes("?") ? "&" : "?";

    const res = await fetch(`${url}${sep}t=${Date.now()}`, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (!res.ok) {
      // 404면 null 리턴해서 "해당 월 데이터 없음" 처리
      console.error("[ontu-stats] fetch error:", res.status, await res.text());
      return null;
    }

    const json = await res.json();
    console.log("[ontu-stats] API response:", json);
    return json;
  } catch (e) {
    console.error("[ontu-stats] fetch exception:", e);
    return null;
  }
}

// ───────── 대출현황 카드 렌더 ─────────

function renderLoanStatus(currentSummary, monthKey, prevSummary, prevMonthKey) {
  const container = document.getElementById("ontuLoanStatus");
  const monthEl = document.getElementById("loanStatusMonth");
  if (!container) return;

  if (monthEl) {
    monthEl.textContent = monthKey ? formatMonthLabel(monthKey) : "";
  }

  if (!currentSummary) {
    container.innerHTML = `
      <div class="notice error">
        <p>온투업 통계를 불러오지 못했습니다.</p>
      </div>
    `;
    return;
  }

  const s = currentSummary;
  const ps = prevSummary || {};

  const items = [
    { key: "dataFirms", label: "데이터 수집 온투업체수", type: "count" },
    { key: "totalLoan", label: "누적 대출금액", type: "money" },
    { key: "totalRepaid", label: "누적 상환금액", type: "money" },
    { key: "balance", label: "대출잔액", type: "money" }
  ];

  const cardsHtml = items
    .map((it) => {
      const currRaw = s[it.key] ?? 0;
      const prevRaw = ps[it.key];

      let valueHtml;
      if (it.type === "count") {
        valueHtml = `
          <span class="stats-card__number">${(currRaw || 0).toLocaleString(
            "ko-KR"
          )}</span>
          <span class="stats-card__unit">개</span>
        `;
      } else {
        valueHtml = formatKoreanCurrencyJoHtml(currRaw);
      }

      const delta = buildDeltaInfo(currRaw, prevRaw, { type: it.type });

      return `
        <article class="stats-card">
          <div class="stats-card__label">${it.label}</div>
          <div class="stats-card__value stats-card__value--main">
            ${valueHtml}
          </div>

          <div class="stats-card__bottom-row stats-card__bottom-row--no-share">
            <span class="stats-card__share"></span>
            <div class="stats-card__delta-wrap">
              <div class="stats-card__delta-label">전월대비</div>
              <div class="stats-card__delta-rate">
                ${delta.pctDisplay || "(0.0%)"}
              </div>
              <div class="stats-card__delta ${
                delta.className || "delta-flat"
              }">
                ${delta.html || delta.text || "변동 없음"}
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  container.innerHTML = cardsHtml;
}

// ───────── 상품유형별 대출잔액 카드 렌더 ─────────

function renderProductSection(
  currentSummary,
  currentByType,
  prevByType,
  monthKey,
  prevMonthKey
) {
  const track = document.getElementById("ontuProductSection");
  const monthEl = document.getElementById("productStatusMonth");
  if (!track) return;

  if (monthEl) {
    monthEl.textContent = monthKey ? formatMonthLabel(monthKey) : "";
  }

  if (!currentSummary || !currentByType || !Object.keys(currentByType).length) {
    track.innerHTML = `
      <div class="notice error">
        <p>상품유형별 대출잔액 정보를 불러오지 못했습니다.</p>
      </div>
    `;
    return;
  }

  const balance = Number(currentSummary.balance || 0);

  const cardsHtml = Object.entries(currentByType)
    .map(([name, cfg]) => {
      const ratio =
        Number(
          cfg.ratio ??
            cfg.share ??
            (cfg.ratioPercent != null ? cfg.ratioPercent / 100 : 0)
        ) || 0;

      const amount =
        cfg.amount != null
          ? Number(cfg.amount)
          : balance
          ? Math.round(balance * ratio)
          : 0;

      // 전월 금액
      let prevAmt = null;
      if (prevByType && prevByType[name]) {
        const pCfg = prevByType[name];
        const pRatio =
          Number(
            pCfg.ratio ??
              pCfg.share ??
              (pCfg.ratioPercent != null ? pCfg.ratioPercent / 100 : 0)
          ) || 0;
        prevAmt =
          pCfg.amount != null
            ? Number(pCfg.amount)
            : balance && pRatio
            ? Math.round(balance * pRatio)
            : 0;
      }

      const delta = buildDeltaInfo(amount, prevAmt, { type: "money" });
      const shareText = ratio > 0 ? `${(ratio * 100).toFixed(1)}%` : "-";

      return `
        <article class="stats-card stats-card--product">
          <div class="stats-card__label">${name}</div>
          <div class="stats-card__value stats-card__value--main">
            ${formatKoreanCurrencyJoHtml(amount)}
          </div>

          <div class="stats-card__bottom-row">
            <span class="stats-card__share">${shareText}</span>
            <div class="stats-card__delta-wrap">
              <div class="stats-card__delta-label">전월대비</div>
              <div class="stats-card__delta-rate">
                ${delta.pctDisplay || "(0.0%)"}
              </div>
              <div class="stats-card__delta ${
                delta.className || "delta-flat"
              }">
                ${delta.html || delta.text || "변동 없음"}
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  track.innerHTML = cardsHtml;
}

// ───────── 상품유형 슬라이더 (모바일 전용) ─────────

let productSliderInitialized = false;

function initProductSlider() {
  if (productSliderInitialized) return;
  productSliderInitialized = true;

  const viewport = document.querySelector(
    ".stats-panel--products .stats-panel__viewport"
  );
  const track = document.getElementById("ontuProductSection");
  const prevBtn = document.getElementById("productPrevBtn");
  const nextBtn = document.getElementById("productNextBtn");

  if (!viewport || !track || !prevBtn || !nextBtn) return;

  let currentIndex = 0;

  function scrollToIndex(idx) {
    const cards = track.querySelectorAll(".stats-card");
    if (!cards.length) return;
    const first = cards[0];
    const cardWidth = first.offsetWidth;
    const gap =
      parseFloat(getComputedStyle(track).columnGap || 0) ||
      parseFloat(getComputedStyle(track).gap || 0) ||
      0;

    const maxIndex = Math.max(0, cards.length - 1);
    currentIndex = Math.min(Math.max(0, idx), maxIndex);

    const offset = (cardWidth + gap) * currentIndex;
    viewport.scrollTo({ left: offset, behavior: "smooth" });
  }

  prevBtn.addEventListener("click", () => {
    scrollToIndex(currentIndex - 1);
  });

  nextBtn.addEventListener("click", () => {
    scrollToIndex(currentIndex + 1);
  });

  // 리사이즈 시 인덱스에 맞춰 다시 정렬
  window.addEventListener("resize", () => {
    scrollToIndex(currentIndex);
  });
}

// ───────── 월 선택 / 초기화 ─────────

// monthSelect: <select id="ontuStatsMonthSelect"> (있으면 사용, 없으면 latest만)
async function loadAndRender(monthKey) {
  const root = document.documentElement;
  root.classList.add("ontu-loading");

  // 1) 현재월 데이터
  const current = await fetchOntuStats(monthKey);
  if (!current || !current.summary) {
    console.warn("[ontu-stats] no current data");
    renderLoanStatus(null, monthKey || (current && current.month) || null, null, null);
    renderProductSection(null, null, null, monthKey || (current && current.month) || null, null);
    root.classList.remove("ontu-loading");
    return;
  }

  const currentMonthKey = current.month;
  const prevMonthKey = getPrevMonthKey(currentMonthKey);

  // 페이지 상단(공통) 월 라벨이 따로 있다면 업데이트
  const globalMonthLabelEl = document.querySelector(
    "[data-role='ontu-stats-month-label']"
  );
  if (globalMonthLabelEl) {
    globalMonthLabelEl.textContent = formatMonthLabel(currentMonthKey);
  }

  // 2) 전월 데이터 (있으면 사용, 없으면 null)
  let prev = null;
  if (prevMonthKey) {
    prev = await fetchOntuStats(prevMonthKey);
  }

  renderLoanStatus(
    current.summary,
    currentMonthKey,
    prev && prev.summary ? prev.summary : null,
    prev && prev.month ? prev.month : prevMonthKey
  );

  renderProductSection(
    current.summary,
    current.byType || {},
    prev && prev.byType ? prev.byType : null,
    currentMonthKey,
    prev && prev.month ? prev.month : prevMonthKey
  );

  initProductSlider();

  // 드롭다운(select) 값 동기화
  const monthSelect = document.getElementById("ontuStatsMonthSelect");
  if (monthSelect) {
    const option = Array.from(monthSelect.options).find(
      (o) => o.value === currentMonthKey
    );
    if (option) monthSelect.value = currentMonthKey;
  }

  root.classList.remove("ontu-loading");
}

document.addEventListener("DOMContentLoaded", () => {
  // 초기 로딩: latest 월
  loadAndRender(null);

  // 월 변경 드롭다운 핸들러 (있을 때만)
  const monthSelect = document.getElementById("ontuStatsMonthSelect");
  if (monthSelect) {
    monthSelect.addEventListener("change", (e) => {
      const v = e.target.value || "";
      if (v) {
        loadAndRender(v);
      }
    });
  }
});
