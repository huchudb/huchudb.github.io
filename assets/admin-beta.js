// /assets/admin-beta.js (통째로 교체)

// ─────────────────────────────────────────
// 기본 설정
// ─────────────────────────────────────────

const PRODUCT_TYPES = [
  "부동산담보",
  "부동산PF",
  "어음·매출채권담보",
  "기타담보(주식 등)",
  "개인신용",
  "법인신용",
];

const LOCAL_KEY_STATS = "huchu_ontu_stats_beta";

// ─────────────────────────────────────────
// 숫자 유틸 (쉼표 포맷 등)
// ─────────────────────────────────────────

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

    // 초기값도 포맷
    if (input.value) {
      input.value = formatWithCommas(input.value);
    }
  });
}

// ─────────────────────────────────────────
// 상품유형별 대출잔액 테이블 렌더링
// ─────────────────────────────────────────

function buildProductTable() {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;

  tbody.innerHTML = PRODUCT_TYPES.map((name, idx) => `
    <tr>
      <td class="cell-name">${name}</td>
      <td>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          class="admin-input js-ratio"
          data-index="${idx}"
          placeholder="0.0"
        />
      </td>
      <td>
        <input
          type="text"
          class="admin-input js-amount"
          data-type="money"
          data-index="${idx}"
          placeholder="0"
          inputmode="numeric"
        />
      </td>
    </tr>
  `).join("");
}

// 비율 → 금액 자동 계산
function setupRatioAutoCalc() {
  const balanceInput = document.getElementById("statBalance");
  if (!balanceInput) return;

  const ratioInputs   = document.querySelectorAll(".js-ratio");
  const amountInputs  = document.querySelectorAll(".js-amount");

  ratioInputs.forEach((ratioInput) => {
    ratioInput.addEventListener("input", () => {
      const idx = ratioInput.getAttribute("data-index");
      const amountInput = document.querySelector(`.js-amount[data-index="${idx}"]`);
      if (!amountInput) return;

      const balance = getMoneyValueFromInput(balanceInput);
      const ratio   = parseFloat(ratioInput.value);
      if (!balance || isNaN(ratio)) {
        // 숫자 아닌 경우는 그냥 비워둠
        amountInput.value = "";
        return;
      }

      const amount = Math.round(balance * (ratio / 100));
      amountInput.value = formatWithCommas(String(amount));
    });
  });
}

// ─────────────────────────────────────────
// 폼 값 → JSON 변환
// ─────────────────────────────────────────

function collectStatsFormData() {
  const monthInput = document.getElementById("statMonth"); // YYYY-MM 형식이라고 가정
  const regInput   = document.getElementById("statRegisteredFirms");
  const dataInput  = document.getElementById("statDataFirms");
  const totalLoanInput   = document.getElementById("statTotalLoan");
  const totalRepaidInput = document.getElementById("statTotalRepaid");
  const balanceInput     = document.getElementById("statBalance");

  const month = monthInput ? (monthInput.value || "").trim() : "";

  const summary = {
    registeredFirms: regInput ? Number(regInput.value || 0) : 0,
    dataFirms:      dataInput ? Number(dataInput.value || 0) : 0,
    totalLoan:      getMoneyValueFromInput(totalLoanInput),
    totalRepaid:    getMoneyValueFromInput(totalRepaidInput),
    balance:        getMoneyValueFromInput(balanceInput),
  };

  const byType = {};
  PRODUCT_TYPES.forEach((name, idx) => {
    const ratioInput  = document.querySelector(`.js-ratio[data-index="${idx}"]`);
    const amountInput = document.querySelector(`.js-amount[data-index="${idx}"]`);

    const ratioPercent = ratioInput ? parseFloat(ratioInput.value) : 0;
    const ratio = isNaN(ratioPercent) ? 0 : (ratioPercent / 100);   // 43 → 0.43

    const amount = getMoneyValueFromInput(amountInput);

    byType[name] = {
      ratio,
      amount,
    };
  });

  return { month, summary, byType };
}

// ─────────────────────────────────────────
// 저장 버튼 (현재는 localStorage + console.log 전용)
// ─────────────────────────────────────────

function setupSaveStatsButton() {
  const btn = document.getElementById("btnSaveStats");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const payload = collectStatsFormData();

    // 1) 브라우저 localStorage 에 저장
    try {
      localStorage.setItem(LOCAL_KEY_STATS, JSON.stringify(payload));
    } catch (e) {
      console.warn("localStorage 저장 실패:", e);
    }

    // 2) 콘솔에 찍어보기 (JSON 확인용)
    console.log("[beta admin] 통계 데이터 (로컬 저장 전용):", payload);

    // 3) 사용자에게 안내
    alert("통계 데이터가 브라우저(localStorage)에 저장되었습니다.\n\n" +
      "실제 운영 서버 연동 시에는 이 위치에서 API 호출을 붙이면 됩니다.");
  });
}

// ─────────────────────────────────────────
// 초기화
// ─────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // 1) 상품유형별 테이블 만들기
  buildProductTable();

  // 2) 금액 인풋 쉼표 포맷
  setupMoneyInputs();

  // 3) 비율 입력 → 대출잔액 기준 자동 계산
  setupRatioAutoCalc();

  // 4) 저장 버튼
  setupSaveStatsButton();
});
