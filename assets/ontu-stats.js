// /assets/ontu-stats.js
// 온투업 대출 통계 전용 스크립트 (2025-12-04 재정비본)

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

    const JO_UNIT = 10 ** 12; // 1조 원
    const EOK_UNIT = 10 ** 8; // 1억 원
    const MAN_UNIT = 10 ** 4; // 1만원

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
    const url = monthKey
      ? `${API_URL}?month=${encodeURIComponent(monthKey)}`
      : API_URL;
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
      const prevAmount = prevByType[key]
        ? Number(prevByType[key].amount ?? 0)
        : null;
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
              ${
                diff === 0
                  ? '변동 없음'
                  : `${Math.abs(diff).toLocaleString()}개`
              }
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

    // 카드가 렌더링된 이후 슬라이더 초기화
    if (typeof window !== 'undefined' && typeof window.initOntuStatsSliders === 'function') {
      window.initOntuStatsSliders();
    }
  }

    // "2025-10" 또는 "2025-10-01" -> "2025-10" 으로 정규화
  function normalizeMonthKey(raw) {
    if (!raw) return '';
    const parts = raw.split('-');
    if (parts.length >= 2) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      return `${y}-${m}`;
    }
    return raw;
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
          // 입력값 정규화
          const raw = e.target.value;
          const value = normalizeMonthKey(raw);
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

  document.addEventListener('DOMContentLoaded', loadInitial);
})();

/* ======================
 * 온투 통계 슬라이더 유틸 (카드 1장 단위 슬라이드)
 * ====================== */

(function () {
  /**
   * 개별 패널 슬라이더 세팅
   * @param {string} panelSelector - .stats-panel--loan / .stats-panel--products
   */
  function setupStatsSlider(panelSelector) {
    const panel = document.querySelector(panelSelector);
    if (!panel) return;

    // 이미 초기화된 패널이면 다시 바인딩하지 않음
    if (panel.dataset.ontuSliderInitialized === 'true') return;
    panel.dataset.ontuSliderInitialized = 'true';

    const slider = panel.querySelector('.stats-panel__slider');
    const viewport = slider?.querySelector('.stats-panel__viewport');
    const track = slider?.querySelector('.stats-panel__track');
    if (!viewport || !track) return;

    let currentIndex = 0;
    let autoTimer = null;

    let isPointerDown = false;
    let startX = 0;
    let deltaX = 0;

    function getCards() {
      return Array.from(track.querySelectorAll('.stats-card'));
    }

    function scrollToIndex(newIndex, opts) {
      const options = Object.assign({ smooth: true }, opts || {});
      const cards = getCards();
      const total = cards.length;
      if (!total) return;

      const normalized =
        ((newIndex % total) + total) % total; // 음수 인덱스 보정
      currentIndex = normalized;

      const card = cards[normalized];
      const cardRect = card.getBoundingClientRect();
      const vpRect = viewport.getBoundingClientRect();

      const offset =
        card.offsetLeft - (vpRect.width - cardRect.width) / 2;

      viewport.scrollTo({
        left: offset,
        behavior: options.smooth ? 'smooth' : 'auto',
      });
    }

    function stopAuto() {
      if (!autoTimer) return;
      clearInterval(autoTimer);
      autoTimer = null;
    }

    function startAuto() {
      stopAuto();
      autoTimer = setInterval(() => {
        scrollToIndex(currentIndex + 1, { smooth: true });
      }, 4000);
    }

    // 공통 포인터 로직 (마우스 + 터치)
    function onPointerDown(clientX) {
      isPointerDown = true;
      startX = clientX;
      deltaX = 0;
      stopAuto();
    }

    function onPointerMove(clientX) {
      if (!isPointerDown) return;
      deltaX = clientX - startX;
    }

    function onPointerUp() {
      if (!isPointerDown) return;
      isPointerDown = false;

      const threshold = viewport.offsetWidth * 0.15; // 뷰포트 폭의 15% 이상 스와이프 시 페이지 전환

      if (deltaX > threshold) {
        // 오른쪽으로 스와이프 → 이전 카드
        scrollToIndex(currentIndex - 1);
      } else if (deltaX < -threshold) {
        // 왼쪽으로 스와이프 → 다음 카드
        scrollToIndex(currentIndex + 1);
      } else {
        // 애매하면 제자리 카드로 스냅
        scrollToIndex(currentIndex);
      }

      startAuto();
    }

    // 마우스 이벤트
    viewport.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onPointerDown(e.clientX);
    });
    window.addEventListener('mousemove', (e) => {
      onPointerMove(e.clientX);
    });
    window.addEventListener('mouseup', () => {
      onPointerUp();
    });

    // 터치 이벤트
    viewport.addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        if (!t) return;
        onPointerDown(t.clientX);
      },
      { passive: true },
    );
    window.addEventListener(
      'touchmove',
      (e) => {
        const t = e.touches[0];
        if (!t) return;
        onPointerMove(t.clientX);
      },
      { passive: true },
    );
    window.addEventListener('touchend', () => {
      onPointerUp();
    });

    // PC에서 hover 시 자동 슬라이드 일시정지
    slider.addEventListener('mouseenter', stopAuto);
    slider.addEventListener('mouseleave', startAuto);

    // 리사이즈 시 현재 카드 기준으로 다시 정렬 (걸쳐 보이는 문제 방지)
    window.addEventListener('resize', () => {
      scrollToIndex(currentIndex, { smooth: false });
    });

    // 초기 위치 & 자동 슬라이드 시작
    setTimeout(() => {
      scrollToIndex(0, { smooth: false });
      startAuto();
    }, 0);
  }

  function initOntuStatsSliders() {
    try {
      setupStatsSlider('.stats-panel--loan');
      setupStatsSlider('.stats-panel--products');
    } catch (e) {
      console.error('[ontu-stats] slider init error:', e);
    }
  }

  // 전역에서 호출할 수 있도록 노출
  window.initOntuStatsSliders = initOntuStatsSliders;
})();
