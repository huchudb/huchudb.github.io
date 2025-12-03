// /assets/ontu-stats.js
// 온투업 담보대출 통계 상세 페이지 전용 JS

const API_BASE = "https://huchudb-github-io.vercel.app";
const ONTU_API = `${API_BASE}/api/ontu-stats`;

// ========== 공통 유틸 ==========

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

// 금액 → '12조 3,580억 7,760만원' 텍스트
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
      return `${eok.toLocaleString("ko-KR")}억 ${man.toLocaleString(
        "ko-KR"
      )}만원`;
    }
    return `${eok.toLocaleString("ko-KR")}억`;
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

// 증감 정보 계산
function buildDelta(currRaw, prevRaw) {
  if (prevRaw == null || isNaN(prevRaw)) {
    return {
      dir: "flat",
      pct: "0.0%",
      absText: "변동 없음",
    };
  }

  const curr = Number(currRaw || 0);
  const prev = Number(prevRaw || 0);
  const diff = curr - prev;

  if (prev === 0) {
    return {
      dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
      pct: "0.0%",
      absText: formatKoreanCurrencyJo(diff === 0 ? 0 : Math.abs(diff)),
    };
  }

  const pctValue = (diff / prev) * 100;
  const pctStr = `${Math.abs(pctValue).toFixed(2)}%`;

  const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const absText = diff === 0
    ? "변동 없음"
    : formatKoreanCurrencyJo(Math.abs(diff));

  return { dir, pct: pctStr, absText };
}

// ========== API 호출 ==========

async function fetchOntuStats(monthKey) {
  try {
    const url = monthKey
      ? `${ONTU_API}?month=${encodeURIComponent(monthKey)}`
      : ONTU_API;

    const sep = url.includes("?") ? "&" : "?";

    const res = await fetch(`${url}${sep}t=${Date.now()}`, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        `${res.status} ${err && err.error ? err.error : "API error"}`
      );
    }
    return await res.json();
  } catch (e) {
    console.error("[ontu-stats] fetch error:", e);
    throw e;
  }
}

// ========== 렌더링: 대출 현황 ==========

function renderLoanStatus(currentSummary, monthKey, prevSummary) {
  const track = document.getElementById("ontuLoanStatus");
  const monthLabel = document.getElementById("loanStatusMonthLabel");
  if (!track) return;

  track.innerHTML = "";
  monthLabel.textContent = monthKey ? `${formatMonthLabel(monthKey)} 기준` : "";

  if (!currentSummary) {
    track.innerHTML = "";
    showNotice("대출 현황 데이터를 불러오지 못했습니다.");
    return;
  }

  const ps = prevSummary || {};

  const items = [
    { key: "dataFirms", label: "데이터수집 온투업체수", type: "count" },
    { key: "totalLoan", label: "누적 대출금액", type: "money" },
    { key: "totalRepaid", label: "누적 상환금액", type: "money" },
    { key: "balance", label: "대출잔액", type: "money" },
  ];

  const cardsHtml = items
    .map((it) => {
      const currRaw = currentSummary[it.key] ?? 0;
      const prevRaw = ps[it.key];

      let mainHtml;
      if (it.type === "count") {
        mainHtml = `
          <span class="stats-card__number">${(currRaw || 0).toLocaleString(
            "ko-KR"
          )}</span>
          <span class="stats-card__unit">개</span>
        `;
      } else {
        mainHtml = formatKoreanCurrencyJoHtml(currRaw);
      }

      const delta = buildDelta(currRaw, prevRaw);
      const deltaClass =
        delta.dir === "up"
          ? "delta-up"
          : delta.dir === "down"
          ? "delta-down"
          : "delta-flat";

      // 카드 구조는 디자인 이미지에 맞춰 구성
      return `
        <article class="stats-card">
          <div class="stats-card__label">${it.label}</div>

          <div class="stats-card__value stats-card__value--main">
            ${mainHtml}
          </div>

          <div class="stats-card__bottom-row stats-card__bottom-row--no-share">
            <span class="stats-card__share"></span>
            <div class="stats-card__delta-wrap">
              <div class="stats-card__delta-label">전월대비</div>
              <div class="stats-card__delta-rate">${delta.pct}</div>
              <div class="stats-card__delta ${deltaClass}">
                ${
                  delta.dir === "flat"
                    ? "변동 없음"
                    : `${delta.dir === "up" ? "▲" : "▼"} ${delta.absText}`
                }
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  track.innerHTML = cardsHtml;
}

// ========== 렌더링: 상품유형별 대출잔액 ==========

function renderProductSection(currentSummary, byType, prevByType, monthKey) {
  const track = document.getElementById("ontuProductTrack");
  const monthLabel = document.getElementById("productStatusMonthLabel");
  if (!track) return;

  track.innerHTML = "";
  monthLabel.textContent = monthKey ? `${formatMonthLabel(monthKey)} 기준` : "";

  if (!currentSummary || !byType || !Object.keys(byType).length) {
    showNotice("상품유형별 대출잔액 데이터를 불러오지 못했습니다.");
    return;
  }

  const balance = Number(currentSummary.balance || 0);

  const cardsHtml = Object.entries(byType)
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
            : null;
      }

      const delta = buildDelta(amount, prevAmt);
      const deltaClass =
        delta.dir === "up"
          ? "delta-up"
          : delta.dir === "down"
          ? "delta-down"
          : "delta-flat";

      const shareText = ratio > 0 ? `${(ratio * 100).toFixed(1)}%` : "";

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
              <div class="stats-card__delta-rate">${delta.pct}</div>
              <div class="stats-card__delta ${deltaClass}">
                ${
                  delta.dir === "flat"
                    ? "변동 없음"
                    : `${delta.dir === "up" ? "▲" : "▼"} ${delta.absText}`
                }
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  track.innerHTML = cardsHtml;
}

// ========== 슬라이더 초기화 (PC 4장 / 모바일 1장) ==========

function initSlider(options) {
  const {
    trackId,
    prevBtnId,
    nextBtnId,
  } = options;

  const track = document.getElementById(trackId);
  const prevBtn = document.getElementById(prevBtnId);
  const nextBtn = document.getElementById(nextBtnId);
  if (!track || !prevBtn || !nextBtn) return;

  const viewport = track.parentElement;
  let index = 0;

  function getVisibleCount() {
    return window.innerWidth >= 900 ? 4 : 1;
  }

  function updateButtons() {
    const cards = track.children.length;
    const visible = getVisibleCount();
    const maxIndex = Math.max(0, Math.ceil(cards / visible) - 1);

    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= maxIndex;
  }

  function applyTransform() {
    const viewportWidth = viewport.clientWidth;
    track.style.transform = `translateX(-${index * viewportWidth}px)`;
  }

  prevBtn.addEventListener("click", () => {
    if (index <= 0) return;
    index -= 1;
    applyTransform();
    updateButtons();
  });

  nextBtn.addEventListener("click", () => {
    const cards = track.children.length;
    const visible = getVisibleCount();
    const maxIndex = Math.max(0, Math.ceil(cards / visible) - 1);
    if (index >= maxIndex) return;
    index += 1;
    applyTransform();
    updateButtons();
  });

  window.addEventListener("resize", () => {
    // 화면 크기 바뀌면 맨 처음 페이지로
    index = 0;
    track.style.transform = "translateX(0)";
    updateButtons();
  });

  // 첫 초기화
  updateButtons();
}

// ========== 에러/안내 박스 ==========

function showNotice(message) {
  const section = document.getElementById("ontuStatsNoticeSection");
  const box = document.getElementById("ontuStatsNotice");
  if (!section || !box) return;
  box.textContent = message;
  section.style.display = "block";
}

function hideNotice() {
  const section = document.getElementById("ontuStatsNoticeSection");
  if (!section) return;
  section.style.display = "none";
}

// ========== 메인 흐름 ==========

async function loadMonthAndRender(explicitMonthKey) {
  hideNotice();

  try {
    // 1) 현재월 데이터 (monthKey가 없으면 API가 latest를 줌)
    const current = await fetchOntuStats(explicitMonthKey || undefined);
    if (!current || !current.month || !current.summary) {
      showNotice("통계 데이터가 없습니다. 관리자에서 먼저 저장해주세요.");
      return;
    }

    const monthKey = current.month;
    const input = document.getElementById("ontuMonthPicker");
    if (input && !explicitMonthKey) {
      // 초기 로딩 시 input 값 세팅
      input.value = monthKey;
    }

    // 2) 전월 데이터 (없어도 에러 아님)
    const prevKey = getPrevMonthKey(monthKey);
    let prevSummary = null;
    let prevByType = null;
    if (prevKey) {
      try {
        const prev = await fetchOntuStats(prevKey);
        if (prev && prev.summary) {
          prevSummary = prev.summary;
          prevByType = prev.byType || null;
        }
      } catch (e) {
        // 전월 데이터가 없어도 무시
        console.info("[ontu-stats] no previous month data:", e.message);
      }
    }

    // 3) 렌더링
    renderLoanStatus(current.summary, monthKey, prevSummary);
    renderProductSection(current.summary, current.byType, prevByType, monthKey);

    // 4) 슬라이더 재초기화
    initSlider({
      trackId: "ontuLoanStatus",
      prevBtnId: "loanSliderPrev",
      nextBtnId: "loanSliderNext",
    });
    initSlider({
      trackId: "ontuProductTrack",
      prevBtnId: "productSliderPrev",
      nextBtnId: "productSliderNext",
    });
  } catch (e) {
    console.error(e);
    showNotice("온투업 통계를 불러오는 중 오류가 발생했습니다.");
  }
}

// DOM 로드 후 초기화
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("ontuMonthPicker");
  if (input) {
    input.addEventListener("change", () => {
      const val = input.value || "";
      if (!val) return;
      loadMonthAndRender(val);
    });
  }

  // 최초 1회: latest 기준으로 로딩
  loadMonthAndRender(null);
});
