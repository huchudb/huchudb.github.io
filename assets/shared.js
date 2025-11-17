// /assets/shared.js
// 숫자/포맷 공용 유틸 (계산기, 홈 베타에서 공통 사용)

export const onlyDigits = (s) => (s || "").replace(/[^0-9]/g, "");
export const toNumber   = (s) => Number(onlyDigits(s)) || 0;

/**
 * 한국 통화 포맷
 * - 1조 이상: 18조 3,580억 776만원
 * - 1억 이상 1조 미만: 183,580억 776만원 / 2억 원
 * - 1만 이상 1억 미만: 123만원
 * - 1만 미만: 12,345원
 */
export function formatKoreanCurrency(num) {
  const n0 = Number(num) || 0;
  const n = Math.max(0, Math.floor(n0));

  const UNIT_MAN = 10000;           // 만
  const UNIT_EOK = 100000000;       // 억
  const UNIT_JO  = 1000000000000;   // 조

  // 1조 이상
  if (n >= UNIT_JO) {
    const jo  = Math.floor(n / UNIT_JO);
    const remAfterJo = n % UNIT_JO;

    const eok = Math.floor(remAfterJo / UNIT_EOK);
    const remAfterEok = remAfterJo % UNIT_EOK;

    const man = Math.floor(remAfterEok / UNIT_MAN);

    if (man > 0) {
      return (
        jo.toLocaleString("ko-KR") + "조 " +
        eok.toLocaleString("ko-KR") + "억 " +
        man.toLocaleString("ko-KR") + "만원"
      );
    }
    if (eok > 0) {
      return (
        jo.toLocaleString("ko-KR") + "조 " +
        eok.toLocaleString("ko-KR") + "억 원"
      );
    }
    return jo.toLocaleString("ko-KR") + "조 원";
  }

  // 1억 이상 1조 미만
  if (n >= UNIT_EOK) {
    const eok = Math.floor(n / UNIT_EOK);
    const man = Math.floor((n % UNIT_EOK) / UNIT_MAN);
    if (man > 0) {
      return (
        eok.toLocaleString("ko-KR") + "억 " +
        man.toLocaleString("ko-KR") + "만원"
      );
    }
    return eok.toLocaleString("ko-KR") + "억 원";
  }

  // 1만 이상 1억 미만
  if (n >= UNIT_MAN) {
    const man = Math.floor(n / UNIT_MAN);
    return man.toLocaleString("ko-KR") + "만원";
  }

  // 1만 미만
  return n.toLocaleString("ko-KR") + "원";
}
