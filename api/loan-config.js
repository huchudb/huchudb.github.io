// api/loan-config.js
//
// 후추 네비게이션 전용 loan-config API
// - CORS: https://www.huchulab.com 및 localhost 허용
// - 구조: { byType: { ... }, lenders: { ... } }
//   · byType  : 부동산담보 LTV/금리 등 (나중에 쓰려면 확장)
//   · lenders : 온투업체별 설정 (lendersConfig)
// - 현재는 메모리(global 변수)에 저장 (Vercel 서버리스 기준 간단 버전)

let loanConfigStore = {
  byType: {},   // 향후 확장용 (지금은 비워둬도 OK)
  lenders: {}   // admin-beta 쪽에서 보내는 lendersConfig 그대로 저장
};

const ALLOWED_ORIGINS = [
  'https://www.huchulab.com',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://127.0.0.1:3000'
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Requested-With'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  // 👉 프리플라이트(OPTIONS) 처리
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 👉 설정 조회
  if (req.method === 'GET') {
    // 저장된 값이 없으면 기본 구조 리턴
    if (
      !loanConfigStore ||
      typeof loanConfigStore !== 'object'
    ) {
      loanConfigStore = { byType: {}, lenders: {} };
    }
    return res.status(200).json(loanConfigStore);
  }

  // 👉 설정 저장
  if (req.method === 'POST') {
    try {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : (req.body || {});

      const { byType, lenders } = body;

      // 타입 체크(있으면 object여야 함). 둘 다 없어도 허용.
      if (
        byType !== undefined &&
        (typeof byType !== 'object' || Array.isArray(byType))
      ) {
        return res
          .status(400)
          .json({ error: '`byType` must be an object when provided' });
      }

      if (
        lenders !== undefined &&
        (typeof lenders !== 'object' || Array.isArray(lenders))
      ) {
        return res
          .status(400)
          .json({ error: '`lenders` must be an object when provided' });
      }

      // 기존 값 유지 + 덮어쓰기
      const nextStore = {
        byType:
          byType && typeof byType === 'object'
            ? byType
            : (loanConfigStore.byType || {}),
        lenders:
          lenders && typeof lenders === 'object'
            ? lenders
            : (loanConfigStore.lenders || {})
      };

      loanConfigStore = nextStore;

      return res.status(200).json({
        ok: true,
        loanConfig: loanConfigStore
      });
    } catch (err) {
      console.error('loan-config POST error:', err);
      return res
        .status(500)
        .json({ error: 'failed to save loan-config' });
    }
  }

  // 허용되지 않은 메서드
  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
