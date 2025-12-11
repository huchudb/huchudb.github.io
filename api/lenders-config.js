// /api/lenders-config.js

const ALLOWED_ORIGINS = [
  "https://www.huchulab.com",
  "https://huchulab.com",
  "http://localhost:3000", // 로컬 테스트용 - 필요 없으면 지워도 됨
];

function setCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigin =
    ALLOWED_ORIGINS.includes(origin) ? origin : "https://www.huchulab.com";

  // CORS preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    setCors(res, allowedOrigin);
    return res.status(200).end();
  }

  setCors(res, allowedOrigin);

  if (req.method === "GET") {
    // TODO: 여기에 실제 저장된 lendersConfig 읽어오기
    // 지금은 테스트용으로 빈 구조만 리턴
    const data = {
      version: 1,
      lenders: [],
    };
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    // TODO: 여기서 req.body를 검증하고 DB/파일 등에 저장
    const body = req.body;
    console.log("lenders-config 저장 요청:", body);

    // 일단은 저장했다고 가정하고 ok만 리턴
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
