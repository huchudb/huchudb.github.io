// /assets/navi-beta.js  (후추 네비게이션 – 베타용)
// NOTE: Step5 schema is generated from step5.매트릭스.xlsx (최종본)

console.log("✅ navi-beta.js loaded");

// ------------------------------------------------------
// 공통 상수 / 유틸
// ------------------------------------------------------

const API_BASE = "https://huchudb-github-io.vercel.app";
const NAVI_LOAN_CONFIG_ENDPOINT = `${API_BASE}/api/loan-config`;
const LENDERS_CONFIG_API = `${API_BASE}/api/lenders-config`;
const NAVI_LOAN_CONFIG_LOCAL_KEY = "huchu_navi_loan_config_v1";

// Step5 matrix (propertyType × loanType)
const STEP5_SCHEMA_MATRIX = {
  "아파트": {
    "일반담보대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "KB시세REQ [필수] “필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“KB시세REQ [필수] “필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “KB시세”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "임대보증금반환대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "KB시세(원)",
          "conditionalRequired": null,
          "raw": "“KB시세(원)"
        },
        {
          "key": "DEP",
          "required": true,
          "label": "반환 임대보증금(원)",
          "conditionalRequired": null,
          "raw": "“반환 임대보증금(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "REQ",
          "required": false,
          "label": "추가 필요금액(원)",
          "conditionalRequired": null,
          "raw": "“추가 필요금액(원)”"
        }
      ],
      "raw": "PV [필수] “KB시세(원)”\nDEP [필수] “반환 임대보증금(원)”\nSL [선택] “선순위 대출금액(원)”\nREQ [선택] “추가 필요금액(원)”"
    },
    "지분대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "KB시세(원)",
          "conditionalRequired": null,
          "raw": "“KB시세(원)"
        },
        {
          "key": "SP",
          "required": true,
          "label": "지분율(%)",
          "conditionalRequired": null,
          "raw": "“지분율(%)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “KB시세(원)”\nSP [필수] “지분율(%)”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "경락잔금대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주예정 or 임대예정 or 선순위임차인인수",
          "conditionalRequired": null,
          "raw": "본인거주예정 or 임대예정 or 선순위임차인인수"
        },
        {
          "key": "PV",
          "required": true,
          "label": "KB시세(원)",
          "conditionalRequired": null,
          "raw": "“KB시세”"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "ASB",
          "required": false,
          "label": "인수되는 금액(원)",
          "conditionalRequired": null,
          "raw": "“인수되는 금액(원)”/OCC 선순위임차인인수 선택시 표현+필수로 변환"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 예정 임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주예정 or 임대예정 or 선순위임차인인수\nPV [필수] “KB시세”\n”REQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nASB [선택] “인수되는 금액(원)”/OCC 선순위임차인인수 선택시 표현+필수로 변환\nDEP [선택] “선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
    },
    "대환대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "KB시세(원)",
          "conditionalRequired": null,
          "raw": "“KB시세(원)"
        },
        {
          "key": "SL",
          "required": true,
          "label": "선순위 총 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 총 대출금액(원)"
        },
        {
          "key": "REF",
          "required": true,
          "label": "상환할 선순위 금액(원)",
          "conditionalRequired": null,
          "raw": "“상환할 선순위 금액(원)"
        },
        {
          "key": "REQ",
          "required": false,
          "label": "추가 필요금액(원)",
          "conditionalRequired": null,
          "raw": "“추가 필요금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “KB시세(원)”\nSL [필수] “선순위 총 대출금액(원)”\nREF [필수] “상환할 선순위 금액(원)”\nREQ [선택] “추가 필요금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "매입잔금(일반)": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주예정 or 임대예정",
          "conditionalRequired": null,
          "raw": "본인거주예정 or 임대예정"
        },
        {
          "key": "PV",
          "required": true,
          "label": "KB시세REQ [필수] “필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“KB시세REQ [필수] “필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "예정 선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“예정 선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 예정 임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주예정 or 임대예정\nPV [필수] “KB시세”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “예정 선순위 대출금액(원)”\nDEP [선택] “선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
    },
    "매입잔금(분양)": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주예정 or 임대예정",
          "conditionalRequired": null,
          "raw": "본인거주예정 or 임대예정"
        },
        {
          "key": "PV",
          "required": true,
          "label": "분양가REQ [필수] “필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“분양가REQ [필수] “필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "예정 선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“예정 선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 예정 임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주예정 or 임대예정\nPV [필수] “분양가”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “예정 선순위 대출금액(원)”\nDEP [선택] “선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
    }
  },
  "다세대/연립": {
    "일반담보대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "하우스머치시세REQ [필수] “필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“하우스머치시세REQ [필수] “필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “하우스머치시세”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "임대보증금반환대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "하우스머치시세(원)",
          "conditionalRequired": null,
          "raw": "“하우스머치시세(원)"
        },
        {
          "key": "DEP",
          "required": true,
          "label": "반환 임대보증금(원)",
          "conditionalRequired": null,
          "raw": "“반환 임대보증금(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "REQ",
          "required": false,
          "label": "추가 필요금액(원)",
          "conditionalRequired": null,
          "raw": "“추가 필요금액(원)”"
        }
      ],
      "raw": "PV [필수] “하우스머치시세(원)”\nDEP [필수] “반환 임대보증금(원)”\nSL [선택] “선순위 대출금액(원)”\nREQ [선택] “추가 필요금액(원)”"
    },
    "지분대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "하우스머치시세(원)",
          "conditionalRequired": null,
          "raw": "“하우스머치시세(원)"
        },
        {
          "key": "SP",
          "required": true,
          "label": "지분율(%)",
          "conditionalRequired": null,
          "raw": "“지분율(%)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “하우스머치시세(원)”\nSP [필수] “지분율(%)”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "경락잔금대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주예정 or 임대예정 or 선순위임차인인수",
          "conditionalRequired": null,
          "raw": "본인거주예정 or 임대예정 or 선순위임차인인수"
        },
        {
          "key": "PV",
          "required": true,
          "label": "하우스머치시세SL [선택] “선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“하우스머치시세SL [선택] “선순위 대출금액(원)”"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "ASB",
          "required": false,
          "label": "인수되는 금액(원)",
          "conditionalRequired": null,
          "raw": "“인수되는 금액(원)”/OCC 선순위임차인인수 선택시 표현+필수로 변환"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 예정 임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주예정 or 임대예정 or 선순위임차인인수\nPV [필수] “하우스머치시세”\nSL [선택] “선순위 대출금액(원)”\n”REQ [필수] “필요 대출금액(원)”\nASB [선택] “인수되는 금액(원)”/OCC 선순위임차인인수 선택시 표현+필수로 변환\nDEP [선택] “선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
    },
    "대환대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "하우스머치시세(원)",
          "conditionalRequired": null,
          "raw": "“하우스머치시세(원)"
        },
        {
          "key": "SL",
          "required": true,
          "label": "선순위 총 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 총 대출금액(원)"
        },
        {
          "key": "REF",
          "required": true,
          "label": "상환할 선순위 금액(원)",
          "conditionalRequired": null,
          "raw": "“상환할 선순위 금액(원)"
        },
        {
          "key": "REQ",
          "required": false,
          "label": "추가 필요금액(원)",
          "conditionalRequired": null,
          "raw": "“추가 필요금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “하우스머치시세(원)”\nSL [필수] “선순위 총 대출금액(원)”\nREF [필수] “상환할 선순위 금액(원)”\nREQ [선택] “추가 필요금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "매입잔금(일반)": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주예정 or 임대예정",
          "conditionalRequired": null,
          "raw": "본인거주예정 or 임대예정"
        },
        {
          "key": "PV",
          "required": true,
          "label": "하우스머치시세REQ [필수] “필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "\"하우스머치시세REQ [필수] “필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "예정 선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“예정 선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 예정 임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주예정 or 임대예정\nPV [필수] \"하우스머치시세”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “예정 선순위 대출금액(원)”\nDEP [선택] “선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
    },
    "매입잔금(분양)": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주예정 or 임대예정",
          "conditionalRequired": null,
          "raw": "본인거주예정 or 임대예정"
        },
        {
          "key": "PV",
          "required": true,
          "label": "분양가REQ [필수] “필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“분양가REQ [필수] “필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "예정 선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“예정 선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 예정 임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주예정 or 임대예정\nPV [필수] “분양가”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “예정 선순위 대출금액(원)”\nDEP [선택] “선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
    }
  },
  "오피스텔": {
    "일반담보대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "KB시세/시세(원)",
          "conditionalRequired": null,
          "raw": "“KB시세/시세(원)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “KB시세/시세(원)”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "임대보증금반환대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "KB시세/시세(원)",
          "conditionalRequired": null,
          "raw": "“KB시세/시세(원)"
        },
        {
          "key": "DEP",
          "required": true,
          "label": "반환 임대보증금(원)",
          "conditionalRequired": null,
          "raw": "“반환 임대보증금(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "REQ",
          "required": false,
          "label": "추가 필요금액(원)",
          "conditionalRequired": null,
          "raw": "“추가 필요금액(원)”"
        }
      ],
      "raw": "PV [필수] “KB시세/시세(원)”\nDEP [필수] “반환 임대보증금(원)”\nSL [선택] “선순위 대출금액(원)”\nREQ [선택] “추가 필요금액(원)”"
    },
    "지분대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "KB시세/시세(원)",
          "conditionalRequired": null,
          "raw": "“KB시세/시세(원)"
        },
        {
          "key": "SP",
          "required": true,
          "label": "지분율(%)",
          "conditionalRequired": null,
          "raw": "“지분율(%)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “KB시세/시세(원)”\nSP [필수] “지분율(%)”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "경락잔금대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주예정 or 임대예정 or 선순위임차인인수",
          "conditionalRequired": null,
          "raw": "본인거주예정 or 임대예정 or 선순위임차인인수"
        },
        {
          "key": "PV",
          "required": true,
          "label": "낙찰가or감정가(원)",
          "conditionalRequired": null,
          "raw": "“낙찰가or감정가(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)”"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "ASB",
          "required": false,
          "label": "인수되는 금액(원)",
          "conditionalRequired": null,
          "raw": "“인수되는 금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주예정 or 임대예정 or 선순위임차인인수\nPV [필수] “낙찰가or감정가(원)”\nSL [선택] “선순위 대출금액(원)”\n”REQ [필수] “필요 대출금액(원)”\nASB [선택] “인수되는 금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "대환대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "KB시세/시세(원)",
          "conditionalRequired": null,
          "raw": "“KB시세/시세(원)"
        },
        {
          "key": "SL",
          "required": true,
          "label": "선순위 총 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 총 대출금액(원)"
        },
        {
          "key": "REF",
          "required": true,
          "label": "상환할 선순위 금액(원)",
          "conditionalRequired": null,
          "raw": "“상환할 선순위 금액(원)"
        },
        {
          "key": "REQ",
          "required": false,
          "label": "추가 필요금액(원)",
          "conditionalRequired": null,
          "raw": "“추가 필요금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “KB시세/시세(원)”\nSL [필수] “선순위 총 대출금액(원)”\nREF [필수] “상환할 선순위 금액(원)”\nREQ [선택] “추가 필요금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "매입잔금(일반)": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주예정 or 임대예정",
          "conditionalRequired": null,
          "raw": "본인거주예정 or 임대예정"
        },
        {
          "key": "PV",
          "required": true,
          "label": "KB시세or매입가REQ [필수] “필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“KB시세or매입가REQ [필수] “필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "예정 선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“예정 선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 예정 임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주예정 or 임대예정\nPV [필수] “KB시세or매입가”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “예정 선순위 대출금액(원)”\nDEP [선택] “선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
    },
    "매입잔금(분양)": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주예정 or 임대예정",
          "conditionalRequired": null,
          "raw": "본인거주예정 or 임대예정"
        },
        {
          "key": "PV",
          "required": true,
          "label": "분양가REQ [필수] “필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“분양가REQ [필수] “필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "예정 선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“예정 선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 예정 임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주예정 or 임대예정\nPV [필수] “분양가”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “예정 선순위 대출금액(원)”\nDEP [선택] “선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
    }
  },
  "단독/다가구": {
    "일반담보대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "시세(원)",
          "conditionalRequired": null,
          "raw": "“시세(원)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “시세(원)”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "임대보증금반환대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "시세(원)",
          "conditionalRequired": null,
          "raw": "“시세(원)"
        },
        {
          "key": "DEP",
          "required": true,
          "label": "총 임대보증금(원)",
          "conditionalRequired": null,
          "raw": "“총 임대보증금(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "REF",
          "required": true,
          "label": "임대보증금 반환 금액(원)",
          "conditionalRequired": null,
          "raw": "“임대보증금 반환 금액(원)"
        },
        {
          "key": "REQ",
          "required": false,
          "label": "추가 필요금액(원)",
          "conditionalRequired": null,
          "raw": "“추가 필요금액(원)”"
        }
      ],
      "raw": "PV [필수] “시세(원)”\nDEP [필수] “총 임대보증금(원)”\nSL [선택] “선순위 대출금액(원)”\nREF [필수] “임대보증금 반환 금액(원)”\nREQ [선택] “추가 필요금액(원)”"
    },
    "지분대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "시세(원)",
          "conditionalRequired": null,
          "raw": "“시세(원)"
        },
        {
          "key": "SP",
          "required": true,
          "label": "지분율(%)",
          "conditionalRequired": null,
          "raw": "“지분율(%)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “시세(원)”\nSP [필수] “지분율(%)”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "경락잔금대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주예정 or 임대예정 or 선순위임차인인수",
          "conditionalRequired": null,
          "raw": "본인거주예정 or 임대예정 or 선순위임차인인수"
        },
        {
          "key": "PV",
          "required": true,
          "label": "낙찰가or감정가(원)",
          "conditionalRequired": null,
          "raw": "“낙찰가or감정가(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)”"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "ASB",
          "required": false,
          "label": "인수되는 금액(원)",
          "conditionalRequired": null,
          "raw": "“인수되는 금액(원)”/OCC 선순위임차인인수 선택시 표현+필수로 변환"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 예정 임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주예정 or 임대예정 or 선순위임차인인수\nPV [필수] “낙찰가or감정가(원)”\nSL [선택] “선순위 대출금액(원)”\n”REQ [필수] “필요 대출금액(원)”\nASB [선택] “인수되는 금액(원)”/OCC 선순위임차인인수 선택시 표현+필수로 변환\nDEP [선택] “선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
    },
    "대환대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "시세(원)",
          "conditionalRequired": null,
          "raw": "“시세(원)"
        },
        {
          "key": "SL",
          "required": true,
          "label": "선순위 총 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 총 대출금액(원)"
        },
        {
          "key": "REF",
          "required": true,
          "label": "상환할 선순위 금액(원)",
          "conditionalRequired": null,
          "raw": "“상환할 선순위 금액(원)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "추가 필요금액(원)",
          "conditionalRequired": null,
          "raw": "“추가 필요금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “시세(원)”\nSL [필수] “선순위 총 대출금액(원)”\nREF [필수] “상환할 선순위 금액(원)”\nREQ [필수] “추가 필요금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "매입잔금(일반)": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주예정 or 임대예정",
          "conditionalRequired": null,
          "raw": "본인거주예정 or 임대예정"
        },
        {
          "key": "PV",
          "required": true,
          "label": "매입가/감정가REQ [필수] “필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“매입가/감정가REQ [필수] “필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 예정 임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주예정 or 임대예정\nPV [필수] “매입가/감정가”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “선순위 예정 임대보증금액(원)” / OCC 임대예정 선택시 표현+필수로 변환."
    },
    "매입잔금(분양)": {
      "supported": false
    }
  },
  "토지/임야": {
    "일반담보대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "시세/감정가(원)",
          "conditionalRequired": null,
          "raw": "“시세/감정가(원)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)”"
        }
      ],
      "raw": "PV [필수] “시세/감정가(원)”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”"
    },
    "임대보증금반환대출": {
      "supported": false
    },
    "지분대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "시세/감정가(원)",
          "conditionalRequired": null,
          "raw": "“시세/감정가(원)"
        },
        {
          "key": "SP",
          "required": true,
          "label": "지분율(%)",
          "conditionalRequired": null,
          "raw": "“지분율(%)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)”"
        }
      ],
      "raw": "PV [필수] “시세/감정가(원)”\nSP [필수] “지분율(%)”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”"
    },
    "경락잔금대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "낙찰가or감정가(원)",
          "conditionalRequired": null,
          "raw": "“낙찰가or감정가(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "ASB",
          "required": false,
          "label": "인수되는 금액(원)(원)",
          "conditionalRequired": null,
          "raw": "“인수되는 금액(원)(원)”"
        }
      ],
      "raw": "PV [필수] “낙찰가or감정가(원)”\nSL [선택] “선순위 대출금액(원)”REQ [필수] “필요 대출금액(원)”\nASB [선택] “인수되는 금액(원)(원)”"
    },
    "대환대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "시세/감정가(원)",
          "conditionalRequired": null,
          "raw": "“시세/감정가(원)"
        },
        {
          "key": "SL",
          "required": true,
          "label": "선순위 총 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 총 대출금액(원)"
        },
        {
          "key": "REF",
          "required": true,
          "label": "상환할 선순위 금액(원)",
          "conditionalRequired": null,
          "raw": "“상환할 선순위 금액(원)"
        },
        {
          "key": "REQ",
          "required": false,
          "label": "추가 필요금액(원)",
          "conditionalRequired": null,
          "raw": "“추가 필요금액(원)”"
        }
      ],
      "raw": "PV [필수] “시세/감정가(원)”\nSL [필수] “선순위 총 대출금액(원)”\nREF [필수] “상환할 선순위 금액(원)”\nREQ [선택] “추가 필요금액(원)”"
    },
    "매입잔금(일반)": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "매입가/감정가(원)",
          "conditionalRequired": null,
          "raw": "“매입가/감정가(원)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)”"
        }
      ],
      "raw": "PV [필수] “매입가/감정가(원)”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”"
    },
    "매입잔금(분양)": {
      "supported": false
    }
  },
  "근린생활시설": {
    "일반담보대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "시세REQ [필수] “필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“시세REQ [필수] “필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": null,
          "raw": "“임대보증금액(원)”"
        }
      ],
      "raw": "PV [필수] “시세”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “임대보증금액(원)”"
    },
    "임대보증금반환대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "시세(원)",
          "conditionalRequired": null,
          "raw": "“시세(원)"
        },
        {
          "key": "DEP",
          "required": true,
          "label": "총 임대보증금(원)",
          "conditionalRequired": null,
          "raw": "“총 임대보증금(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "REF",
          "required": true,
          "label": "임대보증금 반환 금액(원)",
          "conditionalRequired": null,
          "raw": "“임대보증금 반환 금액(원)"
        },
        {
          "key": "REQ",
          "required": false,
          "label": "추가 필요금액(원)",
          "conditionalRequired": null,
          "raw": "“추가 필요금액(원)”"
        }
      ],
      "raw": "PV [필수] “시세(원)”\nDEP [필수] “총 임대보증금(원)”\nSL [선택] “선순위 대출금액(원)”\nREF [필수] “임대보증금 반환 금액(원)”\nREQ [선택] “추가 필요금액(원)”"
    },
    "지분대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "시세(원)",
          "conditionalRequired": null,
          "raw": "“시세(원)"
        },
        {
          "key": "SP",
          "required": true,
          "label": "지분율(%)",
          "conditionalRequired": null,
          "raw": "“지분율(%)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 임대보증금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 임대보증금액(원)”"
        }
      ],
      "raw": "PV [필수] “시세(원)”\nSP [필수] “지분율(%)”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “선순위 임대보증금액(원)”"
    },
    "경락잔금대출": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "낙찰가or감정가(원)",
          "conditionalRequired": null,
          "raw": "“낙찰가or감정가(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "REQ",
          "required": true,
          "label": "필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“필요 대출금액(원)"
        },
        {
          "key": "ASB",
          "required": false,
          "label": "인수되는 금액(원)",
          "conditionalRequired": null,
          "raw": "“인수되는 금액(원)”"
        }
      ],
      "raw": "PV [필수] “낙찰가or감정가(원)”\nSL [선택] “선순위 대출금액(원)”\nREQ [필수] “필요 대출금액(원)”\nASB [선택] “인수되는 금액(원)”"
    },
    "대환대출": {
      "supported": true,
      "fields": [
        {
          "key": "OCC",
          "required": true,
          "label": "본인거주 or 임대",
          "conditionalRequired": null,
          "raw": "본인거주 or 임대"
        },
        {
          "key": "PV",
          "required": true,
          "label": "시세(원)",
          "conditionalRequired": null,
          "raw": "“시세(원)"
        },
        {
          "key": "SL",
          "required": true,
          "label": "선순위 총 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 총 대출금액(원)"
        },
        {
          "key": "REF",
          "required": true,
          "label": "상환할 선순위 금액(원)",
          "conditionalRequired": null,
          "raw": "“상환할 선순위 금액(원)"
        },
        {
          "key": "REQ",
          "required": false,
          "label": "추가 필요금액(원)",
          "conditionalRequired": null,
          "raw": "“추가 필요금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "임대보증금액(원)",
          "conditionalRequired": "if_occupancy_rental",
          "raw": "“임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
        }
      ],
      "raw": "OCC [필수] 본인거주 or 임대\nPV [필수] “시세(원)”\nSL [필수] “선순위 총 대출금액(원)”\nREF [필수] “상환할 선순위 금액(원)”\nREQ [선택] “추가 필요금액(원)”\nDEP [선택] “임대보증금액(원)” / OCC 임대중 선택시 표현+필수로 변환."
    },
    "매입잔금(일반)": {
      "supported": true,
      "fields": [
        {
          "key": "PV",
          "required": true,
          "label": "매입가REQ [필수] “필요 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“매입가REQ [필수] “필요 대출금액(원)"
        },
        {
          "key": "SL",
          "required": false,
          "label": "선순위 대출금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 대출금액(원)"
        },
        {
          "key": "DEP",
          "required": false,
          "label": "선순위 임대보증금액(원)",
          "conditionalRequired": null,
          "raw": "“선순위 임대보증금액(원)”"
        }
      ],
      "raw": "PV [필수] “매입가”\nREQ [필수] “필요 대출금액(원)”\nSL [선택] “선순위 대출금액(원)”\nDEP [선택] “선순위 임대보증금액(원)”"
    },
    "매입잔금(분양)": {
      "supported": false
    }
  }
};


// OCC UX rule (확정본)
// - 경락잔금/매입잔금: 본인거주(예정) / 임대(예정)
// - 임대(예정) 선택 시 도움말 노출
const OCC_RULES = {
  plannedLoanTypes: new Set(["경락잔금대출", "매입잔금(일반)", "매입잔금(분양)"]),
  plannedHelpText:
    "잔금일에 임차인이 입주하며 보증금이 온투업 대출의 선순위로 들어오는 경우",
};

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
function setupMoneyInputs() {
  const moneyInputs = document.querySelectorAll('input[data-type="money"]');
  moneyInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      const v = e.target.value;
      e.target.value = formatWithCommas(v);
    });
    if (input.value) {
      input.value = formatWithCommas(input.value);
    }
  });
}

function safeText(v) {
  return (v == null) ? "" : String(v);
}

function parseNumberLoose(v) {
  if (v == null) return null;
  if (typeof v === "number" && isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  // "10~12" -> 10, "약 12%" -> 12
  const m = s.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return isFinite(n) ? n : null;
}

function formatPctMaybe(v) {
  if (v == null) return "-";
  if (typeof v === "string") return v;
  if (typeof v === "number" && isFinite(v)) {
    // 이미 0.12 형태인지(12%)인지 불명. admin 저장이 보통 '연이율%'라면 12로 저장했을 가능성이 높음.
    // 너무 공격적으로 변환하지 않고, 1 미만이면 %로 환산.
    const n = v < 1 ? (v * 100) : v;
    return `${n.toFixed(1)}%`;
  }
  return String(v);
}

async function loadLendersConfig() {
  try {
    const res = await fetch(LENDERS_CONFIG_API, { method: "GET" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`lenders-config GET 실패: HTTP ${res.status} ${t}`);
    }
    const json = await res.json();
    console.log("✅ lendersConfig loaded from server:", json);
    return json;
  } catch (e) {
    console.warn("⚠️ lenders-config API 실패, localStorage 대체:", e);
    try {
      const raw = localStorage.getItem("huchu_lenders_config_beta");
      return raw ? JSON.parse(raw) : { lenders: [] };
    } catch {
      return { lenders: [] };
    }
  }
}

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

// ------------------------------------------------------
// 네비게이션 상태
// ------------------------------------------------------

let naviLoanConfig = {
  version: 1,
  lenders: [],
};

let lendersConfig = { lenders: [] }; // admin lenders-config (financialInputs 포함)

// NOTE: userState는 UI/필터/계산의 단일 소스
const userState = {
  mainCategory: null, // 부동산담보대출, 개인신용대출 ...
  region: null,
  propertyType: null,
  realEstateLoanType: null, // 일반담보대출, 임대보증금반환대출, ...
  occupancy: null, // self | rental (예정 포함하여 동일 키로 관리)
  // 핵심 숫자 입력
  propertyValue: 0,       // PV
  sharePercent: 100,      // SP
  seniorLoan: 0,          // SL
  deposit: 0,             // DEP
  assumedBurden: 0,       // ASB
  refinanceAmount: 0,     // REF
  requestedAmount: 0,     // REQ
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
// loan-config 불러오기
// ------------------------------------------------------

async function loadNaviLoanConfig() {
  try {
    const res = await fetch(NAVI_LOAN_CONFIG_ENDPOINT, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.lenders)) {
        naviLoanConfig = json;
        localStorage.setItem(NAVI_LOAN_CONFIG_LOCAL_KEY, JSON.stringify(naviLoanConfig));
        console.log("✅ loan-config from API:", naviLoanConfig);
        return;
      }
    } else {
      console.warn("loan-config GET 실패:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.warn("loan-config API 불러오기 실패, localStorage로 대체:", e);
  }

  try {
    const raw = localStorage.getItem(NAVI_LOAN_CONFIG_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.lenders)) {
        naviLoanConfig = parsed;
        console.log("✅ loan-config from localStorage:", naviLoanConfig);
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
// Stepper / Progressive disclosure
// ------------------------------------------------------

function getTotalStepsForCurrentFlow() {
  // 부동산담보대출 기준은 1~7
  // 다른 상품군은 이후 확장(현재는 동일 1~7 노출)
  return 7;
}

function computeStepCompletion() {
  const done = {
    s1: !!userState.mainCategory,
    s2: !!userState.region,
    s3: userState.mainCategory === "부동산담보대출" ? !!userState.propertyType : true,
    s4: userState.mainCategory === "부동산담보대출" ? !!userState.realEstateLoanType : true,
    s5: false, // schema required 만족 여부
  };

  // Step5 required validation (부동산담보대출일 때만)
  if (userState.mainCategory !== "부동산담보대출") {
    done.s5 = true;
  } else {
    done.s5 = isStep5Valid();
  }

  return done;
}

function setupStepper() {
  const host = document.getElementById("naviStepper");
  if (!host) return;

  const total = getTotalStepsForCurrentFlow();
  host.innerHTML = `
    <div class="navi-stepper__bar" aria-hidden="true">
      <div id="naviStepperFill" class="navi-stepper__fill" style="width:0%;"></div>
    </div>
    <div class="navi-stepper__meta">
      <div id="naviStepperText" class="navi-stepper__text"></div>
    </div>
  `;
  updateStepper();
}

function updateStepper() {
  const fill = document.getElementById("naviStepperFill");
  const text = document.getElementById("naviStepperText");
  const total = getTotalStepsForCurrentFlow();
  const done = computeStepCompletion();

  // 현재 단계 계산: 첫 미완료 단계
  let current = 1;
  if (!done.s1) current = 1;
  else if (!done.s2) current = 2;
  else if (!done.s3) current = 3;
  else if (!done.s4) current = 4;
  else if (!done.s5) current = 5;
  else current = 6; // 계산요약(6)까지 완료면 6으로 표시(7은 결과 버튼 동작에 가깝기 때문)

  // 진행률
  const completedCount = [done.s1, done.s2, done.s3, done.s4, done.s5].filter(Boolean).length;
  const pct = Math.round((completedCount / 5) * 100);

  if (fill) fill.style.width = `${pct}%`;
  if (text) {
    text.textContent = `진행: ${current}/${total} 단계 (입력 완료: ${completedCount}/5)`;
  }
}

function setSectionVisible(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = visible ? "" : "none";
}

function updateProgressiveSections() {
  // 기본: Step1은 항상
  setSectionVisible("navi-step1", true);

  // Step2: step1 이후
  setSectionVisible("navi-step2", !!userState.mainCategory);

  const isRE = userState.mainCategory === "부동산담보대출";
  // Step3/4/5는 부동산담보대출일 때만
  setSectionVisible("navi-step3", isRE && !!userState.region);
  setSectionVisible("navi-step4", isRE && !!userState.region && !!userState.propertyType);
  setSectionVisible("navi-step5", isRE && !!userState.region && !!userState.propertyType && !!userState.realEstateLoanType);

  // Step6/6-1은 Step5가 보이는 시점부터
  const step5On = isRE && !!userState.realEstateLoanType;
  setSectionVisible("navi-step6", step5On);
  setSectionVisible("navi-step6-1", step5On);

  // Step7은 항상 노출(버튼/안내)
  setSectionVisible("navi-step7", true);
}

// ------------------------------------------------------
// Step5 Schema 적용
// ------------------------------------------------------

const FIELD_UI = {
  PV: { inputId: "naviInputPropertyValue", type: "money" },
  SP: { inputId: "naviInputSharePercent", type: "percent" },
  SL: { inputId: "naviInputSeniorLoan", type: "money" },
  DEP: { inputId: "naviInputDeposit", type: "money" },
  ASB: { inputId: "naviInputAssumedBurden", type: "money" },
  REF: { inputId: "naviInputRefinanceAmount", type: "money" },
  REQ: { inputId: "naviInputRequestedAmount", type: "money" },
};

function getLabelElByInputId(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return null;
  const label = input.closest("label");
  return label instanceof HTMLElement ? label : null;
}

function setLabelText(labelEl, text, required) {
  if (!labelEl) return;
  // label의 첫 텍스트 노드를 교체
  const nodes = Array.from(labelEl.childNodes);
  const tn = nodes.find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length);
  const suffix = required ? " *" : "";
  const newText = `${text}${suffix}\n`;
  if (tn) {
    tn.textContent = newText;
  } else {
    labelEl.insertBefore(document.createTextNode(newText), labelEl.firstChild);
  }
  labelEl.dataset.required = required ? "1" : "0";
}

function setFieldVisible(fieldKey, visible) {
  const ui = FIELD_UI[fieldKey];
  if (!ui) return;
  const labelEl = getLabelElByInputId(ui.inputId);
  if (!labelEl) return;
  labelEl.style.display = visible ? "" : "none";
}

function setFieldRequired(fieldKey, required) {
  const ui = FIELD_UI[fieldKey];
  if (!ui) return;
  const input = document.getElementById(ui.inputId);
  if (!input) return;
  if (required) input.setAttribute("required", "required");
  else input.removeAttribute("required");
}

function setFieldPlaceholder(fieldKey, placeholder) {
  const ui = FIELD_UI[fieldKey];
  if (!ui) return;
  const input = document.getElementById(ui.inputId);
  if (!input) return;
  input.setAttribute("placeholder", placeholder);
}

function applyOCCUiRule() {
  // OCC 라벨/옵션은 loanType에 따라 바뀜 (확정본)
  const occContainer = document.getElementById("naviOccupancyChips");
  const occHelp = document.getElementById("naviOccHelp");
  if (!occContainer) return;

  const isPlanned = OCC_RULES.plannedLoanTypes.has(userState.realEstateLoanType || "");
  const btns = occContainer.querySelectorAll(".navi-chip");
  btns.forEach((b) => {
    const key = b.getAttribute("data-occ");
    if (key === "self") {
      b.textContent = isPlanned ? "본인거주(예정)" : "본인거주";
    }
    if (key === "rental") {
      b.textContent = isPlanned ? "임대(예정)" : "임대";
    }
  });

  // 도움말: planned + rental 선택시에만 노출
  if (occHelp) {
    const show = isPlanned && userState.occupancy === "rental";
    occHelp.textContent = OCC_RULES.plannedHelpText;
    occHelp.style.display = show ? "block" : "none";
  }
}

function getStep5Schema(propertyType, loanType) {
  if (!propertyType || !loanType) return null;
  const row = STEP5_SCHEMA_MATRIX[propertyType];
  if (!row) return null;
  const cell = row[loanType];
  if (!cell || !cell.supported) return null;
  return cell;
}

function applyStep5Schema() {
  // 부동산담보대출일 때만 Step5를 스키마로 제어
  if (userState.mainCategory !== "부동산담보대출") return;

  applyOCCUiRule();

  const schema = getStep5Schema(userState.propertyType, userState.realEstateLoanType);
  const helpEl = document.getElementById("naviLoanTypeHelp");

  // schema 없으면: Step5 입력 전체 숨기고 안내
  if (!schema) {
    Object.keys(FIELD_UI).forEach((k) => setFieldVisible(k, false));
    if (helpEl) {
      helpEl.textContent = "※ 선택하신 부동산 유형/대출종류 조합은 현재 지원되지 않습니다.";
    }
    return;
  }

  // 일단 전부 숨김 → schema에 있는 것만 노출
  Object.keys(FIELD_UI).forEach((k) => {
    setFieldVisible(k, false);
    setFieldRequired(k, false);
  });

  // schema fields 기준으로 노출/라벨/필수
  schema.fields.forEach((f) => {
    const key = f.key;
    if (!FIELD_UI[key] && key !== "OCC") return;

    if (key === "OCC") return; // OCC는 별도 영역
    setFieldVisible(key, true);

    // 조건부 필수: DEP + 임대 선택 시
    let required = !!f.required;
    if (f.conditionalRequired === "if_occupancy_rental") {
      required = required || (userState.occupancy === "rental");
    }

    setFieldRequired(key, required);

    const label = f.label || key;
    setLabelText(getLabelElByInputId(FIELD_UI[key].inputId), label, required);

    // placeholder는 라벨에서 괄호 제거한 짧은 텍스트로 자동
    const ph = label.replace(/\s*\([^\)]*\)\s*/g, "").trim();
    if (FIELD_UI[key].type === "money") {
      setFieldPlaceholder(key, `예) 50000000`);
    } else if (FIELD_UI[key].type === "percent") {
      setFieldPlaceholder(key, `예) 100`);
    } else {
      setFieldPlaceholder(key, ph ? `예) ${ph}` : "");
    }
  });

  // OCC 필수/비필수: 스키마에 OCC가 있으면 필수 처리(칩 선택 유도)
  const hasOCC = schema.fields.some((f) => f.key === "OCC");
  const occWrap = document.getElementById("naviOccupancyChips")?.closest("div");
  if (occWrap) {
    occWrap.style.display = hasOCC ? "" : "none";
  }
}

function isStep5Valid() {
  // 스키마 기준 required 충족 확인
  if (userState.mainCategory !== "부동산담보대출") return true;
  const schema = getStep5Schema(userState.propertyType, userState.realEstateLoanType);
  if (!schema) return false;

  for (const f of schema.fields) {
    if (f.key === "OCC") {
      if (f.required && !userState.occupancy) return false;
      continue;
    }
    const ui = FIELD_UI[f.key];
    if (!ui) continue;

    let required = !!f.required;
    if (f.conditionalRequired === "if_occupancy_rental") {
      required = required || (userState.occupancy === "rental");
    }

    if (!required) continue;

    const el = document.getElementById(ui.inputId);
    if (!el) return false;

    if (ui.type === "money") {
      if (getMoneyValueById(ui.inputId) <= 0) return false;
    } else if (ui.type === "percent") {
      const v = Number(el.value);
      if (!v || v <= 0) return false;
    } else {
      if (!el.value) return false;
    }
  }

  return true;
}

function updateLoanTypeChipAvailability() {
  // Step4 chips에서 propertyType 기준으로 미지원 조합은 disable
  const container = document.getElementById("naviRealEstateLoanTypeChips");
  if (!container) return;
  const prop = userState.propertyType;
  const buttons = Array.from(container.querySelectorAll(".navi-chip"));
  buttons.forEach((btn) => {
    const lt = btn.getAttribute("data-loan-type");
    if (!prop || !lt) {
      btn.disabled = false;
      btn.classList.remove("is-disabled");
      return;
    }
    const cell = STEP5_SCHEMA_MATRIX?.[prop]?.[lt];
    const supported = !!cell && cell.supported;
    btn.disabled = !supported;
    btn.classList.toggle("is-disabled", !supported);

    // 현재 선택된 loanType이 미지원이면 해제
    if (!supported && userState.realEstateLoanType === lt) {
      userState.realEstateLoanType = null;
      btn.classList.remove("is-selected");
    }
  });
}

// ------------------------------------------------------
// UI 이벤트 바인딩
// ------------------------------------------------------

function setupStep1() {
  const container = document.getElementById("naviLoanCategoryChips");
  if (!container) return;
  container.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("navi-chip")) return;

    singleSelectChip(container, target);
    userState.mainCategory = target.getAttribute("data-main-cat");

    // 초기화(부동산담보대출이 아닐 경우)
    if (userState.mainCategory !== "부동산담보대출") {
      userState.propertyType = null;
      userState.realEstateLoanType = null;
      userState.occupancy = null;
    }

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

    // Step4 loan type availability 업데이트
    updateLoanTypeChipAvailability();

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
      "기존 임대보증금을 반환하기 위한 대출입니다. 임대보증금 + 선순위 + 필요대출금액 기준으로 LTV를 계산합니다.",
    지분대출: "지분율만큼 시세를 반영하여 LTV를 계산합니다. (예: 시세 5억, 지분 50% → 2.5억 기준)",
    경락잔금대출:
      "낙찰가/감정가와 선순위·인수금·필요대출금액을 기준으로 잔금대출 LTV를 계산합니다.",
    대환대출:
      "선순위 대출/보증금 중 상환 예정금액 + 신규 필요대출금액을 합산하여 대환 후 LTV를 계산합니다.",
    "매입잔금(일반)":
      "매입 잔금 전후 필요한 자금을 마련하기 위한 대출입니다. 예정 선순위/보증금 + 필요대출금액 기준으로 계산합니다.",
    "매입잔금(분양)":
      "분양 잔금 자금을 마련하기 위한 대출입니다. 예정 선순위/보증금 + 필요대출금액 기준으로 계산합니다.",
  };

  container.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("navi-chip")) return;
    if (target.hasAttribute("disabled")) return;

    singleSelectChip(container, target);
    const loanType = target.getAttribute("data-loan-type");
    userState.realEstateLoanType = loanType;

    // OCC 초기화(loanType 톤 변경 시 혼란 방지)
    userState.occupancy = null;
    const occContainer = document.getElementById("naviOccupancyChips");
    if (occContainer) {
      occContainer.querySelectorAll(".navi-chip").forEach((c) => c.classList.remove("is-selected"));
    }

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

  const inputIds = [
    "naviInputPropertyValue",
    "naviInputSharePercent",
    "naviInputSeniorLoan",
    "naviInputDeposit",
    "naviInputAssumedBurden",
    "naviInputRefinanceAmount",
    "naviInputRequestedAmount",
  ];

  inputIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
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

      applyStep5Schema(); // DEP 조건부 필수 갱신 + 도움말 노출
      recalcAndUpdateSummary();
    });
  }

  if (amountWarningEl) {
    amountWarningEl.style.display = "none";
  }
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
      recalcAndUpdateSummary(true);
    });
  }
}

// 버튼들
function setupResultButtons() {
  const recalcBtn = document.getElementById("naviRecalcBtn");
  if (recalcBtn) {
    recalcBtn.addEventListener("click", () => {
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
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
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
// 입력/계산/필터 로직
// ------------------------------------------------------

// 입력값을 userState에 반영
function syncInputsToState() {
  userState.propertyValue = getMoneyValueById("naviInputPropertyValue");
  const shareEl = document.getElementById("naviInputSharePercent");
  userState.sharePercent = shareEl && shareEl.value !== "" ? Number(shareEl.value) : 100;

  userState.seniorLoan = getMoneyValueById("naviInputSeniorLoan");
  userState.deposit = getMoneyValueById("naviInputDeposit");
  userState.assumedBurden = getMoneyValueById("naviInputAssumedBurden");
  userState.refinanceAmount = getMoneyValueById("naviInputRefinanceAmount");
  userState.requestedAmount = getMoneyValueById("naviInputRequestedAmount");
}

function calcLtv() {
  const {
    propertyValue,
    sharePercent,
    seniorLoan,
    deposit,
    assumedBurden,
    refinanceAmount,
    requestedAmount,
    realEstateLoanType,
  } = userState;

  if (!propertyValue || !requestedAmount) {
    return { ltv: null, totalDebtAfter: null, baseValue: null };
  }

  const ratio = sharePercent && sharePercent > 0 ? sharePercent / 100 : 1;
  const baseValue = propertyValue * ratio;

  let totalDebtAfter = 0;
  const seniorPlusDeposit = seniorLoan + deposit;

  if (!realEstateLoanType || realEstateLoanType === "일반담보대출") {
    totalDebtAfter = seniorPlusDeposit + requestedAmount;
  } else if (realEstateLoanType === "임대보증금반환대출") {
    totalDebtAfter = seniorPlusDeposit + requestedAmount;
  } else if (realEstateLoanType === "지분대출") {
    totalDebtAfter = seniorPlusDeposit + requestedAmount;
  } else if (realEstateLoanType === "경락잔금대출") {
    totalDebtAfter = seniorLoan + deposit + assumedBurden + requestedAmount;
  } else if (realEstateLoanType === "대환대출") {
    const remaining = seniorPlusDeposit - refinanceAmount;
    totalDebtAfter = (remaining > 0 ? remaining : 0) + requestedAmount;
  } else if (realEstateLoanType === "매입잔금(일반)" || realEstateLoanType === "매입잔금(분양)") {
    totalDebtAfter = seniorPlusDeposit + requestedAmount;
  }

  if (!baseValue) {
    return { ltv: null, totalDebtAfter, baseValue };
  }

  const ltv = totalDebtAfter / baseValue;
  return { ltv, totalDebtAfter, baseValue };
}

function checkGlobalMinAmount() {
  const warningEl = document.getElementById("naviAmountWarning");
  if (!warningEl) return;

  const amt = userState.requestedAmount;
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

function getLenderKey(l) {
  return (
    l?.id ||
    l?.lenderId ||
    l?.code ||
    l?.slug ||
    l?.displayName ||
    ""
  );
}

function mergeLendersWithAdminConfig() {
  const list = naviLoanConfig.lenders || [];
  const admin = lendersConfig?.lenders || [];
  const map = new Map();
  admin.forEach((a) => {
    const k = getLenderKey(a);
    if (k) map.set(k, a);
  });

  list.forEach((l) => {
    const k = getLenderKey(l);
    const a = k ? map.get(k) : null;

    // id 미스매치 대비: displayName로도 fallback
    const a2 = (!a && l?.displayName) ? admin.find((x) => x?.displayName === l.displayName) : null;
    const src = a || a2;

    if (src) {
      if (!l.financialInputs && src.financialInputs) l.financialInputs = src.financialInputs;
      if (!l.channels && src.channels) l.channels = src.channels;
      if (typeof l.isPartner !== "boolean" && typeof src.isPartner === "boolean") l.isPartner = src.isPartner;
    }
  });
}

function getFinancialInputsForCategory(lender, mainCategory) {
  const fi = lender?.financialInputs;
  if (!fi || !mainCategory) return null;

  // 우선 정확히 일치
  if (fi[mainCategory]) return fi[mainCategory];

  // 느슨한 매핑 (향후 키 변경 대비)
  const keys = Object.keys(fi);
  if (!keys.length) return null;
  const hit = keys.find((k) => k.includes(mainCategory) || mainCategory.includes(k));
  return hit ? fi[hit] : null;
}

function summarizeFeesForLenders(lenders, mainCategory) {
  const values = {
    interest: [],
    platform: [],
    prepay: [],
  };

  for (const l of lenders) {
    const inps = getFinancialInputsForCategory(l, mainCategory);
    if (!inps) continue;

    const i = parseNumberLoose(inps.interestAvg);
    const p = parseNumberLoose(inps.platformFeeAvg);
    const pp = parseNumberLoose(inps.prepayFeeAvg);

    if (i != null) values.interest.push(i);
    if (p != null) values.platform.push(p);
    if (pp != null) values.prepay.push(pp);
  }

  function stats(arr) {
    if (!arr.length) return null;
    const s = [...arr].sort((a,b)=>a-b);
    const min = s[0];
    const max = s[s.length-1];
    const mid = s[Math.floor(s.length/2)];
    return { min, max, mid, count: s.length };
  }

  return {
    interest: stats(values.interest),
    platform: stats(values.platform),
    prepay: stats(values.prepay),
  };
}

function renderFeePreviewIntoStep6(matchedCore) {
  const host = document.getElementById("naviFeePreview");
  if (!host) return;

  const mainCategory = userState.mainCategory;
  if (!mainCategory || !matchedCore?.length) {
    host.innerHTML = "";
    host.style.display = "none";
    return;
  }

  const stats = summarizeFeesForLenders(matchedCore, mainCategory);

  // 값이 하나도 없으면 숨김
  const hasAny = !!(stats.interest || stats.platform || stats.prepay);
  if (!hasAny) {
    host.innerHTML = "";
    host.style.display = "none";
    return;
  }

  function col(title, s) {
    if (!s) return `<div class="navi-fee-col"><div class="navi-fee-title">${title}</div><div class="navi-fee-val">-</div></div>`;
    const mid = formatPctMaybe(s.mid);
    const range = (s.min === s.max) ? `${formatPctMaybe(s.min)}` : `${formatPctMaybe(s.min)} ~ ${formatPctMaybe(s.max)}`;
    return `
      <div class="navi-fee-col">
        <div class="navi-fee-title">${title}</div>
        <div class="navi-fee-val">${mid}</div>
        <div class="navi-fee-sub">범위: ${range}</div>
      </div>
    `;
  }

  host.innerHTML = `
    <div class="navi-fee-grid">
      ${col("예상 금리(평균)", stats.interest)}
      ${col("플랫폼 수수료(평균)", stats.platform)}
      ${col("중도상환 수수료(평균)", stats.prepay)}
    </div>
  `;
  host.style.display = "";
}

// 온투업 리스트 필터링
function filterLenders(applyExtras = false) {
  const lenders = naviLoanConfig.lenders || [];
  if (!lenders.length) return [];

  const {
    mainCategory,
    region,
    propertyType,
    realEstateLoanType,
    requestedAmount,
    extra,
  } = userState;

  const { ltv } = calcLtv();

  const filtered = lenders.filter((l) => {
    if (!l.isActive) return false;
    if (l.isNewLoanActive === false) return false;

    // 상품군 매칭
    if (mainCategory) {
      const cats = l.loanCategories || [];
      if (!cats.includes(mainCategory)) return false;
    }

    // 부동산담보대출인 경우 추가 조건
    if (mainCategory === "부동산담보대출") {
      const cfg = l.realEstateConfig || {};

      // 지역
      if (region) {
        const rgs = cfg.regions || [];
        if (!rgs.includes("전국") && !rgs.includes(region)) return false;
      }

      // 부동산 유형
      if (propertyType) {
        const props = cfg.propertyTypes || [];
        if (!props.includes(propertyType)) return false;
      }

      // 대출종류
      if (realEstateLoanType) {
        const types = cfg.loanTypes || [];
        if (!types.includes(realEstateLoanType)) return false;
      }

      // 최소 대출금액 (온투업별)
      if (requestedAmount) {
        const minMap = cfg.minLoanByProperty || {};
        const aptMin = minMap["아파트"] ?? 0;
        const otherMin = minMap["_기타"] ?? 0;
        const isApt = propertyType === "아파트";
        const lenderMin = isApt ? aptMin : otherMin;
        if (lenderMin && requestedAmount < lenderMin) return false;
      }

      // LTV 한도
      if (typeof cfg.maxTotalLtv === "number" && cfg.maxTotalLtv > 0) {
        if (ltv != null && ltv > cfg.maxTotalLtv + 1e-6) {
          return false;
        }
      }
    }

    // 추가조건 필터링
    if (applyExtras) {
      if (extra.creditBand) {
        const bands = l.allowedCreditBands || [];
        if (bands.length && !bands.includes(extra.creditBand)) return false;
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

  // 정렬
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
// 계산 결과 요약 / 카운트 업데이트
// ------------------------------------------------------

function recalcAndUpdateSummary(onlyExtra = false) {
  syncInputsToState();
  checkGlobalMinAmount();

  // schema 적용(loanType/prop 변경 또는 OCC 변경 시 필수 갱신)
  if (userState.mainCategory === "부동산담보대출") {
    applyStep5Schema();
  }

  const calcTextEl = document.getElementById("naviCalcSummaryText");
  const calcSubEl = document.getElementById("naviCalcSubText");
  const countInfoEl = document.getElementById("naviCalcCountInfo");
  const extraCountEl = document.getElementById("naviExtraCountInfo");
  const resultSummaryEl = document.getElementById("naviResultSummary");

  if (!calcTextEl || !calcSubEl || !resultSummaryEl) return;

  // progressive sections + stepper
  updateProgressiveSections();
  updateStepper();

  const { mainCategory, propertyType, realEstateLoanType } = userState;

  if (!mainCategory) {
    calcTextEl.textContent =
      "대출 상품군이 선택되지 않았습니다. 1단계에서 먼저 대출 상품군을 선택해주세요.";
    calcSubEl.textContent = "";
    if (countInfoEl) countInfoEl.style.display = "none";
    if (extraCountEl) extraCountEl.style.display = "none";
    resultSummaryEl.textContent =
      "상품군, 지역, 대출종류를 입력하시면 추천 온투업 결과를 볼 수 있습니다.";
    renderFeePreviewIntoStep6([]);
    return;
  }

  // 기본 메시지 구성
  let baseSummary = `선택 상품군: ${mainCategory}`;
  if (propertyType) baseSummary += ` / 부동산 유형: ${propertyType}`;
  if (realEstateLoanType) baseSummary += ` / 대출종류: ${realEstateLoanType}`;
  calcTextEl.textContent = baseSummary;

  const { ltv, totalDebtAfter, baseValue } = calcLtv();
  if (ltv == null || !baseValue) {
    calcSubEl.textContent =
      "시세(또는 낙찰가)와 필요 대출금액을 포함한 핵심 정보가 부족하여 LTV를 계산할 수 없습니다.";
  } else {
    const pct = (ltv * 100).toFixed(1);
    const totalStr = formatWithCommas(String(Math.round(totalDebtAfter)));
    const baseStr = formatWithCommas(String(Math.round(baseValue)));
    calcSubEl.textContent = `예상 총 부담액은 약 ${totalStr}원, 지분 기준 담보가치는 약 ${baseStr}원으로 예상 LTV는 약 ${pct}% 수준입니다.`;
  }

  // 온투업 매칭 카운트 (핵심조건 기준)
  const matched = filterLenders(false);
  if (countInfoEl) {
    countInfoEl.style.display = "inline-block";
    countInfoEl.textContent = matched.length
      ? `핵심 조건 기준 추천 가능 온투업체: ${matched.length}곳`
      : "현재 입력 기준으로 매칭되는 온투업체가 없습니다. 대출금액·부동산 유형·지역 등을 조정하면 가능한 온투업체가 있을 수 있습니다.";
  }

  // Step6: 3컬럼 예상값(평균/범위) 노출
  renderFeePreviewIntoStep6(matched);

  // 추가조건 적용 카운트
  const matchedWithExtra = filterLenders(true);
  if (extraCountEl) {
    extraCountEl.style.display = "inline-block";
    extraCountEl.textContent = matchedWithExtra.length
      ? `추가조건까지 반영한 추천 온투업체: ${matchedWithExtra.length}곳`
      : "현재 추가조건까지 고려하면 추천 가능한 온투업체가 없습니다. 일부 추가조건(신용점수, 기타사항)을 완화해보세요.";
  }

  resultSummaryEl.textContent =
    "현재 입력 기준 예상 LTV 및 온투업 매칭 가능성은 위 요약을 참고해주세요.";
}

// ------------------------------------------------------
// 최종 결과 렌더링 (Step7)
// ------------------------------------------------------

function renderFinalResult() {
  const panel = document.getElementById("naviResultPanel");
  const summaryEl = document.getElementById("naviResultSummary");
  if (!panel || !summaryEl) return;

  const { mainCategory } = userState;
  if (!mainCategory) {
    alert("먼저 1단계에서 대출 상품군을 선택해주세요.");
    return;
  }

  if (userState.mainCategory === "부동산담보대출" && !isStep5Valid()) {
    alert("Step5 필수 입력을 먼저 완료해주세요.");
    return;
  }

  syncInputsToState();
  const matched = filterLenders(true);

  if (!matched.length) {
    summaryEl.textContent =
      "현재 조건에 맞는 온투업체가 없습니다. 대출금액 등 조건을 조정하면 가능한 온투업체가 있을 수 있습니다.";
    panel.innerHTML = `
      <div class="navi-empty-card">
        <div style="font-weight:600;margin-bottom:4px;">조건에 맞는 온투업체가 없습니다.</div>
        <div style="font-size:11px;">
          · 대출금액을 소폭 줄이거나, LTV를 낮출 수 있는 방향으로 조정해보세요.<br/>
          · 부동산 유형이나 지역을 넓혀보면 선택지가 늘어날 수 있습니다.<br/>
          · 추가정보(신용점수 구간, 기타사항)를 완화하면 가능성이 높아질 수 있습니다.
        </div>
        <ul class="navi-tip-list">
          <li>선순위 대출 일부 상환 또는 필요 대출금액 조정</li>
          <li>경매 낙찰/감정가 대비 LTV 80% 이내로 맞추기</li>
          <li>보증금 반환 시, 일부를 자가 자금으로 마련하여 LTV 낮추기</li>
        </ul>
      </div>
    `;
    return;
  }

  const { ltv } = calcLtv();
  const ltvText =
    ltv != null ? ` / 예상 LTV 약 ${(ltv * 100).toFixed(1)}%` : "";

  summaryEl.textContent = `추가조건까지 반영한 추천 온투업체 ${matched.length}곳${ltvText}`;

  const condParts = [];
  if (userState.mainCategory) condParts.push(userState.mainCategory);
  if (userState.propertyType) condParts.push(userState.propertyType);
  if (userState.realEstateLoanType) condParts.push(userState.realEstateLoanType);
  if (userState.region) condParts.push(userState.region);
  const condSummary = condParts.join(" / ");

  const reqAmt = userState.requestedAmount
    ? formatWithCommas(String(userState.requestedAmount)) + "원"
    : "입력 없음";

  let html = "";
  html += `<div style="margin-bottom:8px;font-size:12px;color:#374151;">`;
  html += `<div>요청 조건 요약: <strong>${condSummary || "조건 미입력"}</strong></div>`;
  html += `<div>필요 대출금액: <strong>${reqAmt}</strong></div>`;
  html += `</div>`;

  matched.forEach((l) => {
    const cats = l.loanCategories || [];
    const cfg = l.realEstateConfig || {};
    const regions = cfg.regions || [];
    const props = cfg.propertyTypes || [];
    const types = cfg.loanTypes || [];
    const phone = l.channels?.phoneNumber || "";
    const kakao = l.channels?.kakaoUrl || "";

    // 3컬럼 (선택된 상품군 기준)
    const inps = getFinancialInputsForCategory(l, userState.mainCategory) || {};
    const interest = inps.interestAvg ?? null;
    const platform = inps.platformFeeAvg ?? null;
    const prepay = inps.prepayFeeAvg ?? null;

    html += `<div class="navi-lender-item">`;
    html += `<div class="navi-lender-name">${l.displayName || "(이름 없음)"}`;
    if (l.isPartner) {
      html += ` <span class="navi-tag" style="background:#111827;color:#f9fafb;border-color:#111827;">제휴 온투업체</span>`;
    }
    html += `</div>`;

    html += `<div class="navi-fee-grid" style="margin:6px 0 8px;">`;
    html += `
      <div class="navi-fee-col">
        <div class="navi-fee-title">금리(평균)</div>
        <div class="navi-fee-val">${formatPctMaybe(interest)}</div>
      </div>
      <div class="navi-fee-col">
        <div class="navi-fee-title">플랫폼 수수료(평균)</div>
        <div class="navi-fee-val">${formatPctMaybe(platform)}</div>
      </div>
      <div class="navi-fee-col">
        <div class="navi-fee-title">중도상환 수수료(평균)</div>
        <div class="navi-fee-val">${formatPctMaybe(prepay)}</div>
      </div>
    `;
    html += `</div>`;

    html += `<div class="navi-lender-meta">`;
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

    html += `</div>`;
  });

  panel.innerHTML = html;
}

// ------------------------------------------------------
// 초기화
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ navi-beta.js DOMContentLoaded");
  setupBetaMenu();
  setupMoneyInputs();

  await loadNaviLoanConfig();
  lendersConfig = await loadLendersConfig();
  window.__LENDERS_CONFIG__ = lendersConfig; // 디버깅용(임시)

  // merge financialInputs into loan-config lenders (필요시)
  mergeLendersWithAdminConfig();

  setupStepper();

  setupStep1();
  setupStep2();
  setupStep3();
  setupStep4();
  setupStep5();
  setupStep6Extra();
  setupResultButtons();

  // Step4 초기 disabled 상태 동기화
  updateLoanTypeChipAvailability();

  // Step5 초기 schema 적용
  applyStep5Schema();

  // 첫 계산
  recalcAndUpdateSummary();
});
