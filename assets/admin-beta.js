// /assets/admin-beta.js

// ─────────────────────────────
// 숫자 포맷 유틸
// ─────────────────────────────
function stripNonDigits(str) {
  return (str || "").replace(/[^\d]/g, "");
}
function formatWithCommas(str) {
  const digits = stripNonDigits(str);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function getMoneyValueFromInput(input) {
  if (!input) return 0;
  const digits = stripNonDigits(input.value);
  return digits ? Number(digits) : 0;
}
function setupMoneyInputs() {
  const moneyInputs = document.querySelectorAll('input[data-type="money"]');
  moneyInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      const target = e.target;
      const formatted = formatWithCommas(target.value);
      target.value = formatted;
    });
    if (input.value) {
      input.value = formatWithCommas(input.value);
    }
  });
}
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─────────────────────────────
// 1. 담보대출 LTV / 금리 설정
// ─────────────────────────────
const LOAN_REGIONS = ["서울","경기","इन천","충청도","전라도","강원도","경상도","제주도"]; // 인천 오타 났네? → 인천으로
// 잠깐, 위 한글 오타 수정
