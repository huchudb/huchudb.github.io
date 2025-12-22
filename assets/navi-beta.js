// /assets/navi-beta.js  (후추 네비게이션 – 베타용)
// NOTE: stepper/단계 노출 제어 + Step6 1차 결과(업체명 비공개) + Step7 3컬럼(금리/플랫폼/중도상환) 렌더

// ------------------------------------------------------
// 공통 상수 / 유틸
// ------------------------------------------------------

const API_BASE = "https://huchudb-github-io.vercel.app";
const NAVI_LOAN_CONFIG_ENDPOINT = `${API_BASE}/api/loan-config`;
const LENDERS_CONFIG_API = `${API_BASE}/api/lenders-config`;
const NAVI_LOAN_CONFIG_LOCAL_KEY = "huchu_navi_loan_config_v1";

/**
 * Step5 폼 스키마 매트릭스 (최종본)
 * - 키: [부동산유형][대출종류]
 * - 값: { supported:boolean, fields:[{code,required,label,note?}, ...] }
 */
const STEP5_MATRIX = {"아파트":{"일반담보대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"KB시세"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"임대보증금반환대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"KB시세(원)"},{"code":"DEP","required":true,"label":"반환 임대보증금(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"REQ","required":false,"label":"추가 필요금액(원)"}]},"지분대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"KB시세(원)"},{"code":"SP","required":true,"label":"지분율(%)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"경락잔금대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주예정 or 임대예정 or 선순위임차인인수"},{"code":"PV","required":true,"label":"KB시세"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"ASB","required":false,"label":"인수되는 금액(원)","note":"OCC 선순위임차인인수 선택시 표현+필수로 변환"},{"code":"DEP","required":false,"label":"선순위 예정 임대보증금액(원)","note":"OCC 임대예정 선택시 표현+필수로 변환."}]},"대환대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"KB시세(원)"},{"code":"SL","required":true,"label":"선순위 총 대출금액(원)"},{"code":"REF","required":true,"label":"상환할 선순위 금액(원)"},{"code":"REQ","required":false,"label":"추가 필요금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"매입잔금(일반)":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주예정 or 임대예정"},{"code":"PV","required":true,"label":"KB시세"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"예정 선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"선순위 예정 임대보증금액(원)","note":"OCC 임대예정 선택시 표현+필수로 변환."}]},"매입잔금(분양)":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주예정 or 임대예정"},{"code":"PV","required":true,"label":"분양가"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"예정 선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"선순위 예정 임대보증금액(원)","note":"OCC 임대예정 선택시 표현+필수로 변환."}]}},"다세대/연립":{"일반담보대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"하우스머치시세"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"임대보증금반환대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"하우스머치시세(원)"},{"code":"DEP","required":true,"label":"반환 임대보증금(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"REQ","required":false,"label":"추가 필요금액(원)"}]},"지분대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"하우스머치시세(원)"},{"code":"SP","required":true,"label":"지분율(%)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"경락잔금대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주예정 or 임대예정 or 선순위임차인인수"},{"code":"PV","required":true,"label":"하우스머치시세"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"ASB","required":false,"label":"인수되는 금액(원)","note":"OCC 선순위임차인인수 선택시 표현+필수로 변환"},{"code":"DEP","required":false,"label":"선순위 예정 임대보증금액(원)","note":"OCC 임대예정 선택시 표현+필수로 변환."}]},"대환대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"하우스머치시세(원)"},{"code":"SL","required":true,"label":"선순위 총 대출금액(원)"},{"code":"REF","required":true,"label":"상환할 선순위 금액(원)"},{"code":"REQ","required":false,"label":"추가 필요금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"매입잔금(일반)":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주예정 or 임대예정"},{"code":"PV","required":true,"label":"\"하우스머치시세”"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"예정 선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"선순위 예정 임대보증금액(원)","note":"OCC 임대예정 선택시 표현+필수로 변환."}]},"매입잔금(분양)":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주예정 or 임대예정"},{"code":"PV","required":true,"label":"분양가"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"예정 선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"선순위 예정 임대보증금액(원)","note":"OCC 임대예정 선택시 표현+필수로 변환."}]}},"오피스텔":{"일반담보대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"KB시세/시세(원)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"임대보증금반환대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"KB시세/시세(원)"},{"code":"DEP","required":true,"label":"반환 임대보증금(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"REQ","required":false,"label":"추가 필요금액(원)"}]},"지분대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"KB시세/시세(원)"},{"code":"SP","required":true,"label":"지분율(%)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"경락잔금대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주예정 or 임대예정 or 선순위임차인인수"},{"code":"PV","required":true,"label":"낙찰가or감정가(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"ASB","required":false,"label":"인수되는 금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"대환대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"KB시세/시세(원)"},{"code":"SL","required":true,"label":"선순위 총 대출금액(원)"},{"code":"REF","required":true,"label":"상환할 선순위 금액(원)"},{"code":"REQ","required":false,"label":"추가 필요금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"매입잔금(일반)":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주예정 or 임대예정"},{"code":"PV","required":true,"label":"KB시세or매입가"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"예정 선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"선순위 예정 임대보증금액(원)","note":"OCC 임대예정 선택시 표현+필수로 변환."}]},"매입잔금(분양)":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주예정 or 임대예정"},{"code":"PV","required":true,"label":"분양가"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"예정 선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"선순위 예정 임대보증금액(원)","note":"OCC 임대예정 선택시 표현+필수로 변환."}]}},"단독/다가구":{"일반담보대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"시세(원)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"임대보증금반환대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"시세(원)"},{"code":"DEP","required":true,"label":"총 임대보증금(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"REF","required":true,"label":"임대보증금 반환 금액(원)"},{"code":"REQ","required":false,"label":"추가 필요금액(원)"}]},"지분대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"시세(원)"},{"code":"SP","required":true,"label":"지분율(%)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"경락잔금대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주예정 or 임대예정 or 선순위임차인인수"},{"code":"PV","required":true,"label":"낙찰가or감정가(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"ASB","required":false,"label":"인수되는 금액(원)","note":"OCC 선순위임차인인수 선택시 표현+필수로 변환"},{"code":"DEP","required":false,"label":"선순위 예정 임대보증금액(원)","note":"OCC 임대예정 선택시 표현+필수로 변환."}]},"대환대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"시세(원)"},{"code":"SL","required":true,"label":"선순위 총 대출금액(원)"},{"code":"REF","required":true,"label":"상환할 선순위 금액(원)"},{"code":"REQ","required":true,"label":"추가 필요금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"매입잔금(일반)":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주예정 or 임대예정"},{"code":"PV","required":true,"label":"매입가/감정가"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"선순위 예정 임대보증금액(원)","note":"OCC 임대예정 선택시 표현+필수로 변환."}]},"매입잔금(분양)":{"supported":false,"fields":[]}},"토지/임야":{"일반담보대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"시세/감정가(원)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"}]},"임대보증금반환대출":{"supported":false,"fields":[]},"지분대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"시세/감정가(원)"},{"code":"SP","required":true,"label":"지분율(%)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"}]},"경락잔금대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"낙찰가or감정가(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"ASB","required":false,"label":"인수되는 금액(원)(원)"}]},"대환대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"시세/감정가(원)"},{"code":"SL","required":true,"label":"선순위 총 대출금액(원)"},{"code":"REF","required":true,"label":"상환할 선순위 금액(원)"},{"code":"REQ","required":false,"label":"추가 필요금액(원)"}]},"매입잔금(일반)":{"supported":true,"fields":[{"code":"PV","required":true,"label":"매입가/감정가(원)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"}]},"매입잔금(분양)":{"supported":false,"fields":[]}},"근린생활시설":{"일반담보대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"시세"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)"}]},"임대보증금반환대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"시세(원)"},{"code":"DEP","required":true,"label":"총 임대보증금(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"REF","required":true,"label":"임대보증금 반환 금액(원)"},{"code":"REQ","required":false,"label":"추가 필요금액(원)"}]},"지분대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"시세(원)"},{"code":"SP","required":true,"label":"지분율(%)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"선순위 임대보증금액(원)"}]},"경락잔금대출":{"supported":true,"fields":[{"code":"PV","required":true,"label":"낙찰가or감정가(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"ASB","required":false,"label":"인수되는 금액(원)"}]},"대환대출":{"supported":true,"fields":[{"code":"OCC","required":true,"label":"본인거주 or 임대"},{"code":"PV","required":true,"label":"시세(원)"},{"code":"SL","required":true,"label":"선순위 총 대출금액(원)"},{"code":"REF","required":true,"label":"상환할 선순위 금액(원)"},{"code":"REQ","required":false,"label":"추가 필요금액(원)"},{"code":"DEP","required":false,"label":"임대보증금액(원)","note":"OCC 임대중 선택시 표현+필수로 변환."}]},"매입잔금(일반)":{"supported":true,"fields":[{"code":"PV","required":true,"label":"매입가"},{"code":"REQ","required":true,"label":"필요 대출금액(원)"},{"code":"SL","required":false,"label":"선순위 대출금액(원)"},{"code":"DEP","required":false,"label":"선순위 임대보증금액(원)"}]},"매입잔금(분양)":{"supported":false,"fields":[]}}};

// 숫자 유틸
function stripNonDigits(str) {
  return (str || "").replace(/[^\d]/g, "");
}
function formatWithCommas(str) {
  const digits = stripNonDigits(str);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function getMoneyValueById(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const digits = stripNonDigits(el.value);
  return digits ? Number(digits) : 0;
}
function setMoneyValueById(id, num) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = num ? formatWithCommas(String(num)) : "";
}
function setupMoneyInputs(root = document) {
  const moneyInputs = root.querySelectorAll('input[data-type="money"]');
  moneyInputs.forEach((input) => {
    if (input.__moneyBound) return;
    input.__moneyBound = true;

    input.addEventListener("input", (e) => {
      const v = e.target.value;
      e.target.value = formatWithCommas(v);
    });

    if (input.value) {
      input.value = formatWithCommas(input.value);
    }
  });
}

// --------- 문자열 정규화(매칭 강건화) ----------
function normKey(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[()·]/g, "")
    .replace(/_/g, "")
    .toLowerCase();
}
function includesNorm(list, value) {
  const v = normKey(value);
  return (list || []).some((x) => normKey(x) === v);
}
function includesRegion(regions, region) {
  if (!region) return true;
  const r = String(region || "").replace(/도$/g, ""); // 충청도/전라도/경상도/강원도 → 충청/전라/경상/강원
  return (regions || []).some((x) => {
    if (String(x) === "전국") return true;
    const xr = String(x || "").replace(/도$/g, "");
    return xr === r;
  });
}

// ------------------------------------------------------
// ✅ admin(loan-config) 스키마 정규화 유틸
//   - loan-config: { lenders: {id: {...}} }  (객체)
//   - lenders-config: { lenders: [...] }     (배열)
// ------------------------------------------------------

function lendersAnyToArray(any) {
  if (!any) return [];
  if (Array.isArray(any)) return any;

  if (typeof any === "object" && !Array.isArray(any)) {
    return Object.entries(any).map(([id, v]) => {
      if (!v || typeof v !== "object") return null;
      return { ...v, id: v.id || id };
    }).filter(Boolean);
  }
  return [];
}

const REGION_LABEL_TO_KEY = {
  "서울": "seoul",
  "경기": "gyeonggi",
  "경상": "gyeongsang",
  "전라": "jeolla",
  "충청": "chungcheong",
  "강원": "gangwon",
  "인천": "incheon",
  "제주": "jeju",
};

const REGION_KEY_TO_LABEL = {
  seoul: "서울",
  gyeonggi: "경기",
  incheon: "인천",
  chungcheong: "충청",
  jeolla: "전라",
  gyeongsang: "경상",
  gangwon: "강원",
  jeju: "제주",
};

const PROP_LABEL_TO_KEY = {
  "아파트": "apt",
  "다세대/연립": "villa",
  "오피스텔": "officetel",
  "단독/다가구": "detached",
  "토지/임야": "land",
  "근린생활시설": "commercial",
};

const PROP_KEY_TO_LABEL = {
  apt: "아파트",
  villa: "다세대/연립",
  officetel: "오피스텔",
  detached: "단독/다가구",
  land: "토지/임야",
  commercial: "근린생활시설",
};

function regionKeyFromLabel(label) {
  if (!label) return "";
  const t = String(label).replace(/도$/g, "").trim();
  // "경기도" 같은 케이스도 대비
  if (REGION_LABEL_TO_KEY[t]) return REGION_LABEL_TO_KEY[t];

  // 혹시 "서울특별시" 같은 값이면 앞 2글자 기준으로
  const head2 = t.slice(0, 2);
  if (REGION_LABEL_TO_KEY[head2]) return REGION_LABEL_TO_KEY[head2];

  // fallback: 영어 키가 직접 들어온 경우
  const low = String(label).toLowerCase();
  if (REGION_KEY_TO_LABEL[low]) return low;

  return "";
}

function propKeyFromLabel(label) {
  if (!label) return "";
  return PROP_LABEL_TO_KEY[String(label).trim()] || "";
}

// "만원/원" 혼재 가능성 대비: 값이 너무 작으면 만원으로 보고 *10000
function toWonMaybe(v) {
  const n = parseNumberLoose(v);
  if (n == null) return 0;
  if (n >= 1000000) return n;     // 이미 원 단위로 보이는 큰 값
  return n * 10000;               // 만원 단위로 간주
}

// admin regions 구조에서 현재 선택(지역+유형)에 해당하는 셀을 찾아준다.
function getAdminRegionCell(lender, regionLabel, propertyTypeLabel) {
  const regionsObj = lender?.regions;
  if (!regionsObj || typeof regionsObj !== "object") return null;

  const rk = regionKeyFromLabel(regionLabel);
  const pk = propKeyFromLabel(propertyTypeLabel);
  if (!rk || !pk) return null;

  const regionCfg = regionsObj[rk];
  if (!regionCfg || typeof regionCfg !== "object") return null;

  const cell = regionCfg[pk];
  if (!cell || typeof cell !== "object") return null;

  return cell;
}

// regions -> (표시용) realEstateConfig 유사 구조 생성
function deriveRealEstateConfigFromRegions(regionsObj) {
  const out = { regions: [], propertyTypes: [], loanTypes: [] };

  if (!regionsObj || typeof regionsObj !== "object") return out;

  const regionSet = new Set();
  const propSet = new Set();
  const loanSet = new Set();

  for (const [rk, regionCfg] of Object.entries(regionsObj)) {
    if (!regionCfg || typeof regionCfg !== "object") continue;

    let regionHasAny = false;

    for (const [pk, cell] of Object.entries(regionCfg)) {
      if (!cell || typeof cell !== "object") continue;
      const enabled = (cell.enabled === true || cell.enabled === "true");
      if (!enabled) continue;

      regionHasAny = true;
      const propLabel = PROP_KEY_TO_LABEL[pk] || pk;
      propSet.add(propLabel);

      (cell.loanTypes || []).forEach((t) => loanSet.add(t));
    }

    if (regionHasAny) {
      regionSet.add(REGION_KEY_TO_LABEL[rk] || rk);
    }
  }

  out.regions = Array.from(regionSet);
  out.propertyTypes = Array.from(propSet);
  out.loanTypes = Array.from(loanSet);
  return out;
}

function normalizeLenderRecord(raw) {
  if (!raw || typeof raw !== "object") return null;

  const l = { ...raw };

  // ✅ 표기용 기본값 통일
  l.id = l.id || l.lenderId || l.slug || "";
  l.displayName = l.displayName || l.name || l.id || "(이름 없음)";

  // ✅ 상품군: admin은 products, navi는 loanCategories로 쓰고 있었음
  if (!Array.isArray(l.loanCategories) || !l.loanCategories.length) {
    l.loanCategories = Array.isArray(l.products) ? l.products : (Array.isArray(l.loanCategories) ? l.loanCategories : []);
  }

  // ✅ 채널: admin은 phoneNumber/kakaoUrl이 top-level인 케이스가 있음
  if (!l.channels || typeof l.channels !== "object") l.channels = {};
  l.channels.phoneNumber = l.channels.phoneNumber || l.phoneNumber || "";
  l.channels.kakaoUrl = l.channels.kakaoUrl || l.kakaoUrl || "";

  // ✅ 정렬용
  if (typeof l.displayOrder !== "number") {
    const o = parseNumberLoose(l.partnerOrder);
    l.displayOrder = (o != null) ? o : l.displayOrder;
  }

  // ✅ 표시용 realEstateConfig(없으면 regions 기반으로 생성)
  if ((!l.realEstateConfig || typeof l.realEstateConfig !== "object") && l.regions && typeof l.regions === "object") {
    l.realEstateConfig = deriveRealEstateConfigFromRegions(l.regions);
  }

  // ✅ 추가조건(admin) 정규화
  if (!Array.isArray(l.extraConditions)) {
    if (Array.isArray(l.extraCondition)) l.extraConditions = l.extraCondition;
    else if (Array.isArray(l.extraConditionIds)) l.extraConditions = l.extraConditionIds;
    else l.extraConditions = [];
  }

  return l;
}

function normalizeLenderList(list) {
  return (list || []).map(normalizeLenderRecord).filter(Boolean);
}

// --------- 퍼센트/수수료 파싱 ----------
function parseNumberLoose(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v);
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}
function fmtPct(v, fallback = "미등록") {
  const n = parseNumberLoose(v);
  if (n == null) return fallback;
  return `연 ${n}%`;
}
function fmtFee(v, fallback = "미등록") {
  const n = parseNumberLoose(v);
  if (n == null) return fallback;
  return `${n}%`;
}
function fmtRange(min, max, unitText, fallback = "미등록") {
  if (min == null && max == null) return fallback;
  if (min != null && max != null) {
    if (Math.abs(min - max) < 1e-9) return `${min}${unitText}`;
    return `${min}${unitText} ~ ${max}${unitText}`;
  }
  const only = (min != null) ? min : max;
  return `${only}${unitText}`;
}

// ------------------------------------------------------
// 서버 설정 로드 (admin 정보)
// ------------------------------------------------------

async function loadLendersConfig() {
  try {
    const res = await fetch(LENDERS_CONFIG_API, { method: "GET" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`lenders-config GET 실패: HTTP ${res.status} ${t}`);
    }

    const json = await res.json();
    const lendersArr = normalizeLenderList(lendersAnyToArray(json?.lenders));

    const out = { version: json?.version ?? 1, lenders: lendersArr };
    console.log("✅ lendersConfig loaded from server:", out);
    return out;
  } catch (e) {
    console.warn("⚠️ lenders-config API 실패, localStorage 대체:", e);
    try {
      const raw = localStorage.getItem("huchu_lenders_config_beta");
      if (!raw) return { version: 1, lenders: [] };
      const parsed = JSON.parse(raw);
      const lendersArr = normalizeLenderList(lendersAnyToArray(parsed?.lenders));
      return { version: parsed?.version ?? 1, lenders: lendersArr };
    } catch {
      return { version: 1, lenders: [] };
    }
  }
}

// ✅ 이 줄을 추가
let naviLoanConfig = { version: 1, lenders: [] };

// loan-config + lenders-config 병합(가능하면 admin 원본 우선)
async function loadNaviLoanConfig() {
  let fromLoanConfig = null;

  // 1) loan-config (Upstash 단일 소스)에서 읽기
  try {
    const res = await fetch(NAVI_LOAN_CONFIG_ENDPOINT, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();

      // ✅ 핵심: lenders가 "객체"여도 배열로 변환
      const lendersArr = normalizeLenderList(lendersAnyToArray(json?.lenders));
      if (lendersArr.length) {
        fromLoanConfig = { version: json?.version ?? 1, lenders: lendersArr };
        console.log("✅ loan-config from API(normalized):", fromLoanConfig.lenders.length);
      } else {
        console.warn("ℹ️ loan-config는 있으나 lenders가 비어있음");
      }
    } else {
      console.warn("loan-config GET 실패:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.warn("loan-config API 불러오기 실패:", e);
  }

  // 2) lenders-config (뷰 endpoint) 우선 적용
  const lendersConfig = await loadLendersConfig();
  if (lendersConfig && Array.isArray(lendersConfig.lenders) && lendersConfig.lenders.length) {
    naviLoanConfig = { version: lendersConfig.version ?? 1, lenders: lendersConfig.lenders };
    localStorage.setItem(NAVI_LOAN_CONFIG_LOCAL_KEY, JSON.stringify(naviLoanConfig));
    console.log("✅ naviLoanConfig ← lenders-config 적용:", naviLoanConfig.lenders.length);
    return;
  }

  // 3) loan-config fallback
  if (fromLoanConfig && Array.isArray(fromLoanConfig.lenders) && fromLoanConfig.lenders.length) {
    naviLoanConfig = fromLoanConfig;
    localStorage.setItem(NAVI_LOAN_CONFIG_LOCAL_KEY, JSON.stringify(naviLoanConfig));
    console.log("✅ naviLoanConfig ← loan-config 적용:", naviLoanConfig.lenders.length);
    return;
  }

  // 4) localStorage fallback
  try {
    const raw = localStorage.getItem(NAVI_LOAN_CONFIG_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const lendersArr = normalizeLenderList(lendersAnyToArray(parsed?.lenders));
      if (lendersArr.length) {
        naviLoanConfig = { version: parsed?.version ?? 1, lenders: lendersArr };
        console.log("✅ loan-config from localStorage:", naviLoanConfig.lenders.length);
        return;
      }
    }
  } catch (e) {
    console.warn("loan-config localStorage 로드 실패:", e);
  }

  console.log("ℹ️ loan-config 없음, 빈 구조로 시작");
  naviLoanConfig = { version: 1, lenders: [] };
}


// ------------------------------------------------------
// 네비게이션 상태
// ------------------------------------------------------

const uiState = {
  hasRenderedResult: false,
};

const userState = {
  mainCategory: null, // 부동산담보대출, 개인신용대출 ...
  region: null,
  propertyType: null,
  realEstateLoanType: null, // 일반담보대출, 임대보증금반환대출, ...
  occupancy: null, // self | rental (예정 포함)
  // 핵심 숫자 입력
  propertyValue: 0,
  sharePercent: 100,
  seniorLoan: 0,
  deposit: 0,
  refinanceAmount: 0,
  requestedAmount: 0,
  assumedBurden: 0, // 경락 인수 권리 등
  // 추가 정보
  extra: {
    incomeType: null,
    creditBand: null,
    repayPlan: null,
    needTiming: null,
    others: [], // 세금체납, 연체기록, ...
  },
};

// ------------------------------------------------------
// Stepper / 단계 노출 제어 (JS로 동적 삽입)
// ------------------------------------------------------

function ensureStepper() {
  const root = document.querySelector(".beta-inner.navi-main");
  const step1 = document.getElementById("navi-step1");
  if (!root || !step1) return;

  // ✅ id 불일치로 매번 삽입되던 문제 해결
  if (document.getElementById("navi-stepper")) return;

  const wrap = document.createElement("section");
  wrap.className = "beta-section navi-section";
  wrap.id = "navi-stepper";

  wrap.innerHTML = `
    <div class="beta-card beta-card--wide" style="padding:10px 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="font-weight:700;font-size:13px;color:#111827;">진행 단계</div>
        <div id="naviStepperMeta" style="font-size:11px;color:#6b7280;">
          총 7단계 (6-1은 선택)
        </div>
      </div>
      <div id="naviStepperBar" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;"></div>
    </div>
  `;
  root.insertBefore(wrap, step1);
}

function renderStepper(activeKey) {
  const bar = document.getElementById("naviStepperBar");
  if (!bar) return;

  const steps = [
    { key: 1, label: "1. 상품군" },
    { key: 2, label: "2. 지역" },
    { key: 3, label: "3. 유형" },
    { key: 4, label: "4. 대출종류" },
    { key: 5, label: "5. 핵심입력" },
    { key: 6, label: "6. 1차결과" },
    { key: 6.1, label: "6-1. 선택조건" },
    { key: 7, label: "7. 업체결과" },
  ];

  const active = activeKey ?? 1;

  bar.innerHTML = steps
    .map((s) => {
      const isDone = s.key < active;
      const isActive = s.key === active;
      const bg = isActive ? "#111827" : (isDone ? "#2563eb" : "#e5e7eb");
      const fg = isActive || isDone ? "#fff" : "#374151";
      const op = (s.key === 6.1) ? 0.85 : 1;

      return `
        <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;background:${bg};color:${fg};font-size:11px;opacity:${op};">
          <span style="font-weight:700;">${s.label}</span>
        </div>
      `;
    })
    .join("");
}

function setSectionVisible(sectionId, visible) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.style.display = visible ? "" : "none";
}

// ------------------------------------------------------
// Step4: 아파트/빌라만 7개 대출종류 노출 (JS로 칩 추가)
// ------------------------------------------------------

function ensureLoanTypeChips() {
  const container = document.getElementById("naviRealEstateLoanTypeChips");
  if (!container) return;

  // 매입잔금(일반/분양) 칩이 없으면 추가 (data-loan-type는 표시명 기준)
  const need = [
    { t: "매입잔금(일반)", label: "매입잔금(일반)" },
    { t: "매입잔금(분양)", label: "매입잔금(분양)" },
  ];

  need.forEach((x) => {
    const exists = Array.from(container.querySelectorAll(".navi-chip")).some(
      (b) => b.getAttribute("data-loan-type") === x.t
    );
    if (!exists) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "navi-chip";
      btn.setAttribute("data-loan-type", x.t);
      btn.textContent = x.label;
      container.appendChild(btn);
    }
  });
}

function updateLoanTypeChipVisibility() {
  const container = document.getElementById("naviRealEstateLoanTypeChips");
  if (!container) return;

  const prop = userState.propertyType;
  const isAptOrVilla = prop === "아파트" || prop === "다세대/연립";
  const isLand = prop === "토지/임야";

  const chips = container.querySelectorAll(".navi-chip");
  chips.forEach((chip) => {
    const loanType = chip.getAttribute("data-loan-type") || "";
    const k = normKey(loanType);

    const isBuyout = k.includes("매입잔금");
    const isDepositReturn = k.includes("임대보증금반환");

    // 기본은 노출
    let visible = true;

    // ✅ 매입잔금 2종은 아파트/빌라에만
    if (isBuyout) visible = isAptOrVilla;

    // ✅ 토지/임야에서는 임대보증금반환대출 칩 제거
    if (isLand && isDepositReturn) visible = false;

    chip.style.display = visible ? "" : "none";

    // 안전장치: 숨겨질 때 선택 상태였으면 해제
    if (!visible && chip.classList.contains("is-selected")) {
      chip.classList.remove("is-selected");
      if (userState.realEstateLoanType && normKey(userState.realEstateLoanType) === k) {
        userState.realEstateLoanType = null;
        userState.occupancy = null;
        uiState.hasRenderedResult = false;
        document
          .querySelectorAll("#naviOccupancyChips .navi-chip")
          .forEach((c) => c.classList.remove("is-selected"));
      }
    }
  });
}

// ------------------------------------------------------
// Step5: 폼 스키마 적용 (라벨/필수/노출)
// ------------------------------------------------------

function getStep5Schema() {
  const prop = userState.propertyType;
  const loan = userState.realEstateLoanType;
  if (!prop || !loan) return null;

  const byProp = STEP5_MATRIX[prop];
  if (!byProp) return null;

  // loanType 정규화 매칭(underscore/괄호 차이 흡수)
  const keys = Object.keys(byProp || {});
  const foundKey = keys.find((k) => normKey(k) === normKey(loan));
  const schema = foundKey ? byProp[foundKey] : null;

  if (!schema || !schema.supported) return null;
  return schema;
}

function ensureAssumedBurdenField() {
  const grid = document.querySelector("#navi-step5 .navi-field-grid");
  if (!grid) return;

  if (document.getElementById("naviInputAssumedBurden")) return;

  const label = document.createElement("label");
  label.setAttribute("data-field-code", "ASB");
  label.innerHTML = `
    인수되는 권리 금액 (원)
    <input type="text" id="naviInputAssumedBurden" data-type="money" placeholder="예) 50000000" />
    <span class="navi-help">※ 경락 시 인수되는 보증금/점유권리 등(예: 대항력 있는 임차인 보증금)</span>
  `;
  grid.appendChild(label);

  setupMoneyInputs(label);
  const input = label.querySelector("input");
  if (input) {
    input.addEventListener("input", () => recalcAndUpdateSummary());
  }
}

function setLabelText(labelEl, text) {
  if (!labelEl) return;
  // label 내부에서 input 앞의 텍스트 노드를 찾아 교체
  const nodes = Array.from(labelEl.childNodes || []);
  const textNode = nodes.find((n) => n.nodeType === Node.TEXT_NODE && String(n.textContent).trim() !== "");
  if (textNode) {
    textNode.textContent = `\n              ${text}\n              `;
    return;
  }
  // 없으면 span 추가
  const span = document.createElement("span");
  span.textContent = text;
  labelEl.insertBefore(span, labelEl.firstChild);
}

function applyStep5Schema() {
  ensureAssumedBurdenField();

  const schema = getStep5Schema();
  const occBlock = document.getElementById("naviOccupancyChips")?.parentElement; // OCC 레이블 블럭 전체
  const helpEl = document.getElementById("naviLoanTypeHelp");

  const fieldDefs = schema?.fields || [];
  const visibleCodes = new Set(fieldDefs.map((f) => f.code));

  // OCC 옵션명 (최종 UX 규칙)
  const isBuyoutOrAuction =
    normKey(userState.realEstateLoanType).includes("경락잔금") ||
    normKey(userState.realEstateLoanType).includes("매입잔금");
  const occSelfText = isBuyoutOrAuction ? "본인거주(예정)" : "본인거주";
  const occRentText = isBuyoutOrAuction ? "임대(예정)" : "임대";

  // OCC 칩 라벨 교체
  const occContainer = document.getElementById("naviOccupancyChips");
  if (occContainer) {
    const selfBtn = occContainer.querySelector('[data-occ="self"]');
    const rentBtn = occContainer.querySelector('[data-occ="rental"]');
    if (selfBtn) selfBtn.textContent = occSelfText;
    if (rentBtn) rentBtn.textContent = occRentText;
  }

  // Step5 각 입력 라벨 표시/숨김 + 라벨 텍스트/필수 표시
  const idToCode = {
    naviInputPropertyValue: "PV",
    naviInputSharePercent: "SP",
    naviInputSeniorLoan: "SL",
    naviInputDeposit: "DEP",
    naviInputRefinanceAmount: "REF",
    naviInputRequestedAmount: "REQ",
    naviInputAssumedBurden: "ASB",
  };

  Object.entries(idToCode).forEach(([id, code]) => {
    const input = document.getElementById(id);
    const label = input ? input.closest("label") : null;
    if (!label) return;

    const def = fieldDefs.find((f) => f.code === code);
    const shouldShow = Boolean(def);

    label.style.display = shouldShow ? "" : "none";
    label.toggleAttribute("data-required", Boolean(def?.required));

    if (def?.label) {
      // 라벨 텍스트: (원) 같은 suffix는 유지
      const suffix = (id === "naviInputSharePercent") ? " (%)" : " (원)";
      const txt = def.label.includes("(원)") || def.label.includes("(%)")
        ? def.label
        : def.label + suffix;
      setLabelText(label, txt);
    }
  });

  // OCC 블록 노출
  if (occBlock) {
    occBlock.style.display = visibleCodes.has("OCC") ? "" : "none";
    if (!visibleCodes.has("OCC")) {
      userState.occupancy = null;
      // 선택 표시 해제
      document.querySelectorAll("#naviOccupancyChips .navi-chip").forEach((c) => c.classList.remove("is-selected"));
    }
  }

  // DEP/ASB 조건부 노출/필수 변환 (note에 OCC 문구가 있을 때)
  const depDef = fieldDefs.find((f) => f.code === "DEP");
  const asbDef = fieldDefs.find((f) => f.code === "ASB");

  const depInput = document.getElementById("naviInputDeposit");
  const depLabel = depInput ? depInput.closest("label") : null;

  if (depLabel && depDef) {
    const note = String(depDef.note || "");
    const needsRental = note.includes("OCC") && (note.includes("임대") || note.includes("임대예정") || note.includes("임대중"));
    const isRental = userState.occupancy === "rental";

    if (needsRental) {
      depLabel.style.display = isRental ? "" : "none";
      depLabel.toggleAttribute("data-required", isRental);
      if (!isRental) {
        setMoneyValueById("naviInputDeposit", 0);
      }
    }
  }

  const asbInput = document.getElementById("naviInputAssumedBurden");
  const asbLabel = asbInput ? asbInput.closest("label") : null;
  if (asbLabel && asbDef) {
    const note = String(asbDef.note || "");
    // 매트릭스의 '선순위임차인인수'는 제거되었으므로: 경락잔금에서는 항상 선택 입력(노출)로 둔다.
    const isAuction = normKey(userState.realEstateLoanType).includes("경락잔금");
    if (isAuction) {
      asbLabel.style.display = "";
      asbLabel.toggleAttribute("data-required", false);
    } else {
      // note 기반 조건이 있으면(다른 케이스) 일단 항상 노출(선택)로 유지
      asbLabel.style.display = "";
      asbLabel.toggleAttribute("data-required", false);
    }
  }

  // Step5 도움말(상단) 보정
  if (helpEl) {
    if (!schema) {
      helpEl.textContent = "※ 선택하신 대출종류/부동산유형 조합에 대한 입력 스키마가 없습니다. 관리자 설정을 확인해주세요.";
    }
  }
}

function isRentalOcc() {
  return userState.occupancy === "rental";
}

function isStep5Complete() {
  const schema = getStep5Schema();
  if (!schema) return false;

  // 필수 항목 검사(조건부 필수 포함)
  for (const f of (schema.fields || [])) {
    if (!f.required) continue;

    if (f.code === "OCC") {
      if (!userState.occupancy) return false;
      continue;
    }
    if (f.code === "PV") {
      if (!userState.propertyValue) return false;
      continue;
    }
    if (f.code === "REQ") {
      if (!userState.requestedAmount) return false;
      continue;
    }
    if (f.code === "SL") {
      if (!userState.seniorLoan && userState.seniorLoan !== 0) return false;
      continue;
    }
    if (f.code === "DEP") {
      // note에 OCC 임대 시 필수 변환이 있을 수 있음
      const note = String(f.note || "");
      const conditional = note.includes("OCC") && (note.includes("임대") || note.includes("임대예정") || note.includes("임대중"));
      if (conditional) {
        if (isRentalOcc() && !userState.deposit) return false;
      } else {
        if (!userState.deposit && userState.deposit !== 0) return false;
      }
      continue;
    }
    if (f.code === "SP") {
      // percent 입력은 기본 100으로 간주
      continue;
    }
    if (f.code === "REF") {
      if (!userState.refinanceAmount) return false;
      continue;
    }
    if (f.code === "ASB") {
      if (!userState.assumedBurden) return false;
      continue;
    }
  }

  return true;
}

// ------------------------------------------------------
// UI 이벤트 바인딩
// ------------------------------------------------------

// chip helpers
function singleSelectChip(container, target) {
  const chips = container.querySelectorAll(".navi-chip");
  chips.forEach((c) => c.classList.remove("is-selected"));
  target.classList.add("is-selected");
}
function toggleChip(target) {
  target.classList.toggle("is-selected");
}

// 상단 MENU
function setupBetaMenu() {
  const toggle = document.getElementById("betaMenuToggle");
  const panel = document.getElementById("betaMenuPanel");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = panel.classList.contains("hide");
    if (isHidden) {
      panel.classList.remove("hide");
      toggle.setAttribute("aria-expanded", "true");
    } else {
      panel.classList.add("hide");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("click", (e) => {
    if (!panel.classList.contains("hide")) {
      if (!panel.contains(e.target) && e.target !== toggle) {
        panel.classList.add("hide");
        toggle.setAttribute("aria-expanded", "false");
      }
    }
  });
}

function setupStep1() {
  const container = document.getElementById("naviLoanCategoryChips");
  if (!container) return;
  container.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("navi-chip")) return;

    singleSelectChip(container, target);
    userState.mainCategory = target.getAttribute("data-main-cat");

    // 초기화(하위 선택)
    userState.region = null;
    userState.propertyType = null;
    userState.realEstateLoanType = null;
    userState.occupancy = null;
    uiState.hasRenderedResult = false;

    // 하위 칩 선택 표시 제거
    document.querySelectorAll("#naviRegionChips .navi-chip, #naviPropertyTypeChips .navi-chip, #naviRealEstateLoanTypeChips .navi-chip, #naviOccupancyChips .navi-chip")
      .forEach((c) => c.classList.remove("is-selected"));

    recalcAndUpdateSummary();
  });
}

function setupStep2() {
  const container = document.getElementById("naviRegionChips");
  if (!container) return;
  container.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("navi-chip")) return;

    singleSelectChip(container, target);
    userState.region = target.getAttribute("data-region");

    uiState.hasRenderedResult = false;
    recalcAndUpdateSummary();
  });
}

function setupStep3() {
  const container = document.getElementById("naviPropertyTypeChips");
  if (!container) return;
  container.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("navi-chip")) return;

    singleSelectChip(container, target);
    userState.propertyType = target.getAttribute("data-prop");

    // 대출종류 칩(매입잔금 2개) 노출 규칙 적용
    updateLoanTypeChipVisibility();

    // 하위 초기화
    userState.realEstateLoanType = null;
    userState.occupancy = null;
    uiState.hasRenderedResult = false;
    document.querySelectorAll("#naviRealEstateLoanTypeChips .navi-chip, #naviOccupancyChips .navi-chip").forEach((c) => c.classList.remove("is-selected"));

    recalcAndUpdateSummary();
  });
}

function setupStep4() {
  const container = document.getElementById("naviRealEstateLoanTypeChips");
  const helpEl = document.getElementById("naviLoanTypeHelp");
  if (!container) return;

  const helpTexts = {
    일반담보대출: "시세·선순위대출·임대보증금·필요대출금액을 합산해 LTV를 계산합니다.",
    임대보증금반환대출:
      "임대보증금 반환을 위한 대출입니다. (입력 스키마에 따라) 선순위 + 반환 보증금 + 추가 필요금액을 기준으로 LTV를 계산합니다.",
    지분대출: "지분율만큼 시세를 반영하여 LTV를 계산합니다. (예: 시세 5억, 지분 50% → 2.5억 기준)",
    경락잔금대출:
      "낙찰가(또는 감정가)와 선순위·필요 대출금액을 기준으로 잔금대출 LTV를 계산합니다. (인수 권리 금액 입력 가능)",
    대환대출:
      "선순위/보증금 중 상환 예정금액 + 신규 필요 대출금액을 합산하여 대환 후 LTV를 계산합니다.",
    "매입잔금(일반)":
      "일반 매입의 잔금 마련을 위한 대출입니다. (임대예정일 경우, 잔금일 보증금 선순위 구조를 함께 고려합니다.)",
    "매입잔금(분양)":
      "분양 매입의 잔금 마련을 위한 대출입니다. (임대예정일 경우, 잔금일 보증금 선순위 구조를 함께 고려합니다.)",
  };

  container.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("navi-chip")) return;
    if (target.style.display === "none") return; // 숨김 칩 클릭 방지

    singleSelectChip(container, target);
    const loanType = target.getAttribute("data-loan-type");
    userState.realEstateLoanType = loanType;

    // 하위 초기화
    userState.occupancy = null;
    document.querySelectorAll("#naviOccupancyChips .navi-chip").forEach((c) => c.classList.remove("is-selected"));
    uiState.hasRenderedResult = false;

    if (helpEl && loanType && helpTexts[loanType]) {
      helpEl.textContent = "※ " + helpTexts[loanType];
    }

    applyStep5Schema();
    recalcAndUpdateSummary();
  });
}

function setupStep5() {
  const amountWarningEl = document.getElementById("naviAmountWarning");
  const occContainer = document.getElementById("naviOccupancyChips");

  [
    "naviInputPropertyValue",
    "naviInputSharePercent",
    "naviInputSeniorLoan",
    "naviInputDeposit",
    "naviInputRefinanceAmount",
    "naviInputRequestedAmount",
    "naviInputAssumedBurden",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      uiState.hasRenderedResult = false;
      recalcAndUpdateSummary();
    });
  });

  if (occContainer) {
    occContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;

      singleSelectChip(occContainer, target);
      userState.occupancy = target.getAttribute("data-occ");

      // OCC 변경 시 DEP 조건부 노출 반영
      applyStep5Schema();

      uiState.hasRenderedResult = false;
      recalcAndUpdateSummary();
    });
  }

  if (amountWarningEl) amountWarningEl.style.display = "none";
}

function setupStep6Extra() {
  // 소득유형 (단일 선택)
  const incomeContainer = document.getElementById("naviExtraIncomeType");
  if (incomeContainer) {
    incomeContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;
      singleSelectChip(incomeContainer, target);
      userState.extra.incomeType = target.getAttribute("data-income");
      uiState.hasRenderedResult = false;
      recalcAndUpdateSummary(true);
    });
  }

  // 신용점수 구간 (단일 선택)
  const creditContainer = document.getElementById("naviExtraCreditBand");
  if (creditContainer) {
    creditContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;
      singleSelectChip(creditContainer, target);
      userState.extra.creditBand = target.getAttribute("data-credit");
      uiState.hasRenderedResult = false;
      recalcAndUpdateSummary(true);
    });
  }

  // 상환계획 (단일 선택)
  const repayContainer = document.getElementById("naviExtraRepayPlan");
  if (repayContainer) {
    repayContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;
      singleSelectChip(repayContainer, target);
      userState.extra.repayPlan = target.getAttribute("data-repay");
      uiState.hasRenderedResult = false;
      recalcAndUpdateSummary(true);
    });
  }

  // 대출금 필요시기 (단일 선택)
  const needContainer = document.getElementById("naviExtraNeedTiming");
  if (needContainer) {
    needContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;
      singleSelectChip(needContainer, target);
      userState.extra.needTiming = target.getAttribute("data-need");
      uiState.hasRenderedResult = false;
      recalcAndUpdateSummary(true);
    });
  }

  // 기타사항 (복수 선택)
  const othersContainer = document.getElementById("naviExtraOthers");
  if (othersContainer) {
    othersContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;

      toggleChip(target);
      const val = target.getAttribute("data-etc");
      if (!val) return;

      const arr = userState.extra.others || [];
      const idx = arr.indexOf(val);
      if (target.classList.contains("is-selected")) {
        if (idx === -1) arr.push(val);
      } else {
        if (idx !== -1) arr.splice(idx, 1);
      }
      userState.extra.others = arr;

      uiState.hasRenderedResult = false;
      recalcAndUpdateSummary(true);
    });
  }
}

// 버튼들
function setupResultButtons() {
  const recalcBtn = document.getElementById("naviRecalcBtn");
  if (recalcBtn) {
    recalcBtn.addEventListener("click", () => {
      uiState.hasRenderedResult = false;
      recalcAndUpdateSummary();
    });
  }

  const showBtn = document.getElementById("naviShowResultBtn");
  if (showBtn) {
    showBtn.addEventListener("click", () => {
      renderFinalResult();
    });
  }

  const adjustBtn = document.getElementById("naviAdjustConditionBtn");
  if (adjustBtn) {
    adjustBtn.addEventListener("click", () => {
      const target = document.getElementById("navi-step1");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const captureBtn = document.getElementById("naviCaptureBtn");
  if (captureBtn) {
    captureBtn.addEventListener("click", async () => {
      const panel = document.getElementById("naviResultWrapper");
      if (!panel || typeof html2canvas === "undefined") {
        alert("이미지 저장 기능을 사용할 수 없습니다. 브라우저의 캡처 기능을 이용해주세요.");
        return;
      }
      try {
        const canvas = await html2canvas(panel, {
          backgroundColor: "#ffffff",
          scale: window.devicePixelRatio || 2,
        });
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "huchu-navi-result.png";
        link.click();
      } catch (e) {
        console.error("capture error:", e);
        alert("이미지 생성 중 오류가 발생했습니다. 브라우저 캡처 기능을 이용해주세요.");
      }
    });
  }
}

// ------------------------------------------------------
// 필터링 / 계산 로직
// ------------------------------------------------------

// 입력값을 userState에 반영
function syncInputsToState() {
  userState.propertyValue = getMoneyValueById("naviInputPropertyValue");
  const shareEl = document.getElementById("naviInputSharePercent");
  userState.sharePercent = shareEl && shareEl.value !== "" ? Number(shareEl.value) : 100;

  userState.seniorLoan = getMoneyValueById("naviInputSeniorLoan");
  userState.deposit = getMoneyValueById("naviInputDeposit");
  userState.refinanceAmount = getMoneyValueById("naviInputRefinanceAmount");
  userState.requestedAmount = getMoneyValueById("naviInputRequestedAmount");
  userState.assumedBurden = getMoneyValueById("naviInputAssumedBurden");
}

function getPrincipalAmount() {
  const lt = normKey(userState.realEstateLoanType);
  // 임대보증금반환대출: 반환 보증금(DEP) + 추가 필요금액(REQ)
  if (lt.includes("임대보증금반환")) {
    return (userState.deposit || 0) + (userState.requestedAmount || 0);
  }
  return userState.requestedAmount || 0;
}

// LTV 계산
function calcLtv() {
  const {
    propertyValue,
    sharePercent,
    seniorLoan,
    deposit,
    refinanceAmount,
    requestedAmount,
    assumedBurden,
    realEstateLoanType,
  } = userState;

  if (!propertyValue) {
    return { ltv: null, totalDebtAfter: null, baseValue: null };
  }

  const ratio = sharePercent && sharePercent > 0 ? sharePercent / 100 : 1;
  const baseValue = propertyValue * ratio;

  let totalDebtAfter = 0;

  const seniorPlusDeposit = (seniorLoan || 0) + (deposit || 0);
  const req = requestedAmount || 0;
  const asb = assumedBurden || 0;

  if (!realEstateLoanType || normKey(realEstateLoanType) === normKey("일반담보대출")) {
    totalDebtAfter = seniorPlusDeposit + req;
  } else if (normKey(realEstateLoanType).includes("임대보증금반환")) {
    totalDebtAfter = seniorPlusDeposit + req; // DEP를 반환 보증금으로 입력할 경우에도 동일 합산
  } else if (normKey(realEstateLoanType).includes("지분")) {
    totalDebtAfter = seniorPlusDeposit + req;
  } else if (normKey(realEstateLoanType).includes("경락잔금")) {
    totalDebtAfter = (seniorLoan || 0) + req + asb + (deposit || 0);
  } else if (normKey(realEstateLoanType).includes("대환")) {
    const remaining = seniorPlusDeposit - (refinanceAmount || 0);
    totalDebtAfter = (remaining > 0 ? remaining : 0) + req;
  } else if (normKey(realEstateLoanType).includes("매입잔금")) {
    totalDebtAfter = (seniorLoan || 0) + req + (deposit || 0); // 임대예정 보증금 포함 가능
  } else {
    totalDebtAfter = seniorPlusDeposit + req;
  }

  if (!baseValue) {
    return { ltv: null, totalDebtAfter, baseValue };
  }

  const ltv = totalDebtAfter / baseValue;
  return { ltv, totalDebtAfter, baseValue };
}

// 최소 대출금액 체크 (유저 공통 규칙)
function passesGlobalMinAmount() {
  const amt = getPrincipalAmount();
  if (!amt) return false;

  const prop = userState.propertyType;
  if (!prop) return false;

  const isAptOrOfficetel = prop === "아파트" || prop === "오피스텔";
  const minByUserRule = isAptOrOfficetel ? 10000000 : 30000000; // 1,000만 / 3,000만
  return amt >= minByUserRule;
}

function checkGlobalMinAmount() {
  const warningEl = document.getElementById("naviAmountWarning");
  if (!warningEl) return;

  const amt = getPrincipalAmount();
  if (!amt) {
    warningEl.style.display = "none";
    warningEl.textContent = "";
    return;
  }

  const prop = userState.propertyType;
  if (!prop) {
    warningEl.style.display = "none";
    warningEl.textContent = "";
    return;
  }

  const isAptOrOfficetel = prop === "아파트" || prop === "오피스텔";
  const minByUserRule = isAptOrOfficetel ? 10000000 : 30000000; // 1,000만 / 3,000만
  if (amt < minByUserRule) {
    warningEl.style.display = "block";
    const txt = isAptOrOfficetel
      ? "주의: 아파트/오피스텔은 최소 대출금액 1,000만원 이상부터 가능합니다."
      : "주의: 해당 부동산 유형은 최소 대출금액 3,000만원 이상부터 가능합니다.";
    warningEl.textContent = txt;
  } else {
    warningEl.style.display = "none";
    warningEl.textContent = "";
  }
}

// 온투업 리스트 필터링 (추가조건 미적용 / 적용 두 케이스 모두 사용)
function filterLenders(applyExtras = false) {
  const lenders = naviLoanConfig.lenders || [];
  if (!lenders.length) return [];

  const { mainCategory, region, propertyType, realEstateLoanType, extra } = userState;

  const principalAmount = getPrincipalAmount();
  const { ltv } = calcLtv(); // ratio (0~1)

  const filtered = lenders.filter((l) => {
    if (l.isActive === false) return false;
    if (l.isNewLoanActive === false) return false;

    // ✅ 상품군 매칭: admin(products) ↔ navi(mainCategory)
    if (mainCategory) {
      const cats = l.loanCategories || [];
      if (cats.length && !includesNorm(cats, mainCategory)) return false;
    }

    // ✅ 부동산담보대출 매칭 (admin의 regions 구조를 우선 사용)
    if (mainCategory === "부동산담보대출") {
      // 1) admin regions 셀 우선
      const cell = getAdminRegionCell(l, region, propertyType);

      if (cell) {
        const enabled = (cell.enabled === true || cell.enabled === "true");
        if (!enabled) return false;

        // 대출종류
        if (realEstateLoanType) {
          const types = cell.loanTypes || [];
          if (types.length && !types.some((t) => normKey(t) === normKey(realEstateLoanType))) return false;
        }

        // 최소 대출금액 (업체 공통 최소값: realEstateMinLoanAmount) - 있으면 적용
        // (값이 1000 같은 형태면 만원 단위로 간주 -> 1,000만원)
        if (principalAmount) {
          const lenderMinWon = toWonMaybe(l.realEstateMinLoanAmount);
          if (lenderMinWon && principalAmount < lenderMinWon) return false;
        }

        // LTV 한도: cell.ltvMax는 퍼센트 문자열인 케이스가 많음 (예: "74.99")
        const maxPct = parseNumberLoose(cell.ltvMax);
        if (maxPct != null && maxPct > 0 && ltv != null) {
          if (ltv * 100 > maxPct + 1e-6) return false;
        }
      } else {
        // 2) fallback: 예전 형태(realEstateConfig) 지원
        const cfg = l.realEstateConfig || {};

        if (region) {
          const rgs = cfg.regions || [];
          if (rgs.length && !includesRegion(rgs, region)) return false;
        }

        if (propertyType) {
          const props = cfg.propertyTypes || [];
          if (props.length && !includesNorm(props, propertyType)) return false;
        }

        if (realEstateLoanType) {
          const types = cfg.loanTypes || [];
          if (types.length && !types.some((t) => normKey(t) === normKey(realEstateLoanType))) return false;
        }

        if (principalAmount) {
          const minMap = cfg.minLoanByProperty || {};
          const aptMin = minMap["아파트"] ?? 0;
          const otherMin = minMap["_기타"] ?? 0;
          const isApt = propertyType === "아파트";
          const lenderMin = isApt ? aptMin : otherMin;
          if (lenderMin && principalAmount < lenderMin) return false;
        }

        if (typeof cfg.maxTotalLtv === "number" && cfg.maxTotalLtv > 0) {
          if (ltv != null && ltv > cfg.maxTotalLtv + 1e-6) return false;
        }
      }
    }

  // ✅ 추가조건(6-1) — admin의 lender.extraConditions(string[])와 매칭
    if (applyExtras && mainCategory === "부동산담보대출") {
      const extraTokens = buildExtraTokensFromUser(extra);
      if (extraTokens.length) {
        if (!lenderMatchesExtraSelections(l, extraTokens)) return false;
      }
    }

      if (extra.others && extra.others.length) {
        const blocked = l.blockedFlags || {};
        for (const tag of extra.others) {
          if (tag === "세금체납" && blocked["taxArrears"]) return false;
          if (tag === "연체기록" && blocked["delinquency"]) return false;
          if (tag === "압류·가압류" && blocked["seizure"]) return false;
          if (tag === "개인회생" && blocked["bankruptcy"]) return false;
        }
      }
    }

    return true;
  });

  // 정렬: 제휴업체 우선 → displayOrder → 이름
  filtered.sort((a, b) => {
    if (a.isPartner && !b.isPartner) return -1;
    if (!a.isPartner && b.isPartner) return 1;

    const ao = typeof a.displayOrder === "number" ? a.displayOrder : 9999;
    const bo = typeof b.displayOrder === "number" ? b.displayOrder : 9999;
    if (ao !== bo) return ao - bo;

    const an = a.displayName || "";
    const bn = b.displayName || "";
    return an.localeCompare(bn, "ko");
  });

  return filtered;
}

// ------------------------------------------------------
// Step6(1차 결과): 업체명 비공개 + 금리/수수료 범위
// ------------------------------------------------------

function ensurePrimaryFeeUI() {
  const step6Card = document.querySelector("#navi-step6 .navi-card");
  if (!step6Card) return;

  if (document.getElementById("naviPrimaryFeePanel")) return;

  const div = document.createElement("div");
  div.id = "naviPrimaryFeePanel";
  div.style.marginTop = "10px";
  div.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <div style="flex:1;min-width:160px;border:1px solid #e5e7eb;border-radius:10px;padding:8px;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">대출금리 (최소~최대)</div>
        <div id="naviRangeInterest" style="font-weight:800;color:#111827;">-</div>
      </div>
      <div style="flex:1;min-width:160px;border:1px solid #e5e7eb;border-radius:10px;padding:8px;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">플랫폼수수료 (최소~최대)</div>
        <div id="naviRangePlatform" style="font-weight:800;color:#111827;">-</div>
      </div>
      <div style="flex:1;min-width:160px;border:1px solid #e5e7eb;border-radius:10px;padding:8px;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">중도상환수수료 (최소~최대)</div>
        <div id="naviRangePrepay" style="font-weight:800;color:#111827;">-</div>
      </div>
    </div>
    <div style="margin-top:6px;font-size:11px;color:#6b7280;">
      ※ 1차 결과는 <strong>업체명 비공개</strong>로, 조건에 따른 예상 범위만 제공합니다.
    </div>
  `;
  step6Card.appendChild(div);
}

function getFinancialInputsForCategory(lender, category) {
  const fin = lender?.financialInputs || {};
  if (!category) return null;

  // direct
  if (fin[category]) return fin[category];

  // normalized key match
  const keys = Object.keys(fin);
  const k = keys.find((x) => normKey(x) === normKey(category));
  return k ? fin[k] : null;
}

function calcFeeRanges(lenders, category) {
  let iMin = null, iMax = null;
  let pMin = null, pMax = null;
  let ppMin = null, ppMax = null;

  (lenders || []).forEach((l) => {
    const f = getFinancialInputsForCategory(l, category);
    if (!f) return;

    const i = parseNumberLoose(f.interestAvg);
    const p = parseNumberLoose(f.platformFeeAvg);
    const pp = parseNumberLoose(f.prepayFeeAvg);

    if (i != null) {
      if (iMin == null || i < iMin) iMin = i;
      if (iMax == null || i > iMax) iMax = i;
    }
    if (p != null) {
      if (pMin == null || p < pMin) pMin = p;
      if (pMax == null || p > pMax) pMax = p;
    }
    if (pp != null) {
      if (ppMin == null || pp < ppMin) ppMin = pp;
      if (ppMax == null || pp > ppMax) ppMax = pp;
    }
  });

  return { iMin, iMax, pMin, pMax, ppMin, ppMax };
}

function updatePrimaryFeeUI(coreMatched) {
  ensurePrimaryFeeUI();

  const { iMin, iMax, pMin, pMax, ppMin, ppMax } = calcFeeRanges(coreMatched, userState.mainCategory);

  const iEl = document.getElementById("naviRangeInterest");
  const pEl = document.getElementById("naviRangePlatform");
  const ppEl = document.getElementById("naviRangePrepay");
  if (iEl) iEl.textContent = fmtRange(iMin, iMax, "%", "미등록");
  if (pEl) pEl.textContent = fmtRange(pMin, pMax, "%", "미등록");
  if (ppEl) ppEl.textContent = fmtRange(ppMin, ppMax, "%", "미등록");
}

// ------------------------------------------------------
// 계산 결과 요약 / 카운트 업데이트 + 단계 노출 제어
// ------------------------------------------------------

function updateStepVisibility(primaryEligible) {
  // 기본: step1은 항상
  setSectionVisible("navi-step1", true);

  // step2: step1 선택 이후
  setSectionVisible("navi-step2", Boolean(userState.mainCategory));

  // 부동산담보대출 플로우(현재 집중)
  const isRE = userState.mainCategory === "부동산담보대출";

  // step3~5: 순차
  setSectionVisible("navi-step3", isRE && Boolean(userState.region));
  setSectionVisible("navi-step4", isRE && Boolean(userState.region) && Boolean(userState.propertyType));
  setSectionVisible("navi-step5", isRE && Boolean(userState.region) && Boolean(userState.propertyType) && Boolean(userState.realEstateLoanType));

  // step6: step5가 보여질 때 같이 보여줌(미완료면 안내)
  setSectionVisible("navi-step6", isRE && Boolean(userState.realEstateLoanType));

  // 6-1은 1차 결과 가능일 때만 열어줌
  setSectionVisible("navi-step6-1", Boolean(primaryEligible));

  // ✅ Step7(업체명 공개)는 6-1을 1개 이상 선택했을 때만
  setSectionVisible("navi-step7", Boolean(primaryEligible && extraSelected));
}

function hasAnyExtraSelected() {
  const e = userState.extra || {};
  return Boolean(
    e.incomeType ||
    e.creditBand ||
    e.repayPlan ||
    e.needTiming ||
    (Array.isArray(e.others) && e.others.length)
  );
}

function resolveActiveStep(primaryEligible) {
  if (!userState.mainCategory) return 1;
  if (!userState.region) return 2;

  if (userState.mainCategory === "부동산담보대출") {
    if (!userState.propertyType) return 3;
    if (!userState.realEstateLoanType) return 4;

    if (!isStep5Complete()) return 5;
    if (!primaryEligible) return 6;

    // primary ok
    if (uiState.hasRenderedResult) return 7;
    // 선택조건은 선택이므로, step6(1차결과)로 유지
    return 6;
  }

  // 기타 상품군(추후 확장)
  return 2;
}

function recalcAndUpdateSummary(onlyExtra = false) {
  syncInputsToState();
  checkGlobalMinAmount();

  const calcTextEl = document.getElementById("naviCalcSummaryText");
  const calcSubEl = document.getElementById("naviCalcSubText");
  const countInfoEl = document.getElementById("naviCalcCountInfo");
  const extraCountEl = document.getElementById("naviExtraCountInfo");
  const resultSummaryEl = document.getElementById("naviResultSummary");

  if (!calcTextEl || !calcSubEl || !resultSummaryEl) return;

  // Stepper
  ensureStepper();
  ensureLoanTypeChips();
  updateLoanTypeChipVisibility();

  // Step5 schema 적용(선택 상태에 따라)
  if (userState.mainCategory === "부동산담보대출" && userState.realEstateLoanType) {
    applyStep5Schema();
  }

  const { mainCategory, propertyType, realEstateLoanType } = userState;

  // 기본 단계 노출
  let primaryEligible = false;

  if (!mainCategory) {
    calcTextEl.textContent = "대출 상품군이 선택되지 않았습니다. 1단계에서 먼저 대출 상품군을 선택해주세요.";
    calcSubEl.textContent = "";
    if (countInfoEl) countInfoEl.style.display = "none";
    if (extraCountEl) extraCountEl.style.display = "none";
    resultSummaryEl.textContent = "상품군, 지역, 대출종류를 입력하시면 추천 온투업 결과를 볼 수 있습니다.";

    updateStepVisibility(false);
    renderStepper(1);
    return;
  }

  // 요약 문구
  let baseSummary = `선택 상품군: ${mainCategory}`;
  if (propertyType) baseSummary += ` / 부동산 유형: ${propertyType}`;
  if (realEstateLoanType) baseSummary += ` / 대출종류: ${realEstateLoanType}`;
  calcTextEl.textContent = baseSummary;

  // Step6 기본 문구: LTV 계산
  const { ltv, totalDebtAfter, baseValue } = calcLtv();
  if (ltv == null || !baseValue) {
    calcSubEl.textContent = "시세(또는 낙찰가) 등 핵심 정보가 부족하여 LTV를 계산할 수 없습니다.";
  } else {
    const pct = (ltv * 100).toFixed(1);
    const totalStr = formatWithCommas(String(Math.round(totalDebtAfter)));
    const baseStr = formatWithCommas(String(Math.round(baseValue)));
    calcSubEl.textContent = `예상 총 부담액은 약 ${totalStr}원, 담보가치는 약 ${baseStr}원으로 예상 LTV는 약 ${pct}% 수준입니다.`;
  }

  // 1차 결과(핵심 조건 기준) — 업체명 비공개
  const isRE = mainCategory === "부동산담보대출";
  const step5Complete = isRE ? isStep5Complete() : false;

  const coreMatched = step5Complete ? filterLenders(false) : [];
  const extraMatched = step5Complete ? filterLenders(true) : [];

  const globalMinOK = step5Complete ? passesGlobalMinAmount() : false;

  primaryEligible = Boolean(step5Complete && globalMinOK && coreMatched.length);

  if (countInfoEl) {
    if (!isRE || !userState.realEstateLoanType) {
      countInfoEl.style.display = "none";
    } else if (!step5Complete) {
      countInfoEl.style.display = "inline-block";
      countInfoEl.textContent = "아직 입력이 부족합니다. 5단계 필수 항목을 모두 입력하면 1차 결과를 확인할 수 있습니다.";
    } else if (!globalMinOK) {
      countInfoEl.style.display = "inline-block";
      countInfoEl.textContent = "현재 입력한 대출금액이 최소 기준 미만입니다. (아파트/오피스텔 1,000만원·그 외 3,000만원 이상)";
    } else if (!coreMatched.length) {
      countInfoEl.style.display = "inline-block";
      countInfoEl.textContent = "현재 조건으로는 매칭되는 온투업체가 없습니다. LTV/대출금액/유형/지역을 조정해보세요.";
    } else {
      countInfoEl.style.display = "inline-block";
      countInfoEl.textContent = `✅ 1차 결과: 조건상 매칭 온투업체 ${coreMatched.length}곳 (업체명 비공개)`;
      updatePrimaryFeeUI(coreMatched);
    }
  }

  // 추가조건 적용 카운트
  if (extraCountEl) {
    if (!primaryEligible) {
      extraCountEl.style.display = "none";
    } else if (!extraMatched.length) {
      extraCountEl.style.display = "inline-block";
      extraCountEl.textContent = "추가조건까지 고려하면 추천 가능한 온투업체가 없습니다. 일부 추가조건을 완화해보세요.";
    } else {
      extraCountEl.style.display = "inline-block";
      extraCountEl.textContent = `추가조건까지 반영한 추천 온투업체: ${extraMatched.length}곳`;
    }
  }

  // Step7 요약 문구
  if (!primaryEligible) {
    resultSummaryEl.textContent = "아직 1차 결과(대출 가능 여부)가 확정되지 않았습니다. 위 단계 입력을 완료해주세요.";
  } else {
    const { ltv: l } = calcLtv();
    const ltvText = l != null ? ` / 예상 LTV 약 ${(l * 100).toFixed(1)}%` : "";
    resultSummaryEl.textContent = `1차 결과 통과: 업체명 공개는 6-1 선택조건 입력 후 가능합니다.${ltvText}`;
  }

  // 단계 노출 + 스텝퍼
  updateStepVisibility(primaryEligible);
  const active = resolveActiveStep(primaryEligible);
  renderStepper(active);

  // 1차 결과 불가로 떨어지면, Step7 렌더 상태 초기화
  if (!primaryEligible) uiState.hasRenderedResult = false;

  // Step7이 보이지 않는 상태면 내부 패널 초기화(혼동 방지)
  if (!primaryEligible) {
    const panel = document.getElementById("naviResultPanel");
    if (panel) {
      panel.innerHTML = `
        <div class="navi-empty-card">
          아직 결과가 없습니다.<br />
          <span style="font-size:11px;">
            위 조건을 모두 입력하신 후 1차 결과가 가능으로 나오면 <strong>[네비게이션 결과 보기]</strong> 버튼이 활성 흐름으로 이어집니다.
          </span>
        </div>
      `;
    }
  }
}

// ------------------------------------------------------
// 최종 결과 렌더링 (Step7) - 3컬럼(금리/플랫폼/중도상환)
// ------------------------------------------------------

function renderFee3Cols(lender) {
  const f = getFinancialInputsForCategory(lender, userState.mainCategory) || {};
  const i = f.interestAvg;
  const p = f.platformFeeAvg;
  const pp = f.prepayFeeAvg;

  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 0;">
      <div style="flex:1;min-width:160px;border:1px solid #e5e7eb;border-radius:10px;padding:8px;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">대출금리(평균)</div>
        <div style="font-weight:800;color:#111827;">${fmtRange(parseNumberLoose(i), parseNumberLoose(i), "%", "미등록")}</div>
      </div>
      <div style="flex:1;min-width:160px;border:1px solid #e5e7eb;border-radius:10px;padding:8px;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">플랫폼수수료(평균)</div>
        <div style="font-weight:800;color:#111827;">${fmtRange(parseNumberLoose(p), parseNumberLoose(p), "%", "미등록")}</div>
      </div>
      <div style="flex:1;min-width:160px;border:1px solid #e5e7eb;border-radius:10px;padding:8px;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">중도상환수수료(평균)</div>
        <div style="font-weight:800;color:#111827;">${fmtRange(parseNumberLoose(pp), parseNumberLoose(pp), "%", "미등록")}</div>
      </div>
    </div>
  `;
}

function renderFinalResult() {
  const panel = document.getElementById("naviResultPanel");
  const summaryEl = document.getElementById("naviResultSummary");
  if (!panel || !summaryEl) return;

  const { mainCategory } = userState;
  if (!mainCategory) {
    alert("먼저 1단계에서 대출 상품군을 선택해주세요.");
    return;
  }

  // 1차 결과 통과 여부
  syncInputsToState();
  const step5Complete = isStep5Complete();
  const coreMatched = step5Complete ? filterLenders(false) : [];
  const primaryEligible = Boolean(step5Complete && passesGlobalMinAmount() && coreMatched.length);

  if (!primaryEligible) {
    alert("아직 1차 결과(대출 가능 여부)가 충족되지 않았습니다. 5단계 필수 입력과 조건을 확인해주세요.");
    return;
  }

  // ------------------------------------------------------
// Step6-1 추가조건(admin extraConditions) 매칭
// ------------------------------------------------------

function buildExtraTokensFromUser(extra) {
  const tokens = [];
  if (extra?.incomeType) tokens.push({ prefix: "incomeType", value: extra.incomeType });
  if (extra?.creditBand) tokens.push({ prefix: "creditBand", value: extra.creditBand });
  if (extra?.repayPlan) tokens.push({ prefix: "repayPlan", value: extra.repayPlan });
  if (extra?.needTiming) tokens.push({ prefix: "needTiming", value: extra.needTiming });
  (extra?.others || []).forEach((v) => tokens.push({ prefix: "etc", value: v }));
  return tokens;
}

function extraTokenCandidates(prefix, value) {
  const p = String(prefix || "");
  const v = String(value || "");
  // admin 저장 포맷이 약간 달라도 매칭되게 후보를 여러 개 둠
  return [
    `${p}:${v}`,
    `${p}=${v}`,
    `${p}_${v}`,
    `${p}-${v}`,
    v, // (혹시 admin이 값만 저장한 경우)
  ].map(normKey);
}

function lenderExtraConditionSet(l) {
  const arr = Array.isArray(l?.extraConditions) ? l.extraConditions : [];
  return new Set(arr.map(normKey));
}

function lenderMatchesExtraSelections(l, extraTokens) {
  if (!extraTokens || !extraTokens.length) return true; // 선택 안했으면 필터링 X

  const set = lenderExtraConditionSet(l);

  // ✅ 정책(엄격): 차주가 뭔가 선택했는데 admin이 extraConditions를 아예 안 넣었으면 "매칭 불가"
  //    (만약 "미등록은 통과"로 하고 싶으면 -> 아래 줄을 `if (set.size === 0) return true;` 로 바꾸면 됨)
  if (set.size === 0) return false;

  for (const t of extraTokens) {
    const cands = extraTokenCandidates(t.prefix, t.value);
    const ok = cands.some((c) => set.has(c));
    if (!ok) return false;
  }
  return true;
}

  const matched = filterLenders(true);

  if (!matched.length) {
    summaryEl.textContent =
      "현재 추가조건까지 고려하면 추천 온투업체가 없습니다. 일부 추가조건을 완화해보세요.";
    panel.innerHTML = `
      <div class="navi-empty-card">
        <div style="font-weight:600;margin-bottom:4px;">추가조건 적용 결과: 추천 온투업체가 없습니다.</div>
        <div style="font-size:11px;">
          · 신용점수 구간, 기타사항(세금체납/연체/압류/개인회생)을 완화하면 선택지가 늘 수 있습니다.<br/>
          · 대출금액/LTV를 조정하는 것도 도움이 됩니다.
        </div>
      </div>
    `;
    uiState.hasRenderedResult = false;
    renderStepper(6);
    return;
  }

  // 상단 요약
  const { ltv } = calcLtv();
  const ltvText = ltv != null ? ` / 예상 LTV 약 ${(ltv * 100).toFixed(1)}%` : "";
  summaryEl.textContent = `추천 온투업체 ${matched.length}곳${ltvText}`;

  // 조건 요약 문장
  const condParts = [];
  if (userState.mainCategory) condParts.push(userState.mainCategory);
  if (userState.propertyType) condParts.push(userState.propertyType);
  if (userState.realEstateLoanType) condParts.push(userState.realEstateLoanType);
  if (userState.region) condParts.push(userState.region);
  const condSummary = condParts.join(" / ");

  const reqAmt = getPrincipalAmount()
    ? formatWithCommas(String(getPrincipalAmount())) + "원"
    : "입력 없음";

  let html = "";
  html += `<div style="margin-bottom:8px;font-size:12px;color:#374151;">`;
  html += `<div>요청 조건 요약: <strong>${condSummary || "조건 미입력"}</strong></div>`;
  html += `<div>요청 대출금액(원): <strong>${reqAmt}</strong></div>`;
  html += `</div>`;

  matched.forEach((l) => {
    const cats = l.loanCategories || [];
    const cfg = l.realEstateConfig || {};
    const regions = cfg.regions || [];
    const props = cfg.propertyTypes || [];
    const types = cfg.loanTypes || [];
    const phone = l.channels?.phoneNumber || "";
    const kakao = l.channels?.kakaoUrl || "";

    html += `<div class="navi-lender-item">`;
    html += `<div class="navi-lender-name">${l.displayName || "(이름 없음)"}`;
    if (l.isPartner) {
      html += ` <span class="navi-tag" style="background:#111827;color:#f9fafb;border-color:#111827;">제휴 온투업체</span>`;
    }
    html += `</div>`;

    // ✅ 3컬럼(금리/플랫폼/중도상환)
    html += renderFee3Cols(l);

    html += `<div class="navi-lender-meta" style="margin-top:8px;">`;
    if (cats.length) html += `상품군: ${cats.join(", ")} `;
    if (regions.length) html += `| 취급지역: ${regions.join(", ")} `;
    if (props.length) html += `| 담보유형: ${props.join(", ")} `;
    if (types.length) html += `| 대출종류: ${types.join(", ")} `;
    html += `</div>`;

    html += `<div>`;
    if (l.isPartner) {
      html += `<span class="navi-tag">후추와 제휴된 온투업체 (광고비 지급)</span>`;
      html += `<span class="navi-tag">※ 제휴업체는 동일 조건일 때 보다 낮은 비용·우선 상담 가능</span>`;
    } else {
      html += `<span class="navi-tag">비제휴 온투업체 (정보제공용)</span>`;
    }
    html += `</div>`;

    // 제휴업체만 상담채널 노출
    if (l.isPartner) {
      html += `<div class="navi-lender-actions">`;
      if (phone) {
        const telHref = phone.replace(/\s+/g, "");
        html += `<a class="navi-btn-secondary" href="tel:${telHref}">유선 상담 (${phone})</a>`;
      } else {
        html += `<span class="navi-btn-secondary" style="cursor:default;opacity:.7;">유선 상담 번호 미등록</span>`;
      }
      if (kakao) {
        html += `<a class="navi-btn-primary" href="${kakao}" target="_blank" rel="noopener noreferrer">카카오톡 채팅상담 바로가기</a>`;
      } else {
        html += `<span class="navi-btn-secondary" style="cursor:default;opacity:.7;">카카오톡 채널 미등록</span>`;
      }
      html += `</div>`;
    } else {
      html += `<div class="navi-help" style="margin-top:8px;">※ 비제휴 업체는 상담 채널을 공개하지 않습니다.</div>`;
    }

    html += `</div>`;
  });

  panel.innerHTML = html;

  uiState.hasRenderedResult = true;
  renderStepper(7);

  // Step7으로 스크롤
  const s7 = document.getElementById("navi-step7");
  if (s7) s7.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ------------------------------------------------------
// 초기화
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ navi-beta.js loaded");
  setupBetaMenu();
  ensureStepper();
  ensureLoanTypeChips();

  // 기존 input들 money 포맷
  setupMoneyInputs();

  await loadNaviLoanConfig();

  setupStep1();
  setupStep2();
  setupStep3();
  setupStep4();

  // Step5의 ASB 필드는 동적 생성되므로 먼저 생성 후 바인딩
  ensureAssumedBurdenField();
  setupStep5();

  setupStep6Extra();
  setupResultButtons();

  // 초기 렌더
  recalcAndUpdateSummary();
});
