// /assets/ontu-stats.js
// 온투업 대출 통계 전용 스크립트 (없는 월 Empty State 심플 카드 버전)

(function () {
  const API_BASE = 'https://huchudb-github-io.vercel.app';
  const API_URL = `${API_BASE}/api/ontu-stats`;

  const monthInput   = document.getElementById('ontuMonthInput');
  const loanTrack    = document.getElementById('ontuLoanTrack');
  const productTrack = document.getElementById('ontuProductTrack');

  if (!loanTrack || !productTrack) return;

  /* ---------------- 공통: 안전한 숫자 변환 ---------------- */

  function toNumberSafe(value) {
    if (value == null) return 0;

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.-]/g, '');
      if (!cleaned) return 0;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }

    return 0;
  }

  ;

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

  function splitKoreanMoney(amountWon) {
    if (!Number.isFinite(amountWon)) {
      return { jo: 0, eok: 0, man: 0 };
    }

    const abs = Math.floor(Math.abs(amountWon));

    const JO_UNIT  = 10 ** 12; // 1조
    const EOK_UNIT = 10 ** 8;  // 1억
    const MAN_UNIT = 10 ** 4;  // 1만원

    const jo   = Math.floor(abs / JO_UNIT);
    const rem1 = abs % JO_UNIT;

    const eok  = Math.floor(rem1 / EOK_UNIT);
    const rem2 = rem1 % EOK_UNIT;

    const man  = Math.floor(rem2 / MAN_UNIT);

    return { jo, eok, man };
  }

  function formatKoreanMoneyLine(amountWonRaw) {
    const amountWon = toNumberSafe(amountWonRaw);
    const sign = amountWon < 0 ? '-' : '';
    const { jo, eok, man } = splitKoreanMoney(amountWon);

    const parts = [];
    if (jo)  parts.push(`${jo.toLocaleString()}조`);
    if (eok) parts.push(`${eok.toLocaleString()}억`);
    if (man || parts.length === 0) {
      parts.push(`${man.toLocaleString()}만원`);
    }

    return sign + parts.join(' ');
  }

  function formatDeltaAmount(absWonRaw) {
    return formatKoreanMoneyLine(absWonRaw);
  }

  function formatDeltaRate(currentRaw, prevRaw) {
    const current = toNumberSafe(currentRaw);
    const prev    = toNumberSafe(prevRaw);

    if (!Number.isFinite(current) || !Number.isFinite(prev) || prev <= 0) {
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
    const summary     = current.summary || {};
    const prevSummary = prev && prev.summary ? prev.summary : null;

    const cards = [];

    const firmCount = toNumberSafe(
      summary.dataFirms ?? summary.registeredFirms ?? 0,
    );
    const prevFirmCount = prevSummary
      ? toNumberSafe(
          prevSummary.dataFirms ?? prevSummary.registeredFirms ?? 0,
        )
      : null;

    cards.push(createCountCard('데이터수집 온투업체수', firmCount, prevFirmCount));

    cards.push(
      createMoneyCard(
        '누적 대출금액',
        toNumberSafe(summary.totalLoan),
        prevSummary ? toNumberSafe(prevSummary.totalLoan) : null,
      ),
    );

    cards.push(
      createMoneyCard(
        '누적 상환금액',
        toNumberSafe(summary.totalRepaid),
        prevSummary ? toNumberSafe(prevSummary.totalRepaid) : null,
      ),
    );

    cards.push(
      createMoneyCard(
        '대출잔액',
        toNumberSafe(summary.balance),
        prevSummary ? toNumberSafe(prevSummary.balance) : null,
      ),
    );

    return cards;
  }

  function createProductCards(current, prev) {
    const byType     = current.byType || {};
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

      const curAmount  = toNumberSafe(cur.amount);
      const prevAmount = prevByType[key]
        ? toNumberSafe(prevByType[key].amount)
        : null;

      let ratio = cur.ratio != null ? toNumberSafe(cur.ratio) : 0;
      if (ratio > 1) ratio = ratio / 100;

      cards.push(createProductCard(key, curAmount, prevAmount, ratio));
    });

    return cards;
  }

  /* ----- 개수형 카드 ----- */

  function createCountCard(label, currentValueRaw, prevValueRaw) {
    const currentValue = toNumberSafe(currentValueRaw);
    const prevValue    = prevValueRaw == null ? null : toNumberSafe(prevValueRaw);

    const diff     = prevValue == null ? 0 : currentValue - prevValue;
    const rateText = formatDeltaRate(currentValue, prevValue ?? 0);

    let deltaClass = 'delta-flat';
    let arrow      = '–';
    if (diff > 0) {
      deltaClass = 'delta-up';
      arrow      = '▲';
    } else if (diff < 0) {
      deltaClass = 'delta-down';
      arrow      = '▼';
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

  /* ----- 금액 카드 ----- */

  function createMoneyCard(label, currentWonRaw, prevWonRaw) {
    const currentWon = toNumberSafe(currentWonRaw);
    const prevWon    = prevWonRaw == null ? null : toNumberSafe(prevWonRaw);

    const diff    = prevWon == null ? 0 : currentWon - prevWon;
    const absDiff = Math.abs(diff);
    const rateText = formatDeltaRate(currentWon, prevWon ?? 0);

    let deltaClass = 'delta-flat';
    let arrow      = '–';
    if (diff > 0) {
      deltaClass = 'delta-up';
      arrow      = '▲';
    } else if (diff < 0) {
      deltaClass = 'delta-down';
      arrow      = '▼';
    }

    let mainText = formatKoreanMoneyLine(currentWon);
    if (!mainText || mainText === '-' || mainText === 'NaN만원') {
      mainText = `${currentWon.toLocaleString('ko-KR')}원`;
    }

    const el = document.createElement('article');
    el.className = 'stats-card';

    el.innerHTML = `
      <h3 class="stats-card__label">${label}</h3>
      <div class="stats-card__value--main">
        <span class="money-text">${mainText}</span>
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

  function createProductCard(label, currentWonRaw, prevWonRaw, ratioRaw) {
    const currentWon = toNumberSafe(currentWonRaw);
    const prevWon    = prevWonRaw == null ? null : toNumberSafe(prevWonRaw);

    const diff    = prevWon == null ? 0 : currentWon - prevWon;
    const absDiff = Math.abs(diff);
    const rateText = formatDeltaRate(currentWon, prevWon ?? 0);

    let deltaClass = 'delta-flat';
    let arrow      = '–';
    if (diff > 0) {
      deltaClass = 'delta-up';
      arrow      = '▲';
    } else if (diff < 0) {
      deltaClass = 'delta-down';
      arrow      = '▼';
    }

    let ratio = ratioRaw != null ? toNumberSafe(ratioRaw) : 0;
    if (ratio > 1) ratio = ratio / 100;
    const shareText =
      ratio > 0 ? `${(ratio * 100).toFixed(1)}% 점유` : '';

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

  /* ----- 데이터 없는 월용 Empty State 카드 (심플 텍스트 2줄) ----- */

  function createEmptyStateCard() {
    const el = document.createElement('article');
    el.className = 'stats-card stats-card--empty';

    el.innerHTML = `
      <div class="stats-card__empty-inner">
        <p class="stats-card__empty-line">표시할 통계 데이터가 없습니다.</p>
        <p class="stats-card__empty-line">다른 년/월을 선택해 주세요.</p>
      </div>
    `;

    return el;
  }

  /* ---------------- 렌더링 ---------------- */

  function renderMonthText(monthKey) {
    const nodes = document.querySelectorAll('[data-ontu-month-text]');
    if (!monthKey) return;
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
    if (monthInput && monthKey) {
      monthInput.value = monthKey;
    }
    renderMonthText(monthKey);

    clearTrack(loanTrack);
    clearTrack(productTrack);

    const loanCards = createLoanCards(current, prev);
    loanCards.forEach((c) => loanTrack.appendChild(c));

    const productCards = createProductCards(current, prev);
    productCards.forEach((c) => productTrack.appendChild(c));

    if (typeof window !== 'undefined' && typeof window.initOntuStatsSliders === 'function') {
      window.initOntuStatsSliders();
    }

    document.dispatchEvent(new CustomEvent('ontuStatsRendered'));
  }

  function renderEmptyState() {
    clearTrack(loanTrack);
    clearTrack(productTrack);

    const loanEmptyCard = createEmptyStateCard();
    const productEmptyCard = createEmptyStateCard();

    loanTrack.appendChild(loanEmptyCard);
    productTrack.appendChild(productEmptyCard);

    if (typeof window !== 'undefined' && typeof window.initOntuStatsSliders === 'function') {
      window.initOntuStatsSliders();
    }
    document.dispatchEvent(new CustomEvent('ontuStatsRendered'));
  }

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
      const current = await fetchMonthData();
      const monthKey = current.month;

      let prev = null;
      try {
        const prevKey = getPrevMonthKey(monthKey);
        prev = await fetchMonthData(prevKey);
      } catch (e) {
        console.warn('[ontu-stats] no previous month data', e);
      }

      renderAll(current, prev);

      if (monthInput) {
        monthInput.addEventListener('change', async (e) => {
          const raw   = e.target.value;
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
            // 없는 월 → 심플 Empty 카드
            renderEmptyState();
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
 * 온투 통계 슬라이더 유틸 (카드 1장 단위 슬라이드)
 * ====================== */

(function () {
  function setupStatsSlider(panelSelector) {
    const panel = document.querySelector(panelSelector);
    if (!panel) return;

    if (panel.dataset.ontuSliderInitialized === 'true') return;
    panel.dataset.ontuSliderInitialized = 'true';

    const slider   = panel.querySelector('.stats-panel__slider');
    const viewport = slider?.querySelector('.stats-panel__viewport');
    const track    = slider?.querySelector('.stats-panel__track');
    if (!viewport || !track) return;

    let currentIndex = 0;
    let autoTimer    = null;
    let autoDir      = 1;

    const isMobileNow = () =>
      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ||
      window.innerWidth <= 768;

    function getCards() {
      return Array.from(track.querySelectorAll('.stats-card'));
    }
    function getCardCount() {
      return getCards().length;
    }
    function hasOverflow() {
      return track.scrollWidth > viewport.clientWidth + 2;
    }

    function nearestIndex() {
      const cards = getCards();
      const total = cards.length;
      if (!total) return 0;

      const center = viewport.scrollLeft + viewport.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;

      for (let i = 0; i < total; i++) {
        const card = cards[i];
        const c = card.offsetLeft + card.clientWidth / 2;
        const d = Math.abs(c - center);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    }

    function scrollToIndex(newIndex, opts) {
      const options = Object.assign({ smooth: true }, opts || {});
      const cards = getCards();
      const total = cards.length;
      if (!total) return;

      const normalized = ((newIndex % total) + total) % total;
      currentIndex = normalized;

      const card = cards[normalized];
      const left = card.offsetLeft - (viewport.clientWidth / 2 - card.clientWidth / 2);

      viewport.scrollTo({
        left: Math.max(0, left),
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

      // 모바일에서만 + 오버플로우가 있을 때만 자동 슬라이드(5초 핑퐁)
      if (!isMobileNow() || !hasOverflow()) return;

      const total = getCardCount();
      if (total <= 1) return;

      autoTimer = setInterval(() => {
        const t = getCardCount();
        if (t <= 1) return;

        let next = currentIndex + autoDir;

        if (next >= t - 1) {
          autoDir = -1;
          next = t - 1;
        } else if (next <= 0) {
          autoDir = 1;
          next = 0;
        }

        currentIndex = next;
        scrollToIndex(currentIndex, { smooth: true });
      }, 5000);
    }

    // ---------------------------
    // Natural drag-to-scroll
    // ---------------------------
    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;
    let lastX = 0;

    const threshold = 55; // swipe step threshold (mobile)

    function onDown(clientX) {
      if (!hasOverflow()) return;

      isDown = true;
      startX = clientX;
      lastX = clientX;
      startScrollLeft = viewport.scrollLeft;

      viewport.classList.add('is-dragging');
      stopAuto();
    }

    function onMove(clientX) {
      if (!isDown) return;

      const dx = clientX - startX;
      lastX = clientX;
      viewport.scrollLeft = startScrollLeft - dx;
    }

    function onUp() {
      if (!isDown) return;

      isDown = false;
      viewport.classList.remove('is-dragging');

      // 모바일에서만 스냅(데스크탑은 자연 스크롤 유지)
      if (isMobileNow() && hasOverflow()) {
        const dx = lastX - startX;
        const base = nearestIndex();

        if (Math.abs(dx) > threshold) {
          const step = dx < 0 ? 1 : -1; // drag left => next
          scrollToIndex(base + step, { smooth: true });
        } else {
          scrollToIndex(base, { smooth: true });
        }
      }

      startAuto();
    }

    // Pointer events (covers mouse + touch in modern browsers)
    viewport.addEventListener('pointerdown', (e) => {
      // only left click for mouse
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // prevent text selection / stray clicks while dragging
      e.preventDefault();
      onDown(e.clientX);
    });
    window.addEventListener('pointermove', (e) => {
      onMove(e.clientX);
    });
    window.addEventListener('pointerup', () => {
      onUp();
    });
    window.addEventListener('pointercancel', () => {
      onUp();
    });

    // Wheel: vertical wheel -> horizontal scroll (desktop usability)
    viewport.addEventListener(
      'wheel',
      (e) => {
        if (!hasOverflow()) return;
        // If user already scrolls horizontally, allow it.
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          viewport.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // Keep currentIndex in sync (used by mobile auto ping-pong)
    let raf = null;
    viewport.addEventListener(
      'scroll',
      () => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          currentIndex = nearestIndex();
        });
      },
      { passive: true }
    );

    // Initialize
    currentIndex = nearestIndex();
    startAuto();

    window.addEventListener(
      'resize',
      () => {
        currentIndex = nearestIndex();
        startAuto();
      },
      { passive: true }
    );
  }

  function initOntuStatsSliders() {
    try {
      setupStatsSlider('.stats-panel--loan');
      setupStatsSlider('.stats-panel--products');
    } catch (e) {
      console.error('[ontu-stats] slider init error:', e);
    }
  }

  window.initOntuStatsSliders = initOntuStatsSliders;
})();
