// /assets/ontu-stats.js  (대출 통계 상세 페이지 전용, 카드 레이아웃 버전)

// ───────── 공통 유틸 ─────────

// 금액 → '12조 3,580억 7,760만원' 포맷
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

  // 전월 데이터가 없으면 표시 X
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

  // 퍼센트(전월 대비) 계산
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

  // 금액 증감 문자열
  const baseText =
    diff === 0
      ? "변동 없음"
      : `${arrow} ${bodyText}`;
  const baseHtml =
    diff === 0
      ? "변동 없음"
      : `${arrow} ${bodyHtml}`;

  // 퍼센트 문자열: (+ 6.5%) / (- 2.3%) / (0.0%)
  let pctText = "";
  let pctHtml = "";
  if (pctValue !== null) {
    const sign = isUp ? "+" : isDown ? "-" : "";
    const pctCore = `${Math.abs(pctValue).toFixed(1)}%`;
    pctText = `(${sign ? sign + " " : ""}${pctCore})`;
    pctHtml = pctText;
  }

  // 화면에 쓸 기본값: 값 없으면 (0.0%)
  const pctDisplay = pctText || "(0.0%)";

  return {
    text: baseText,
    html: baseHtml,
    className:
      diff === 0 ? "delta-flat" : isUp ? "delta-up" : "delta-down",
    pctValue,
    pctText,
    pctHtml,
    pctDisplay
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

// ───────── 대출현황 카드 렌더 ─────────
function renderLoanStatus(currentSummary, monthKey, prevSummary, prevMonthKey) {
  const container = document.getElementById("ontuLoanStatus");
  const monthEl   = document.getElementById("loanStatusMonth");
  if (!container) return;

  // 기준월/전월 텍스트는 사용 안 함
  if (monthEl) monthEl.textContent = "";

  if (!currentSummary) {
    container.innerHTML = `
      <div class="notice error">
        <p>온투업 통계를 불러오지 못했습니다.</p>
      </div>
    `;
    return;
  }

  const s  = currentSummary;
  const ps = prevSummary || {};

  const items = [
    { key: "dataFirms",   label: "데이터 수집 온투업체수", type: "count" },
    { key: "totalLoan",   label: "누적 대출금액",          type: "money" },
    { key: "totalRepaid", label: "누적 상환금액",          type: "money" },
    { key: "balance",     label: "대출잔액",              type: "money" }
  ];

  const cardsHtml = items.map((it) => {
    const currRaw = s[it.key] ?? 0;
    const prevRaw = ps[it.key];

    let valueHtml;
    if (it.type === "count") {
      valueHtml = `
        <span class="stats-card__number">${(currRaw || 0).toLocaleString("ko-KR")}</span>
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
            <div class="stats-card__delta ${delta.className || "delta-flat"}">
              ${delta.html || delta.text || "변동 없음"}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  container.innerHTML = cardsHtml;
}

// ───────── 상품유형별 대출잔액 카드 렌더 ─────────
function renderProductSection(currentSummary, currentByType, prevByType, monthKey, prevMonthKey) {
  const track  = document.getElementById("ontuProductSection");
  const monthEl = document.getElementById("productStatusMonth");
  if (!track) return;

  // 기준월/전월 텍스트 사용 안 함
  if (monthEl) monthEl.textContent = "";

  if (!currentSummary || !currentByType || !Object.keys(currentByType).length) {
    track.innerHTML = `
      <div class="notice error">
        <p>상품유형별 대출잔액 정보를 불러오지 못했습니다.</p>
      </div>
    `;
    return;
  }

  const balance = Number(currentSummary.balance || 0);

  const cardsHtml = Object.entries(currentByType).map(([name, cfg]) => {
    const ratio =
      Number(cfg.ratio ?? cfg.share ?? (cfg.ratioPercent != null ? cfg.ratioPercent / 100 : 0));
    const amount =
      cfg.amount != null ? Number(cfg.amount) : balance ? Math.round(balance * ratio) : 0;

    // 전월 금액 계산
    let prevAmt = null;
    if (prevByType && prevByType[name]) {
      const pCfg = prevByType[name];
      const pRatio =
        Number(pCfg.ratio ?? pCfg.share ?? (pCfg.ratioPercent != null ? pCfg.ratioPercent / 100 : 0));
      prevAmt =
        pCfg.amount != null
          ? Number(pCfg.amount)
          : prevByType.balance
          ? Math.round(prevByType.balance * pRatio)
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
            <div class="stats-card__delta ${delta.className || "delta-flat"}">
              ${delta.html || delta.text || "변동 없음"}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  track.innerHTML = cardsHtml;
}

// ───────── 초기화: 기준월 + 전월 함께 로딩 ─────────

async function loadAndRenderForMonth(monthKey, preFetchedCurrent) {
  if (!monthKey) return;

  const prevMonthKey = getPrevMonthKey(monthKey);

  const currentPromise = preFetchedCurrent
    ? Promise.resolve(preFetchedCurrent)
    : fetchOntuStats(monthKey);

  const prevPromise = prevMonthKey ? fetchOntuStats(prevMonthKey) : Promise.resolve(null);

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

  // 최신월 한 번 가져오기
  const latest = await fetchOntuStats(null);
  const initialMonth =
    (latest && (latest.month || latest.monthKey)) || "2025-10";

  if (monthPicker) {
    monthPicker.value = initialMonth;
  }

  await loadAndRenderForMonth(initialMonth, latest);

  if (monthPicker) {
    monthPicker.addEventListener("change", async () => {
      const val = monthPicker.value;
      if (!val) return;
      await loadAndRenderForMonth(val);
    });
  }

  // ───────── 슬라이더 공통 함수 ─────────
  function setupAutoSlider({
    trackSelector,
    cardSelector,
    prevSelector,
    nextSelector,
    autoplayMs = 3000,
    mobileBreakpoint = 768,
  }) {
    const track = document.querySelector(trackSelector);
    if (!track) return;

    const cards = Array.from(track.querySelectorAll(cardSelector));
    if (cards.length === 0) return;

    const prevBtn = document.querySelector(prevSelector);
    const nextBtn = document.querySelector(nextSelector);

    let index = 0;
    let timer = null;

    const isMobile = () => window.innerWidth <= mobileBreakpoint;

    function updatePosition() {
      // PC에서는 슬라이드 효과 없도록 항상 0
      if (!isMobile()) {
        track.style.transform = "translateX(0)";
        return;
      }

      const cardWidth = cards[0].getBoundingClientRect().width;
      track.style.transform = `translateX(${-index * cardWidth}px)`;
    }

    function goTo(nextIndex) {
      if (!isMobile()) {
        index = 0;
        updatePosition();
        return;
      }

      if (nextIndex < 0) {
        index = cards.length - 1;
      } else if (nextIndex >= cards.length) {
        index = 0;
      } else {
        index = nextIndex;
      }
      updatePosition();
    }

    function startAuto() {
      if (!isMobile()) {
        stopAuto();
        index = 0;
        updatePosition();
        return;
      }
      if (timer) return;
      timer = setInterval(() => {
        goTo(index + 1);
      }, autoplayMs);
    }

    function stopAuto() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    prevBtn && prevBtn.addEventListener("click", () => {
      stopAuto();
      goTo(index - 1);
      startAuto();
    });

    nextBtn && nextBtn.addEventListener("click", () => {
      stopAuto();
      goTo(index + 1);
      startAuto();
    });

    window.addEventListener("resize", () => {
      stopAuto();
      index = 0;
      requestAnimationFrame(() => {
        updatePosition();
        startAuto();
      });
    });

    // 초기 위치 + 자동 슬라이드
    updatePosition();
    startAuto();
  }

  // ───────── 슬라이더 등록 ─────────
  // 1) 대출 현황: PC에서는 고정, 모바일에서만 1장씩 자동 슬라이드
  setupAutoSlider({
    trackSelector: "#ontuLoanStatus",      // 대출현황 카드들이 들어 있는 컨테이너
    cardSelector: ".stats-card",
    prevSelector: "#loanSliderPrev",
    nextSelector: "#loanSliderNext",
    autoplayMs: 3000,
    mobileBreakpoint: 768,
  });

  // 2) 상품유형별 대출잔액
  setupAutoSlider({
    trackSelector: "#ontuProductSection",  // 상품유형 카드 컨테이너
    cardSelector: ".stats-card--product",
    prevSelector: "#productSliderPrev",
    nextSelector: "#productSliderNext",
    autoplayMs: 3000,
    mobileBreakpoint: 768,
  });
});
  }
});
