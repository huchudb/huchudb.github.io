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
  const
