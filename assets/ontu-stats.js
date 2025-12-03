// /assets/ontu-stats.js
// 온투업 대출 통계 전용 스크립트 (2025-12-03 수정본)

(function () {
  const API_BASE = 'https://huchudb-github-io.vercel.app';
  const API_URL = `${API_BASE}/api/ontu-stats`;

  const monthInput = document.getElementById('ontuMonthInput');
  const loanTrack = document.getElementById('ontuLoanTrack');
  const productTrack = document.getElementById('ontuProductTrack');

  if (!loanTrack || !productTrack) return;

  /* ---------------- 메뉴 토글 (공통 헤더용) ---------------- */

  (function setupMenu() {
    const toggle = document.getElementById('betaMenuToggle');
    const panel = document.getElementById('betaMenuPanel');
    if (!toggle || !panel) return;

    function openMenu() {
      panel.classList.remove('hide');
      toggle.setAttribute('aria-expanded', 'true');
    }
    function closeMenu() {
      panel.classList.add('hide');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      expanded ? closeMenu() : openMenu();
    });

    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('hide')) {
        if (!panel.contains(e.target) && !toggle.contains(e.target)) {
          closeMenu();
        }
      }
    });
  })();

  /* ---------------- 날짜 유틸 ---------------- */

  function formatMonthKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function parseMonthKey(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }

  function getPrevMonthKey(monthKey) {
    const d = parseMonthKey(monthKey);
    d.setMonth(d.getMonth() - 1);
    return formatMonthKey(d);
  }

  /* ---------------- 금액 포맷 (원 → 조/억/만원) ---------------- */

  // amountWon 은 **원 단위** 숫자 (예: 17766071578000)
  function splitKoreanMoney(amountWon) {
    if (!Number.isFinite(amountWon)) {
      return { jo: 0, eok: 0, man: 0 };
    }

    const abs = Math.floor(Math.abs(amountWon));

    const JO_UNIT = 10 ** 12;  // 1조 원
    const EOK_UNIT = 10 ** 8;  // 1억 원
    const MAN_UNIT = 10 ** 4;  // 1만원

    const jo = Math.floor(abs / JO_UNIT);
    const rem1 = abs % JO_UNIT;

    const eok = Math.floor(rem1 / EOK_UNIT);
    const rem2 = rem1 % EOK_UNIT;

    const man = Math.floor(rem2 / MAN_UNIT);

    return { jo, eok, man };
  }

  // 카드 메인 숫자: "17조 7,660억 7,157만원" 처럼 **한 줄**로 보여주기
  function formatKoreanMoneyLine(amountWon) {
    const sign = amountWon < 0 ? '-' : '';
    const { jo, eok, man } = splitKoreanMoney(amountWon);

    const parts = [];
    if (jo) parts.push(`${jo.toLocaleString()}조`);
    if (eok) parts.push(`${eok.toLocaleString()}억`);
    // 만원은 0이라도, 앞에 아무 것도 없으면 0만원은 보여 줌
    if (man || parts.length === 0) {
      parts.push(`${man.toLocaleString()}만원`);
    }

    return sign + parts.join(' ');
  }

  // 전월대비 금액용(절댓값만, 조/억/만원 한 줄)
  function formatDeltaAmount(absWon) {
    return formatKoreanMoneyLine(absWon);
  }

  // 퍼센트: +1.48%, -0.32%, 0.00%
  function formatDeltaRate(current, prev) {
    if (!Number.isFinite(current) || !Number.isFinite(prev) || prev === 0) {
      return '0.00%';
    }
    const diff = current - prev;
    const rate = (diff / prev) * 100;
    const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
    return `${sign}${Math.abs(rate).toFixed(2)}%`;
  }

  /* ---------------- API 호출 ---------------- */

  async function fetchMonthData(monthKey) {
    const url = monthKey ? `${API_URL}?month=${encodeURIComponent(monthKey)}` : API_URL;
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    console.log('[ontu-stats] API response:', json);
    return json;
  }

  /* ---------------- 카드 DOM 생성 ---------------- */

  function createLoanCards(current, prev) {
    const summary = current.summary || {};
    const prevSummary = prev && prev.summary ? prev.summary : null;

    const cards = [];

    // 1) 데이터수집 온투업체수 (개수형)
    const firmCount = Number(summary.dataFirms ?? summary.registeredFirms ?? 0);
    const prevFirmCount = prevSummary
      ? Number(prevSummary.dataFirms ?? prevSummary.registeredFirms ?? 0)
      : null;

    cards.push(createCountCard('데이터수집 온투업체수', firmCount, prevFirmCount));

    // 2) 누적 대출금액
    cards.push(
      createMoneyCard(
        '누적 대출금액',
        Number(summary.totalLoan ?? 0),
        prevSummary ? Number(prevSummary.totalLoan ?? 0) : null,
      ),
    );

    // 3) 누적 상환금액
    cards.push(
      createMoneyCard(
        '누적 상환금액',
        Number(summary.totalRepaid ?? 0),
        prevSummary ? Number(prevSummary.totalRepaid ?? 0) : null,
      ),
    );

    // 4) 대출잔액
    cards.push(
      createMoneyCard(
        '대출잔액',
        Number(summary.balance ?? 0),
        prevSummary ? Number(prevSummary.balance ?? 0) : null,
      ),
    );

    return cards;
  }

  function createProductCards(current, prev) {
    const byType = current.byType || {};
    const prevByType = prev && prev.byType ? prev.byType : {};

    const order = [
      '부동산담보',
      '부동산PF',
      '어음·매출채권담보',
      '기타담보(주식 등)',
      '개인신용',
      '법인신용',
    ];

    const cards = [];

    order.forEach((key) => {
      const cur = byType[key];
      if (!cur) return;

      const curAmount = Number(cur.amount ?? 0);
      const prevAmount = prevByType[key] ? Number(prevByType[key].amount ?? 0) : null;
      const ratio = Number(cur.ratio ?? 0); // 0~1 또는 %

      cards.push(createProductCard(key, curAmount, prevAmount, ratio));
    });

    return cards;
  }

  /* ----- 개수형 카드 (온투업체수) ----- */

  function createCountCard(label, currentValue, prevValue) {
    const diff = prevValue == null ? 0 : currentValue - prevValue;
    const rateText = formatDeltaRate(currentValue, prevValue ?? 0);

    let deltaClass = 'delta-flat';
    let arrow = '–';
    if (diff > 0) {
      deltaClass = 'delta-up';
      arrow = '▲';
    } else if (diff < 0) {
      deltaClass = 'delta-down';
      arrow = '▼';
    }

    const el = document.createElement('article');
    el.className = 'stats-card';

    el.innerHTML = `
      <h3 class="stats-card__label">${label}</h3>
      <div class="stats-card__value--main">
        <span class="stats-card__number">${currentValue.toLocaleString()}</span>
        <span class="stats-card__unit">개</span>
      </div>
      <div class="stats-card__bottom-row">
        <div class="stats-card__share"></div>
        <div class="stats-card__delta-wrap">
          <div class="stats-card__delta-label">전월대비</div>
          <div class="stats-card__delta-rate">${rateText}</div>
          <div class="stats-card__delta ${deltaClass}">
            <span class="stats-card__delta-arrow">${arrow}</span>
            <span class="stats-card__delta-amount">
              ${diff === 0 ? '변동 없음' : `${Math.abs(diff).toLocaleString()}개`}
            </span>
          </div>
        </div>
      </div>
    `;

    return el;
  }

  /* ----- 금액 카드 (조/억/만원 한 줄) ----- */

  function createMoneyCard(label, currentWon, prevWon) {
    const diff = prevWon == null ? 0 : currentWon - prevWon;
    const absDiff = Math.abs(diff);
    const rateText = formatDeltaRate(currentWon, prevWon ?? 0);

    let deltaClass = 'delta-flat';
    let arrow = '–';
    if (diff > 0) {
      deltaClass = 'delta-up';
      arrow = '▲';
    } else if (diff < 0) {
      deltaClass = 'delta-down';
      arrow = '▼';
    }

    const el = document.createElement('article');
    el.className = 'stats-card';

    el.innerHTML = `
      <h3 class="stats-card__label">${label}</h3>
      <div class="stats-card__value--main">
        <span class="money-text">${formatKoreanMoneyLine(currentWon)}</span>
      </div>
      <div class="stats-card__bottom-row">
        <div class="stats-card__share"></div>
        <div class="stats-card__delta-wrap">
          <div class="stats-card__delta-label">전월대비</div>
          <div class="stats-card__delta-rate">${rateText}</div>
          <div class="stats-card__delta ${deltaClass}">
            <span class="stats-card__delta-arrow">${arrow}</span>
            <span class="stats-card__delta-amount">
              ${
                diff === 0
                  ? '변동 없음'
                  : formatDeltaAmount(absDiff)
              }
            </span>
          </div>
        </div>
      </div>
    `;

    return el;
  }

  /* ----- 상품유형별 카드 ----- */

  function createProductCard(label, currentWon, prevWon, ratio) {
    const diff = prevWon == null ? 0 : currentWon - prevWon;
    const absDiff = Math.abs(diff);
    const rateText = formatDeltaRate(currentWon, prevWon ?? 0);

    let deltaClass = 'delta-flat';
    let arrow = '–';
    if (diff > 0) {
      deltaClass = 'delta-up';
      arrow = '▲';
    } else if (diff < 0) {
      deltaClass = 'delta-down';
      arrow = '▼';
    }

    const shareText =
      ratio != null && !Number.isNaN(ratio)
        ? `${(ratio * 100).toFixed(1)}% 점유`
        : '';

    const el = document.createElement('article');
    el.className = 'stats-card stats-card--product';

    el.innerHTML = `
      <h3 class="stats-card__label">${label}</h3>
      <div class="stats-card__value--main">
        <span class="money-text">${formatKoreanMoneyLine(currentWon)}</span>
      </div>
      <div class="stats-card__bottom-row">
        <div class="stats-card__share">${shareText}</div>
        <div class="stats-card__delta-wrap">
          <div class="stats-card__delta-label">전월대비</div>
          <div class="stats-card__delta-rate">${rateText}</div>
          <div class="stats-card__delta ${deltaClass}">
            <span class="stats-card__delta-arrow">${arrow}</span>
            <span class="stats-card__delta-amount">
              ${
                diff === 0
                  ? '변동 없음'
                  : formatDeltaAmount(absDiff)
              }
            </span>
          </div>
        </div>
      </div>
    `;

    return el;
  }

  /* ---------------- 렌더링 ---------------- */

  function renderMonthText(monthKey) {
    const nodes = document.querySelectorAll('[data-ontu-month-text]');
    const d = parseMonthKey(monthKey);
    const text = `${d.getFullYear()}년 ${d.getMonth() + 1}월 기준`;

    nodes.forEach((el) => {
      el.textContent = text;
    });
  }

  function clearTrack(trackEl) {
    while (trackEl.firstChild) trackEl.removeChild(trackEl.firstChild);
  }

  function renderAll(current, prev) {
    const monthKey = current.month;
    if (monthInput) {
      monthInput.value = monthKey;
    }
    renderMonthText(monthKey);

    clearTrack(loanTrack);
    clearTrack(productTrack);

    const loanCards = createLoanCards(current, prev);
    loanCards.forEach((c) => loanTrack.appendChild(c));

    const productCards = createProductCards(current, prev);
    productCards.forEach((c) => productTrack.appendChild(c));

    setupAutoSlider(loanTrack, { pageSizePc: 4, pageSizeMobile: 1 });
    setupAutoSlider(productTrack, { pageSizePc: 4, pageSizeMobile: 1 });
  }

  /* ---------------- 슬라이더 (자동 슬라이드만) ---------------- */

  function setupAutoSlider(trackEl, { pageSizePc, pageSizeMobile }) {
    if (!trackEl) return;
    const viewport = trackEl.parentElement;
    if (!viewport) return;

    let index = 0;
    let timerId = null;

    function getPageSize() {
      return window.innerWidth <= 768 ? pageSizeMobile : pageSizePc;
    }

    function getPageCount() {
      const size = getPageSize();
      const totalCards = trackEl.children.length;
      if (totalCards === 0) return 1;
      return Math.max(1, Math.ceil(totalCards / size));
    }

    function applyTransform() {
      const pageCount = getPageCount();
      if (index >= pageCount) index = 0;
      const percent = index * 100;
      trackEl.style.transition = 'transform 0.4s ease';
      trackEl.style.transform = `translateX(-${percent}%)`;
    }

    function startTimer() {
      if (timerId) clearInterval(timerId);
      timerId = setInterval(() => {
        index = (index + 1) % getPageCount();
        applyTransform();
      }, 3000);
    }

    window.addEventListener('resize', () => {
      // 페이지 개수/폭이 바뀔 수 있으니 현재 인덱스 기준으로 다시 계산
      applyTransform();
    });

    applyTransform();
    startTimer();
  }

  /* ---------------- 초기 로딩 ---------------- */

  async function loadInitial() {
    try {
      // 1) 최신월
      const current = await fetchMonthData();
      const monthKey = current.month;

      // 2) 전월 데이터(있으면)
      let prev = null;
      try {
        const prevKey = getPrevMonthKey(monthKey);
        prev = await fetchMonthData(prevKey);
      } catch (e) {
        // 전월 데이터 없으면 무시
        console.warn('[ontu-stats] no previous month data', e);
      }

      renderAll(current, prev);

      // month 인풋에서 직접 변경했을 때
      if (monthInput) {
        monthInput.addEventListener('change', async (e) => {
          const value = e.target.value;
          if (!value) return;
          try {
            const cur = await fetchMonthData(value);
            let pv = null;
            try {
              const prevKey = getPrevMonthKey(cur.month);
              pv = await fetchMonthData(prevKey);
            } catch (err) {
              console.warn('[ontu-stats] no prev for selected month', err);
            }
            renderAll(cur, pv);
          } catch (err) {
            console.error('[ontu-stats] month change error', err);
          }
        });
      }
    } catch (err) {
      console.error('[ontu-stats] init error', err);
    }
  }

  document.addEventListener('DOMContentLoaded', loadInitial);
})();

/* ======================
 * 온투 통계 슬라이더 유틸
 * ====================== */

(function () {
  /**
   * 슬라이더 세팅
   * @param {string} panelSelector - .stats-panel--loan .stats-panel--products 같은 선택자
   */
  function setupOntuSlider(panelSelector) {
    const panel = document.querySelector(panelSelector);
    if (!panel) return;

    const slider = panel.querySelector(".stats-panel__slider");
    const viewport = slider?.querySelector(".stats-panel__viewport");
    const track = slider?.querySelector(".stats-panel__track");
    if (!viewport || !track) return;

    const cards = Array.from(track.querySelectorAll(".stats-card"));
    if (!cards.length) return;

    let currentIndex = 0;
    let autoTimer = null;
    let isHover = false;

    // --- 자동 슬라이드 ---
    function scrollToIndex(index) {
      const clamped = (index + cards.length) % cards.length;
      currentIndex = clamped;
      const card = cards[clamped];
      const cardRect = card.getBoundingClientRect();
      const vpRect = viewport.getBoundingClientRect();

      // 카드가 뷰포트 가운데쯤 오도록 스크롤
      const offset =
        card.offsetLeft - (vpRect.width - cardRect.width) / 2;

      viewport.scrollTo({
        left: offset,
        behavior: "smooth",
      });
    }

    function startAuto() {
      if (autoTimer) return;
      autoTimer = setInterval(() => {
        if (isHover) return;
        scrollToIndex(currentIndex + 1);
      }, 3000);
    }

    function stopAuto() {
      if (!autoTimer) return;
      clearInterval(autoTimer);
      autoTimer = null;
    }

    // hover 시 자동 슬라이드 일시정지 (PC 에서만 의미 있음)
    slider.addEventListener("mouseenter", () => {
      isHover = true;
    });
    slider.addEventListener("mouseleave", () => {
      isHover = false;
    });

    // --- 드래그로 슬라이드 (마우스) ---
    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;

    viewport.addEventListener("mousedown", (e) => {
      isDown = true;
      startX = e.clientX;
      startScrollLeft = viewport.scrollLeft;
      viewport.classList.add("is-dragging");
      // 자동 슬라이드 잠깐 멈춤
      stopAuto();
    });

    window.addEventListener("mouseup", () => {
      if (!isDown) return;
      isDown = false;
      viewport.classList.remove("is-dragging");
      // 다시 자동 슬라이드 시작
      startAuto();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      viewport.scrollLeft = startScrollLeft - dx;
    });

    // 터치(모바일)는 기본 스크롤만 사용 → 별도 코드는 필요 없음

    // 초기 카드 위치 세팅 + 자동 슬라이드 시작
    scrollToIndex(0);
    startAuto();
  }

  // 페이지 로드 후 슬라이더 세팅
  document.addEventListener("DOMContentLoaded", function () {
    try {
      setupOntuSlider(".stats-panel--loan");
      setupOntuSlider(".stats-panel--products");
    } catch (e) {
      console.error("[ontu-stats] slider error:", e);
    }
  });
})();

