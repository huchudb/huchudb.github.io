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
    return { text: "", html: "", className: "delta-flat" };
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

// ───────── 대출현황 카드 렌더 ─────────

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

  // ▶ 데이터 수집 업체수 + 3개 금액 카드
  const items = [
    {
      key: "dataFirms",
      label: "데이터 수집 온투업체수",
      type: "count"
    },
    {
      key: "totalLoan",
      label: "누적 대출금액",
      type: "money"
    },
    {
      key: "totalRepaid",
      label: "누적 상환금액",
      type: "money"
    },
    {
      key: "balance",
      label: "대출잔액",
      type: "money"
    }
  ];

  const cardsHtml = items
    .map((it) => {
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
          <div class="stats-card__delta-label">전월대비</div>
          <div class="stats-card__delta ${delta.className || "delta-flat"}">
            ${delta.html || delta.text || "변동 없음"}
          </div>
        </article>
      `;
    })
    .join("");

  // ontuLoanStatus는 이미 .stats-panel__grid 이므로 카드만 채워넣기
  container.innerHTML = cardsHtml;
}

// ───────── 상품유형별 대출잔액 카드 렌더 ─────────

let productSliderInitialized = false;

function initProductSlider() {
  const track = document.getElementById("ontuProductSection");
  if (!track) return;

  const cards = Array.from(track.querySelectorAll(".stats-card--product"));
  if (cards.length === 0) return;

  const prevBtn = document.querySelector(".stats-panel__nav--prev");
  const nextBtn = document.querySelector(".stats-panel__nav--next");
  if (!prevBtn || !nextBtn) return;

  let index = 0;

  function getVisibleCount() {
    return window.innerWidth <= 768 ? 1 : 4; // 모바일 1장, 데스크탑 4장
  }

  function update() {
    const visible = getVisibleCount();
    const gap = 14; // CSS gap과 동일
    const cardWidth = cards[0].getBoundingClientRect().width + gap;
    const maxIndex = Math.max(0, cards.length - visible);

    if (index > maxIndex) index = maxIndex;

    track.style.transform = `translateX(${-index * cardWidth}px)`;

    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === maxIndex;
  }

  if (!productSliderInitialized) {
    prevBtn.addEventListener("click", () => {
      index = Math.max(0, index - 1);
      update();
    });

    nextBtn.addEventListener("click", () => {
      index = index + 1;
      update();
    });

    window.addEventListener("resize", update);
    productSliderInitialized = true;
  }

  // 카드가 다시 그려질 때마다 한 번 재계산
  update();
}

function renderProductSection(currentSummary, currentByType, prevByType, monthKey, prevMonthKey) {
  const track  = document.getElementById("ontuProductSection");
  const monthEl = document.getElementById("productStatusMonth");
  if (!track) return;

  if (!currentSummary || !currentByType || !Object.keys(currentByType).length) {
    track.innerHTML = `
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

  const cardsHtml = Object.entries(currentByType)
    .map(([name, cfg]) => {
      const ratio =
        Number(cfg.ratio ?? cfg.share ?? (cfg.ratioPercent != null ? cfg.ratioPercent / 100 : 0));
      const amount =
        cfg.amount != null ? Number(cfg.amount) : balance ? Math.round(balance * ratio) : 0;

      // 전월 금액
      let prevAmt = null;
      if (prevByType && prevByType[name]) {
        const pCfg = prevByType[name];
        const pRatio =
          Number(
            pCfg.ratio ?? pCfg.share ?? (pCfg.ratioPercent != null ? pCfg.ratioPercent / 100 : 0)
          );
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
              <div class="stats-card__delta ${delta.className || "delta-flat"}">
                ${delta.html || delta.text || "변동 없음"}
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  // ontuProductSection 은 이미 .stats-panel__track 이므로 카드만 채워넣기
  track.innerHTML = cardsHtml;

  // 카드가 준비된 뒤 슬라이더 초기화/업데이트
  initProductSlider();
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

  // 1) 최신월 한 번 가져오기
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
