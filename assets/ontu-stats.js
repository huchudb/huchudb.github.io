// /assets/ontu-stats.js
// 온투업 대출 통계(ontu-stats.html) 전용 스크립트

(function () {
  const API_BASE = "https://huchudb-github-io.vercel.app";

  // 이 페이지가 아니면 종료
  if (!document.body.classList.contains("ontu-stats-page")) return;

  // DOM 요소
  const monthInput = document.getElementById("ontuMonthInput");
  const loanTrack = document.getElementById("ontuLoanTrack");
  const productTrack = document.getElementById("ontuProductTrack");

  // 슬라이더 상태
  const loanSlider = { timer: null };
  const productSlider = { timer: null };

  // ---------------- 공통 유틸 ----------------

  function formatKo(num) {
    return Number(num || 0).toLocaleString("ko-KR");
  }

  // month: "2025-11" -> "2025년 11월"
  function formatMonthLabel(month) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return "";
    const [y, m] = month.split("-");
    return `${y}년 ${Number(m)}월`;
  }

  // 이전 달 계산: "2025-11" -> "2025-10"
  function getPrevMonthKey(month) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
    let [y, m] = month.split("-").map(Number);
    m -= 1;
    if (m === 0) {
      y -= 1;
      m = 12;
    }
    return `${y}-${String(m).padStart(2, "0")}`;
  }

  // 금액(만원 단위) -> "18조 3,580억 7,530만원" 형태로 변환
function splitJoEok(amountWan) {
  const n = Number(amountWan || 0);
  if (!isFinite(n) || n <= 0) {
    return { numberText: "0만원", unitText: "" };
  }

  // 1조 = 100,000,000만원, 1억 = 10,000만원
  const JO_UNIT = 100000000;
  const EOK_UNIT = 10000;

  let jo = Math.floor(n / JO_UNIT);
  let rest = n % JO_UNIT;
  let eok = Math.floor(rest / EOK_UNIT);
  let man = rest % EOK_UNIT; // 남은 만원 단위

  // 혹시라도 반올림을 나중에 쓰게 되면 여기에서 보정하면 됨

  const parts = [];
  if (jo > 0) parts.push(`${formatKo(jo)}조`);
  if (eok > 0) parts.push(`${formatKo(eok)}억`);
  if (man > 0) parts.push(`${formatKo(man)}만원`);

  const joined = parts.length ? parts.join(" ") : "0만원";

  return {
    // 숫자+단위를 한 줄로 붙여 쓰기 위해 numberText에 다 넣고 unitText는 비워둔다
    numberText: joined,
    unitText: "",
  };
}

  // 전월대비 계산
  // current / prev => { rateText, amountText, cls, arrow }
  function calcDelta(current, prev, isMoney) {
    const cur = Number(current || 0);
    const prv = Number(prev || 0);

    if (!prv) {
      // 직전 데이터 없으면 항상 0, 보합 처리
      return {
        rateText: "(0.00%)",
        amountText: isMoney ? "변동 없음" : "변동 없음",
        cls: "delta-flat",
        arrow: "–",
      };
    }

    const diff = cur - prv;
    if (diff === 0) {
      return {
        rateText: "(0.00%)",
        amountText: "변동 없음",
        cls: "delta-flat",
        arrow: "–",
      };
    }

    const rate = (diff / prv) * 100;
    const sign = diff > 0 ? "+" : "-";
    const cls = diff > 0 ? "delta-up" : "delta-down";
    const arrow = diff > 0 ? "▲" : "▼";

    let amountText;
    if (isMoney) {
      // 금액일 경우: "53억 6,539만원" 비슷하게 조/억까지 표시
      const abs = Math.abs(diff);
      const splitted = splitJoEok(abs);
      amountText = splitted.numberText || formatKo(abs);
    } else {
      amountText = `${formatKo(Math.abs(diff))}`;
    }

    return {
      rateText: `(${sign}${Math.abs(rate).toFixed(2)}%)`,
      amountText,
      cls,
      arrow,
    };
  }

  // ---------------- 카드 렌더링 ----------------

  function createLoanCards(current, previous) {
    if (!loanTrack) return;
    loanTrack.innerHTML = "";

    const sumCur = current?.summary || {};
    const sumPrev = previous?.summary || {};

    const cards = [
      {
        key: "dataFirms",
        label: "데이터수집 온투업체수",
        isMoney: false,
        value: sumCur.dataFirms ?? 0,
        prevValue: sumPrev.dataFirms ?? 0,
        unit: "개",
      },
      {
        key: "totalLoan",
        label: "누적 대출금액",
        isMoney: true,
        value: sumCur.totalLoan ?? 0,
        prevValue: sumPrev.totalLoan ?? 0,
      },
      {
        key: "totalRepaid",
        label: "누적 상환금액",
        isMoney: true,
        value: sumCur.totalRepaid ?? 0,
        prevValue: sumPrev.totalRepaid ?? 0,
      },
      {
        key: "balance",
        label: "대출잔액",
        isMoney: true,
        value: sumCur.balance ?? 0,
        prevValue: sumPrev.balance ?? 0,
      },
    ];

    cards.forEach((cfg) => {
      const card = document.createElement("article");
      card.className = "stats-card";

      const labelEl = document.createElement("h3");
      labelEl.className = "stats-card__label";
      labelEl.textContent = cfg.label;

      const valueWrap = document.createElement("div");
      valueWrap.className = "stats-card__value--main";

      const numSpan = document.createElement("span");
      numSpan.className = "money-number";

      const unitSpan = document.createElement("span");
      unitSpan.className = "money-unit";

      if (cfg.isMoney) {
        const splitted = splitJoEok(cfg.value);
        numSpan.textContent = splitted.numberText;
        unitSpan.textContent = splitted.unitText; // 현재는 빈 문자열
      } else {
        numSpan.textContent = formatKo(cfg.value);
        unitSpan.textContent = cfg.unit || "";
      }

      valueWrap.appendChild(numSpan);
      valueWrap.appendChild(unitSpan);

      // 하단: (좌) 점유비(여기선 없음), (우) 전월대비 블럭
      const bottomRow = document.createElement("div");
      bottomRow.className = "stats-card__bottom-row";

      const shareEl = document.createElement("div");
      shareEl.className = "stats-card__share";
      shareEl.textContent = ""; // 대출 현황에서는 사용 안 함

      const deltaWrap = document.createElement("div");
      deltaWrap.className = "stats-card__delta-wrap";

      const deltaLabel = document.createElement("div");
      deltaLabel.className = "stats-card__delta-label";
      deltaLabel.textContent = "전월대비";

      const deltaCalc = calcDelta(cfg.value, cfg.prevValue, cfg.isMoney);

      const deltaRate = document.createElement("div");
      deltaRate.className = `stats-card__delta-rate ${deltaCalc.cls}`;
      deltaRate.textContent = deltaCalc.rateText; // (+x.xx%)

      const deltaLine = document.createElement("div");
      deltaLine.className = `stats-card__delta ${deltaCalc.cls}`;

      const arrowSpan = document.createElement("span");
      arrowSpan.className = "delta-arrow";
      arrowSpan.textContent = deltaCalc.arrow;

      const amountSpan = document.createElement("span");
      amountSpan.className = "delta-amount";
      amountSpan.textContent = deltaCalc.amountText;

      deltaLine.appendChild(arrowSpan);
      deltaLine.appendChild(amountSpan);

      deltaWrap.appendChild(deltaLabel);
      deltaWrap.appendChild(deltaRate);
      deltaWrap.appendChild(deltaLine);

      bottomRow.appendChild(shareEl);
      bottomRow.appendChild(deltaWrap);

      card.appendChild(labelEl);
      card.appendChild(valueWrap);
      card.appendChild(bottomRow);

      loanTrack.appendChild(card);
    });
  }

  function createProductCards(current, previous) {
    if (!productTrack) return;
    productTrack.innerHTML = "";

    const curByType = current?.byType || {};
    const prevByType = previous?.byType || {};

    const entries = Object.entries(curByType);
    if (!entries.length) return;

    entries.forEach(([name, cur]) => {
      const prev = prevByType[name] || {};
      const ratio = Number(cur.ratio || 0); // 0~1
      const amount = cur.amount || 0;
      const prevAmount = prev.amount || 0;

      const card = document.createElement("article");
      card.className = "stats-card stats-card--product";

      const labelEl = document.createElement("h3");
      labelEl.className = "stats-card__label";
      labelEl.textContent = name;

      const valueWrap = document.createElement("div");
      valueWrap.className = "stats-card__value--main";

      const numSpan = document.createElement("span");
      numSpan.className = "money-number";

      const unitSpan = document.createElement("span");
      unitSpan.className = "money-unit";

      const split = splitJoEok(amount);
      numSpan.textContent = split.numberText;
      unitSpan.textContent = split.unitText;

      valueWrap.appendChild(numSpan);
      valueWrap.appendChild(unitSpan);

      const bottomRow = document.createElement("div");
      bottomRow.className = "stats-card__bottom-row";

      const shareEl = document.createElement("div");
      shareEl.className = "stats-card__share";
      shareEl.textContent = `점유비 ${ (ratio * 100).toFixed(1) }%`;

      const deltaWrap = document.createElement("div");
      deltaWrap.className = "stats-card__delta-wrap";

      const deltaLabel = document.createElement("div");
      deltaLabel.className = "stats-card__delta-label";
      deltaLabel.textContent = "전월대비";

      const deltaCalc = calcDelta(amount, prevAmount, true);

      const deltaRate = document.createElement("div");
      deltaRate.className = `stats-card__delta-rate ${deltaCalc.cls}`;
      deltaRate.textContent = deltaCalc.rateText;

      const deltaLine = document.createElement("div");
      deltaLine.className = `stats-card__delta ${deltaCalc.cls}`;

      const arrowSpan = document.createElement("span");
      arrowSpan.className = "delta-arrow";
      arrowSpan.textContent = deltaCalc.arrow;

      const amountSpan = document.createElement("span");
      amountSpan.className = "delta-amount";
      amountSpan.textContent = deltaCalc.amountText;

      deltaLine.appendChild(arrowSpan);
      deltaLine.appendChild(amountSpan);

      deltaWrap.appendChild(deltaLabel);
      deltaWrap.appendChild(deltaRate);
      deltaWrap.appendChild(deltaLine);

      bottomRow.appendChild(shareEl);
      bottomRow.appendChild(deltaWrap);

      card.appendChild(labelEl);
      card.appendChild(valueWrap);
      card.appendChild(bottomRow);

      productTrack.appendChild(card);
    });
  }

  // ---------------- 자동 슬라이드 ----------------

  function setupAutoSlider(track, sliderState) {
    if (!track) return;

    const viewport = track.parentElement;
    if (!viewport) return;

    // 하단 회색 막대, 버튼 강제 숨김(혹시 남아있을 수도 있어서)
    const sliderContainer = viewport.parentElement;
    if (sliderContainer && sliderContainer.classList.contains("stats-panel__slider")) {
      sliderContainer.classList.add("ontu-slider-no-rail");
    }

    viewport.style.overflowX = "auto";
    viewport.style.scrollBehavior = "smooth";

    const cards = Array.from(track.querySelectorAll(".stats-card"));
    const total = cards.length;

    if (total <= 1) return;

    let index = 0;
    let manualTouched = false;

    function goTo(idx) {
      if (!total) return;
      index = (idx + total) % total;
      const card = cards[index];
      const left = card.offsetLeft;
      viewport.scrollTo({ left, behavior: "smooth" });
    }

    function resetTimer() {
      manualTouched = true;
      if (sliderState.timer) {
        clearInterval(sliderState.timer);
        sliderState.timer = null;
      }
      // 5초 뒤 다시 자동 슬라이드 재개
      setTimeout(() => {
        manualTouched = false;
        startTimer();
      }, 5000);
    }

    function startTimer() {
      if (sliderState.timer || manualTouched) return;
      sliderState.timer = setInterval(() => {
        goTo(index + 1);
      }, 3000);
    }

    // 터치/스크롤 시 자동 슬라이드 잠시 중지
    viewport.addEventListener("touchstart", resetTimer, { passive: true });
    viewport.addEventListener("wheel", resetTimer, { passive: true });
    viewport.addEventListener("scroll", () => {
      if (!manualTouched) return;
    }, { passive: true });

    startTimer();
  }

  // ---------------- API ----------------

  async function fetchStats(month) {
    const qs = month ? `?month=${encodeURIComponent(month)}` : "";
    const res = await fetch(`${API_BASE}/api/ontu-stats${qs}`, {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
    });

    if (res.status === 404) {
      console.warn("[ontu-stats] 해당 월 데이터 없음:", month);
      return null;
    }

    if (!res.ok) {
      throw new Error(`API error ${res.status}`);
    }

    const json = await res.json();
    console.log("[ontu-stats] API response:", json);
    return json;
  }

  async function loadAndRender(selectedMonth) {
    try {
      const current = await fetchStats(selectedMonth || "");
      if (!current || !current.month) {
        console.warn("[ontu-stats] 통계 데이터가 없습니다.");
        return;
      }

      // month input에 값 세팅
      if (!selectedMonth && monthInput) {
        monthInput.value = current.month;
      }

      // 기준월 텍스트 표시 (상단 패널 meta는 숨겨둔 상태지만 데이터는 맞춰줌)
      document
        .querySelectorAll("[data-ontu-month-text]")
        .forEach((el) => (el.textContent = formatMonthLabel(current.month)));

      // 이전 월 데이터 불러와서 전월대비 계산
      const prevMonthKey = getPrevMonthKey(current.month);
      const prevData = prevMonthKey ? await fetchStats(prevMonthKey) : null;

      createLoanCards(current, prevData);
      createProductCards(current, prevData);

      // 슬라이더(PC/모바일 공통 자동 슬라이드 + 터치/스크롤 시 멈춤)
      setupAutoSlider(loanTrack, loanSlider);
      setupAutoSlider(productTrack, productSlider);
    } catch (err) {
      console.error("[ontu-stats] load error:", err);
    }
  }

  // ---------------- 메뉴 토글 ----------------

  function setupMenu() {
    const btn = document.getElementById("betaMenuToggle");
    const panel = document.getElementById("betaMenuPanel");
    if (!btn || !panel) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = panel.classList.contains("hide");
      panel.classList.toggle("hide", !isHidden);
      btn.setAttribute("aria-expanded", String(isHidden));
    });

    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("hide")) {
        if (!panel.contains(e.target) && e.target !== btn) {
          panel.classList.add("hide");
          btn.setAttribute("aria-expanded", "false");
        }
      }
    });
  }

  // ---------------- 초기화 ----------------

  document.addEventListener("DOMContentLoaded", () => {
    setupMenu();

    // month 인풋 변경 시 해당 월 재조회
    if (monthInput) {
      monthInput.addEventListener("change", () => {
        const val = monthInput.value || "";
        loadAndRender(val);
      });
    }

    // 최초 로드: latest 월 사용
    loadAndRender("");
  });
})();
