/* ===== EmailJS 안전 초기화 ===== */
const EMAILJS_PUBLIC_KEY  = "22FTCISS9zfQspQtj";
const EMAILJS_SERVICE_ID  = "service_2fcve4r";
const EMAILJS_TEMPLATE_ID = "template_v94yxrv";

function initEmailJS() {
  if (window.emailjs && typeof emailjs.init === "function") {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    console.log("EmailJS 초기화 완료");
  } else {
    console.warn("EmailJS SDK 미로딩 - 이메일 전송 기능은 비활성화됩니다.");
  }
}

/* ===== 숫자 포맷 ===== */
function formatNumber(num) {
  const n = Number(String(num).replace(/,/g, ""));
  if (isNaN(n)) return "";
  return n.toLocaleString();
}
function parseNumber(str) {
  const n = Number(String(str || "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}
function attachComma(id) {
  const el = document.getElementById(id);
  el.addEventListener("input", () => {
    const raw = el.value.replace(/[^0-9]/g, "");
    el.value = raw ? Number(raw).toLocaleString() : "";
  });
}

/* ===== LTV 한도 ===== */
const LTV_LIMITS = {
  seoul: { apartment: 0.7,   multi: 0.6,  house: 0.6,  other: 0.5 },
  other: { apartment: 0.6,   multi: 0.5,  house: 0.5,  other: 0.4 }
};

/* ===== 계산 로직 ===== */
function compute({ region, propertyType, price, seniorDebt, deduction, loanNeed }) {
  const ratio = LTV_LIMITS?.[region]?.[propertyType];
  if (typeof ratio !== "number") throw new Error("유효하지 않은 지역/부동산 종류입니다.");

  const effSenior = Math.max(seniorDebt - deduction, 0);      // STEP4-1 반영
  const maxLoan   = Math.max(0, price * ratio - effSenior);   // 음수 방지

  const canBorrow = loanNeed > 0 && loanNeed <= maxLoan;
  const ltvExceeded = loanNeed > maxLoan; // 요청금액 기준 초과

  return { ratio, effSenior, maxLoan, canBorrow, ltvExceeded };
}

/* ===== UI 바인딩 ===== */
document.addEventListener("DOMContentLoaded", () => {
  initEmailJS();

  ["price", "seniorDebt", "deduction", "loanNeed"].forEach(attachComma);

  document.getElementById("calculateBtn").addEventListener("click", () => {
    const region       = document.getElementById("region").value;
    const propertyType = document.getElementById("propertyType").value;
    const price        = parseNumber(document.getElementById("price").value);
    const seniorDebt   = parseNumber(document.getElementById("seniorDebt").value);
    const deduction    = parseNumber(document.getElementById("deduction").value);
    const loanNeed     = parseNumber(document.getElementById("loanNeed").value);

    if (!region || !propertyType || !price) {
      alert("STEP1~3을 입력해주세요.");
      return;
    }

    let r;
    try {
      r = compute({ region, propertyType, price, seniorDebt, deduction, loanNeed });
    } catch (e) {
      alert(e.message);
      return;
    }

    const result = document.getElementById("result");
    const connect = document.getElementById("connectSection");
    const summary = [
      "[대출 계산 결과]",
      `지역: ${region === "seoul" ? "서울" : "서울 외"}`,
      `부동산 종류: ${({apartment:"아파트",multi:"다세대/연립",house:"단독/다가구",other:"기타"})[propertyType]}`,
      `시세: ${formatNumber(price)} 원`,
      `선순위: ${formatNumber(seniorDebt)} 원`,
      `차감금액: ${formatNumber(deduction)} 원`,
      `실제 반영 선순위: ${formatNumber(r.effSenior)} 원`,
      `요청금액: ${formatNumber(loanNeed)} 원`
    ];

    if (loanNeed > 0 && r.ltvExceeded) {
      // 5, 5-1: LTV 초과 문구 + 버튼 숨김
      result.innerHTML = `<div class="resultBox">❌ LTV 초과, 대출이 불가능합니다.</div>`;
      connect.style.display = "none";
      return;
    }

    // 요청금액 없거나(0) 가능인 경우
    const topMsg = loanNeed > 0
      ? `✅ 대출 가능<br>최대 가능 금액: ${formatNumber(r.maxLoan)} 원<br>요청 금액: ${formatNumber(loanNeed)} 원`
      : `최대 가능 금액: ${formatNumber(r.maxLoan)} 원`;

    result.innerHTML = `<div class="resultBox">${topMsg}</div>`;

    // ‘요청 내용’ 자동 기재 (계산 결과 그대로)
    const requestContent = document.getElementById("requestContent");
    requestContent.value = (summary.concat([
      loanNeed > 0 ? `계산결과: 대출 가능 (최대 가능 금액: ${formatNumber(r.maxLoan)} 원)` 
                   : `계산결과: 최대 가능 금액은 ${formatNumber(r.maxLoan)} 원`
    ])).join("\n");

    // 버튼 노출 규칙: 요청금액이 0이면 숨김, 가능이면 노출
    document.getElementById("connectSection").style.display =
      loanNeed > 0 && r.canBorrow ? "block" : "none";
  });

  // 이메일 전송 (이메일 입력 항목 삭제 요구 반영)
  document.getElementById("requestForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!window.emailjs) {
      alert("이메일 기능을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    const request_content = document.getElementById("requestContent").value.trim();
    const extra_content   = document.getElementById("extraContent").value.trim();

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      request_content, extra_content
    }).then(() => {
      alert("요청이 정상적으로 발송되었습니다 ✅");
      e.target.reset();
    }).catch(err => {
      console.error(err);
      alert("전송 실패: " + (err?.text || JSON.stringify(err)));
    });
  });
});
