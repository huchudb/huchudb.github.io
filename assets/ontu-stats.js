// /assets/ontu-stats.js
// 온투업 대출 통계 전용 스크립트 (2025-12-04 재정비본 + 숫자 변환 안정화)

(function () {
  const API_BASE = 'https://huchudb-github-io.vercel.app';
  const API_URL = `${API_BASE}/api/ontu-stats`;

  const monthInput   = document.getElementById('ontuMonthInput');
  const loanTrack    = document.getElementById('ontuLoanTrack');
  const productTrack = document.getElementById('ontuProductTrack');

  if (!loanTrack || !productTrack) return;

  /* ---------------- 공통: 안전한 숫자 변환 ---------------- */

  // "12,345,678", " 12345 ", 12345 → 12345
  // 이상한 값이면 0으로 처리
  function toNumberSafe(value) {
    if (value == null) return 0;

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.-]/g, ''); // 숫자/부호만 남김
      if (!cleaned) return 0;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }

    return 0;
  }

  /* ---------------- 메뉴 토글 (공통 헤더용) ---------------- */

  (function setupMenu() {
    const toggle = document.getElementById('betaMenuToggle');
    const panel  = document.getElementById('betaMenuPanel');
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

  // 메인 금액: "17조 7,660억 7,157만원" 한 줄로
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

  // 퍼센트: +1.48%, -0.32%, 0.00%
  function formatDeltaRate(currentRaw, prevRaw) {
    const current = toNumberSafe(currentRaw);
    const prev    = toNumberSafe(prevRaw);

    // 전월 값이 0 이하거나, 숫자가 아니면 0.00%
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

    // 1) 데이터수집 온투업체수 (개수형)
    const firmCount = toNumberSafe(
      summary.dataFirms ?? summary.registeredFirms ?? 0,
    );
    const prevFirmCount = prevSummary
      ? toNumberSafe(
          prevSummary.dataFirms ?? prevSummary.registeredFirms ?? 0,
        )
      : null;

    cards.push(createCountCard('데이터수집 온투업체수', firmCount, prevFirmCount));

    // 2) 누적 대출금액
    cards.push(
      createMoneyCard(
        '누적 대출금액',
        toNumberSafe(summary.totalLoan),
        prevSummary ? toNumberSafe(prevSummary.totalLoan) : null,
      ),
    );

    // 3) 누적 상환금액
    cards.push(
      createMoneyCard(
        '누적 상환금액',
        toNumberSafe(summary.totalRepaid),
        prevSummary ? toNumberSafe(prevSummary.totalRepaid) : null,
      ),
    );

    // 4) 대출잔액
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
      if (ratio > 1) ratio = ratio / 100; // 23.4 이런 % 값이면 0.234로 보정

      cards.push(createProductCard(key, curAmount, prevAmount, ratio));
    });

    return cards;
  }

  /* ----- 개수형 카드 (온투업체수) ----- */

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

  /* ----- 금액 카드 (조/억/만원 한 줄) ----- */

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

    // 메인 금액 포맷 실패 대비용 안전장치
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

    // 카드 렌더 후 슬라이더 초기화/재정렬
    if (typeof window !== 'undefined' && typeof window.initOntuStatsSliders === 'function') {
      window.initOntuStatsSliders();
    }
  }

  // "2025-10" 또는 "2025-10-01" -> "2025-10"
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
        console.warn('[ontu-stats] no previous month data', e);
      }

      renderAll(current, prev);

      // month 인풋 변경
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

    let isPointerDown = false;
    let startX        = 0;
    let deltaX        = 0;

    function getCards() {
      return Array.from(track.querySelectorAll('.stats-card'));
    }

    function scrollToIndex(newIndex, opts) {
      const options = Object.assign({ smooth: true }, opts || {});
      const cards = getCards();
      const total = cards.length;
      if (!total) return;

      const normalized = ((newIndex % total) + total) % total;
      currentIndex = normalized;

      const card    = cards[normalized];
      const cardRect = card.getBoundingClientRect();
      const vpRect   = viewport.getBoundingClientRect();

      const offset = card.offsetLeft - (vpRect.width - cardRect.width) / 2;

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

      const threshold = viewport.offsetWidth * 0.15;

      if (deltaX > threshold) {
        scrollToIndex(currentIndex - 1);
      } else if (deltaX < -threshold) {
        scrollToIndex(currentIndex + 1);
      } else {
        scrollToIndex(currentIndex);
      }

      startAuto();
    }

    // 마우스
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

    // 터치
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

    // hover 시 자동 슬라이드 일시정지
    slider.addEventListener('mouseenter', stopAuto);
    slider.addEventListener('mouseleave', startAuto);

    // 리사이즈 시 현재 카드 기준 재정렬
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

  window.initOntuStatsSliders = initOntuStatsSliders;
})();
