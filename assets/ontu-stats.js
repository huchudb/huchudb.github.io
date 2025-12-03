// /assets/ontu-stats.js
// 온투업 담보대출 통계 상세 페이지 전용 JS
// - 대출현황 카드 렌더
// - 상품유형별 대출잔액 카드 렌더
// - 모바일에서 카드 한 장씩 좌우 슬라이더

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

// 한 달 데이터만 가져오기
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

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    console.log("[ontu-stats] API response:", json);
    return json;
  } catch (e) {
    console.error("[ontu-stats] fetch error:", e);
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
            : amount && pRatio
            ? Math.round(amount * (pRatio / ratio || 0))
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

// ───────── 공통 카드 슬라이더 (모바일 한 장씩) ─────────

function initCardSlider() {
  const SLIDE_GAP = 16; // 카드 사이 여백(px)

  document
    .querySelectorAll("[data-card-track]")
    .forEach((track) => {
      if (track.dataset.sliderInitialized === "true") return;
      track.dataset.sliderInitialized = "true";

      const sliderName = track.getAttribute("data-card-track");
      const prevBtn = document.querySelector(
        `[data-card-prev="${sliderName}"]`
      );
      const nextBtn = document.querySelector(
        `[data-card-next="${sliderName}"]`
      );

      if (!prevBtn || !nextBtn) return;

      const cards = track.querySelectorAll(".stats-card");
      if (!cards.length) return;

      function getStep() {
        const card = cards[0];
        const cardWidth = card.getBoundingClientRect().width;
        return cardWidth + SLIDE_GAP;
      }

      prevBtn.addEventListener("click", () => {
        track.scrollBy({
          left: -getStep(),
          behavior: "smooth"
        });
      });

      nextBtn.addEventListener("click", () => {
        track.scrollBy({
          left: getStep(),
          behavior: "smooth"
        });
      });

      function handleResize() {
        const isMobile = window.matchMedia("(max-width: 768px)").matches;

        if (isMobile) {
          track.style.overflowX = "auto";
          track.style.scrollSnapType = "x mandatory";
        } else {
          track.style.overflowX = "visible";
          track.style.scrollSnapType = "none";
          track.scrollTo({ left: 0 });
        }
      }

      handleResize();
      window.addEventListener("resize", handleResize);
    });
}

// ───────── 월 선택 셀렉트 세팅 ─────────

function setupMonthSelect(selectEl, data) {
  if (!selectEl || !data) return;

  const months =
    data.availableMonths ||
    data.monthOptions ||
    data.months ||
    [];

  const currentMonth =
    data.monthKey || data.currentMonthKey || data.month || "";

  if (!months.length) {
    if (currentMonth) {
      selectEl.innerHTML = `<option value="${currentMonth}">${formatMonthLabel(
        currentMonth
      )}</option>`;
    }
    return;
  }

  const optionsHtml = months
    .map((m) => {
      const selected = m === currentMonth ? "selected" : "";
      return `<option value="${m}" ${selected}>${formatMonthLabel(m)}</option>`;
    })
    .join("");

  selectEl.innerHTML = optionsHtml;
}

// ───────── API 데이터 → 화면 적용 ─────────

function applyOntuData(raw) {
  if (!raw) return;

  // 서버 응답이 { success, data: {...} } / { ok, payload: {...} } / {...} 등
  // 여러 형태일 수 있으니 한 번 더 풀어서 core만 사용
  const data =
    raw.data ||
    raw.payload ||
    raw.result ||
    raw; // 가장 안쪽 객체

  console.log("[ontu-stats] applyOntuData input:", data);

  if (!data) return;

  const monthKey =
    data.monthKey || data.currentMonthKey || data.month || "";
  const prevMonthKey =
    data.prevMonthKey ||
    data.previousMonthKey ||
    getPrevMonthKey(monthKey);

  const currentSummary =
    data.summary ||
    data.currentSummary ||
    data.loanSummary ||
    null;
  const prevSummary =
    data.prevSummary ||
    data.previousSummary ||
    data.prevLoanSummary ||
    null;

  const currentByType =
    data.byType ||
    data.productByType ||
    data.productSummary ||
    data.balanceByType ||
    {};
  const prevByType =
    data.prevByType ||
    data.previousByType ||
    data.prevProductByType ||
    {};

  renderLoanStatus(currentSummary, monthKey, prevSummary, prevMonthKey);
  renderProductSection(
    currentSummary,
    currentByType,
    prevByType,
    monthKey,
    prevMonthKey
  );

  initCardSlider();
}

// ───────── 초기 진입 ─────────

async function initOntuStatsPage() {
  const monthSelect = document.getElementById("ontuMonthSelect");
  const initialMonthKey =
    monthSelect && monthSelect.value ? monthSelect.value : undefined;

  const firstRaw = await fetchOntuStats(initialMonthKey);
  if (!firstRaw) {
    console.error("[ontu-stats] 초기 데이터 로드 실패");
    return;
  }

  const firstData =
    firstRaw.data || firstRaw.payload || firstRaw.result || firstRaw;

  // 셀렉트 박스 세팅
  if (monthSelect) {
    setupMonthSelect(monthSelect, firstData);

    monthSelect.addEventListener("change", async (e) => {
      const mk = e.target.value || "";
      const raw = await fetchOntuStats(mk || undefined);
      applyOntuData(raw);
    });
  }

  // 초기 화면 렌더
  applyOntuData(firstRaw);
}

document.addEventListener("DOMContentLoaded", () => {
  initOntuStatsPage();
});
