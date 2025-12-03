// /assets/ontu-stats.js
// 온투업 담보대출 통계 상세 페이지 전용 JS
// - /api/ontu-stats 에서 최신 또는 특정 월 데이터 조회
// - 상단 month input 변경 시 다시 로딩
// - "대출 현황" / "상품유형별 대출잔액" 카드 렌더링
// - 슬라이더는 가로 스크롤 + 자동 슬라이드 (3초 간격, 스와이프/스크롤 시 5초간 일시정지)

(function () {
  const API_BASE = "https://huchudb-github-io.vercel.app";

  // 유틸: 숫자 → "18조 3,580억" 형태 (단위는 '억' 기준으로 가정)
  function formatKrwEok(eokValue) {
    if (eokValue == null || isNaN(eokValue)) {
      return { text: "-", number: "-", unit: "" };
    }

    const eok = Number(eokValue);
    const jo = Math.floor(eok / 10000);
    const rest = eok % 10000;

    let text = "";
    if (jo > 0) text += jo.toLocaleString("ko-KR") + "조 ";
    text += rest.toLocaleString("ko-KR") + "억";

    return {
      text,
      number: jo > 0
        ? `${jo.toLocaleString("ko-KR")}조 ${rest.toLocaleString("ko-KR")}억`
        : `${rest.toLocaleString("ko-KR")}억`,
      unit: "" // 이미 포함되어 있으니 별도 단위 문자열은 비움
    };
  }

  // 유틸: "개" 카운트
  function formatCount(n) {
    const num = Number(n || 0);
    return {
      number: num.toLocaleString("ko-KR"),
      unit: "개"
    };
  }

  // 유틸: 전월대비 영역 데이터 가공
  // deltaRateKey / deltaAmountKey 없거나 값이 없으면 "0.00%, 변동 없음"으로 표시
  function buildDelta(summaryOrType, deltaRateKey, deltaAmountKey) {
    const rateRaw =
      (deltaRateKey && summaryOrType && summaryOrType[deltaRateKey]) ?? null;
    const amountRaw =
      (deltaAmountKey && summaryOrType && summaryOrType[deltaAmountKey]) ?? null;

    let rate = null;
    if (rateRaw != null && !isNaN(Number(rateRaw))) {
      rate = Number(rateRaw);
    }

    let amount = null;
    if (amountRaw != null && !isNaN(Number(amountRaw))) {
      amount = Number(amountRaw); // 억 단위로 가정
    }

    // 기본값
    if (rate === null && amount === null) {
      return {
        rateText: "+ 0.00%",
        amountText: "변동 없음",
        cls: "delta-flat",
        arrow: "–"
      };
    }

    // 기호/색상
    let sign = "";
    let cls = "delta-flat";
    let arrow = "–";

    const effectiveRate = rate || 0;
    if (effectiveRate > 0) {
      sign = "+ ";
      cls = "delta-up";
      arrow = "▲";
    } else if (effectiveRate < 0) {
      sign = "- ";
      cls = "delta-down";
      arrow = "▼";
    } else {
      sign = "+ ";
      cls = "delta-flat";
      arrow = "–";
    }

    const absRate = Math.abs(effectiveRate).toFixed(2);
    const rateText = `${sign}${absRate}%`;

    let amountText = "변동 없음";
    if (amount !== null) {
      const absAmount = Math.abs(amount);
      const jo = Math.floor(absAmount / 10000);
      const rest = absAmount % 10000;

      let txt = "";
      if (jo > 0) txt += jo.toLocaleString("ko-KR") + "조 ";
      txt += rest.toLocaleString("ko-KR") + "억";

      amountText = `${txt}`;
    }

    return { rateText, amountText, cls, arrow };
  }

  // DOM 헬퍼
  function qs(sel) {
    return document.querySelector(sel);
  }

  function qsa(sel) {
    return Array.from(document.querySelectorAll(sel));
  }

  // 상단 기준월 텍스트 렌더링
  function renderMonthMeta(month) {
    const text =
      month && typeof month === "string"
        ? `${month.slice(0, 4)}년 ${month.slice(5, 7)}월 기준`
        : "기준월 정보 없음";

    qsa("[data-ontu-month-text]").forEach((el) => {
      el.textContent = text;
    });

    const monthInput = qs("#ontuMonthInput");
    if (month && monthInput && !monthInput.value) {
      // 처음 로딩시에만 기본값 세팅
      monthInput.value = month;
    }
  }

  // 대출 현황 패널 렌더링
  function renderLoanPanel(data) {
    const track = qs("#ontuLoanTrack");
    if (!track) return;

    const summary = data && data.summary ? data.summary : {};

    const cardsConfig = [
      {
        id: "dataFirms",
        label: "데이터수집 온투업체수",
        type: "count",
        unit: "개"
      },
      {
        id: "totalLoan",
        label: "누적 대출금액",
        type: "money",
        deltaRateKey: "totalLoanDeltaRate",
        deltaAmountKey: "totalLoanDeltaAmount"
      },
      {
        id: "totalRepaid",
        label: "누적 상환금액",
        type: "money",
        deltaRateKey: "totalRepaidDeltaRate",
        deltaAmountKey: "totalRepaidDeltaAmount"
      },
      {
        id: "balance",
        label: "대출잔액",
        type: "money",
        deltaRateKey: "balanceDeltaRate",
        deltaAmountKey: "balanceDeltaAmount"
      }
    ];

    const html = cardsConfig
      .map((cfg) => {
        const raw = summary[cfg.id] ?? 0;

        let mainNumber = "-";
        let mainUnit = "";
        if (cfg.type === "count") {
          const f = formatCount(raw);
          mainNumber = f.number;
          mainUnit = f.unit;
        } else {
          const f = formatKrwEok(raw);
          mainNumber = f.number;
          mainUnit = ""; // "조/억"까지 한 줄에 포함되어 있음
        }

        const delta = buildDelta(summary, cfg.deltaRateKey, cfg.deltaAmountKey);

        return `
          <article class="stats-card">
            <div class="stats-card__label">${cfg.label}</div>

            <div class="stats-card__value--main">
              <span class="money-number">${mainNumber}</span>
              ${
                mainUnit
                  ? `<span class="money-unit">${mainUnit}</span>`
                  : ""
              }
            </div>

            <div class="stats-card__bottom-row">
              <div class="stats-card__share">
                <!-- 대출 현황 카드에서는 점유비 텍스트 사용하지 않음 -->
              </div>
              <div class="stats-card__delta-wrap">
                <div class="stats-card__delta-label">전월대비</div>
                <div class="stats-card__delta-rate">${delta.rateText}</div>
                <div class="stats-card__delta ${delta.cls}">
                  <span class="delta-arrow">${delta.arrow}</span>
                  <span class="delta-amount">${delta.amountText}</span>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    track.innerHTML = html;
  }

  // 상품유형별 대출잔액 패널 렌더링
  function renderProductPanel(data) {
    const track = qs("#ontuProductTrack");
    if (!track) return;

    const byType = (data && data.byType) || {};

    const entries = Object.entries(byType);
    if (!entries.length) {
      track.innerHTML =
        '<p style="color:#fff;padding:8px 0;">상품유형별 데이터가 없습니다.</p>';
      return;
    }

    const html = entries
      .map(([name, info]) => {
        const amountEok = info && info.amount ? Number(info.amount) : 0;
        const ratio = info && info.ratio ? Number(info.ratio) : 0;

        const f = formatKrwEok(amountEok);
        const shareText = ratio
          ? `점유비 ${ (ratio * 100).toFixed(1) }%`
          : "";

        const delta = buildDelta(
          info,
          "deltaRate", // 타입별 deltaRate / deltaAmount 를 이런 이름으로 쓴다면 자동 반영
          "deltaAmount"
        );

        return `
          <article class="stats-card stats-card--product">
            <div class="stats-card__label">${name}</div>

            <div class="stats-card__value--main">
              <span class="money-number">${f.number}</span>
            </div>

            <div class="stats-card__bottom-row">
              <div class="stats-card__share">
                ${shareText}
              </div>
              <div class="stats-card__delta-wrap">
                <div class="stats-card__delta-label">전월대비</div>
                <div class="stats-card__delta-rate">${delta.rateText}</div>
                <div class="stats-card__delta ${delta.cls}">
                  <span class="delta-arrow">${delta.arrow}</span>
                  <span class="delta-amount">${delta.amountText}</span>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    track.innerHTML = html;
  }

  // 슬라이더: 가로 스크롤 기반 + 자동 슬라이드
  function setupAutoSlider(panelEl) {
    if (!panelEl) return;

    const viewport = panelEl.querySelector(".stats-panel__viewport");
    const cards = Array.from(panelEl.querySelectorAll(".stats-card"));

    if (!viewport || cards.length <= 1) return;

    let currentIndex = 0;
    let autoTimer = null;
    let resumeTimer = null;

    const scrollToIndex = (idx) => {
      const target = cards[idx];
      if (!target) return;
      const left = target.offsetLeft;
      viewport.scrollTo({
        left,
        behavior: "smooth"
      });
    };

    const startAuto = () => {
      if (autoTimer) return;
      autoTimer = setInterval(() => {
        currentIndex = (currentIndex + 1) % cards.length;
        scrollToIndex(currentIndex);
      }, 3000); // 3초마다 자동 이동
    };

    const stopAuto = () => {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    };

    const pauseAndResume = () => {
      stopAuto();
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        startAuto();
      }, 5000); // 사용자 터치/스크롤 후 5초 뒤 다시 자동 슬라이드
    };

    // 사용자 입력(터치, 드래그, 스크롤) 시 일시 정지
    ["pointerdown", "touchstart", "wheel"].forEach((ev) => {
      viewport.addEventListener(ev, pauseAndResume, { passive: true });
    });

    // 사용자가 직접 좌우로 움직였을 때, 가장 가까운 카드 index 계산
    let scrollDebounce = null;
    viewport.addEventListener(
      "scroll",
      () => {
        if (scrollDebounce) clearTimeout(scrollDebounce);
        scrollDebounce = setTimeout(() => {
          let closestIdx = 0;
          let minDist = Infinity;
          const baseLeft = viewport.scrollLeft;

          cards.forEach((card, idx) => {
            const dist = Math.abs(card.offsetLeft - baseLeft);
            if (dist < minDist) {
              minDist = dist;
              closestIdx = idx;
            }
          });

          currentIndex = closestIdx;
        }, 150);
      },
      { passive: true }
    );

    // 초기 시작
    startAuto();
  }

  function setupAllSliders() {
    const loanPanel = document.querySelector(".stats-panel--loan");
    const productPanel = document.querySelector(".stats-panel--products");
    setupAutoSlider(loanPanel);
    setupAutoSlider(productPanel);
  }

  // 데이터 로딩
  async function loadStats(selectedMonth) {
    try {
      let url = `${API_BASE}/api/ontu-stats`;
      if (selectedMonth) {
        url += `?month=${encodeURIComponent(selectedMonth)}`;
      }

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.error("[ontu-stats] fetch error:", res.status, await res.text());
        // 404 등일 때는 빈 상태로
        return;
      }

      const data = await res.json();
      console.log("[ontu-stats] API response:", data);

      renderMonthMeta(data.month);
      renderLoanPanel(data);
      renderProductPanel(data);

      // 카드 렌더 후 슬라이더 세팅
      setupAllSliders();
    } catch (err) {
      console.error("[ontu-stats] fetch exception:", err);
    }
  }

  // 메뉴 토글 (공통)
  function setupMenu() {
    const btn = qs(".beta-menu-toggle");
    const panel = qs("#betaMenuPanel");
    if (!btn || !panel) return;

    btn.addEventListener("click", () => {
      panel.classList.toggle("hide");
    });

    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("hide")) {
        if (!panel.contains(e.target) && !btn.contains(e.target)) {
          panel.classList.add("hide");
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupMenu();

    const monthInput = qs("#ontuMonthInput");
    if (monthInput) {
      monthInput.addEventListener("change", () => {
        const val = monthInput.value || "";
        loadStats(val || undefined);
      });
    }

    // 최초 로딩: month 파라미터 없으면 latest 사용
    loadStats();
  });
})();
