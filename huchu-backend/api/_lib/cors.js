// api/_lib/cors.js
export function withCORS(handler) {
  const ALLOW_ORIGINS = [
    'https://www.huchulab.com',
    'https://huchudb-github-io.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];

  return async (req, res) => {
    const origin = req.headers.origin || '';
    const allowed = ALLOW_ORIGINS.includes(origin);
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }
    return handler(req, res);
  };
}
