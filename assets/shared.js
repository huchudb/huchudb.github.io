// 숫자/포맷 공용 유틸 (계산기에서 import)
export const onlyDigits = (s) => (s||"").replace(/[^0-9]/g,"");
export const toNumber   = (s) => Number(onlyDigits(s)) || 0;

export function formatKoreanCurrency(num){
  const n = Math.max(0, Math.floor(num));
  if (n >= 100000000){
    const eok = Math.floor(n/100000000);
    const restMan = Math.floor((n%100000000)/10000);
    if (restMan > 0) return `${eok.toLocaleString('ko-KR')}억 ${restMan.toLocaleString('ko-KR')}만원`;
    return `${eok.toLocaleString('ko-KR')}억 원`;
  }else if(n >= 10000){
    return `${Math.floor(n/10000).toLocaleString('ko-KR')}만원`;
  }else{
    return `${n.toLocaleString('ko-KR')}원`;
  }
}
