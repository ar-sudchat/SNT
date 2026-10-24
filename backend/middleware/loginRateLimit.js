// Small in-memory login limiter: MAX_FAILS failed attempts per (IP + username|email)
// within WINDOW_MS -> 429. Per-process only (fine for a single instance).
const MAX_FAILS = parseInt(process.env.LOGIN_MAX_FAILS || '5', 10);
const WINDOW_MS = parseInt(process.env.LOGIN_WINDOW_MS || String(15 * 60 * 1000), 10);
const MSG = 'เข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่';

const attempts = new Map(); // key -> { count, first }

const keyOf = (req) => `${req.ip}|${String((req.body && (req.body.username || req.body.email)) || '').toLowerCase().trim()}`;

function prune(now) {
  if (attempts.size < 10000) return;
  for (const [k, v] of attempts) if (now - v.first > WINDOW_MS) attempts.delete(k);
}

function loginRateLimit(req, res, next) {
  const now = Date.now();
  const key = keyOf(req);
  const rec = attempts.get(key);
  if (rec && now - rec.first > WINDOW_MS) attempts.delete(key);
  const cur = attempts.get(key);
  if (cur && cur.count >= MAX_FAILS) {
    const retry = Math.ceil((cur.first + WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(retry));
    return res.status(429).json({ error: MSG });
  }
  // Count the outcome after the handler responds
  res.on('finish', () => {
    if (res.statusCode === 401) {
      const t = Date.now();
      prune(t);
      const r = attempts.get(key);
      if (!r || t - r.first > WINDOW_MS) attempts.set(key, { count: 1, first: t });
      else r.count += 1;
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      attempts.delete(key);
    }
  });
  next();
}

loginRateLimit._reset = () => attempts.clear();
module.exports = loginRateLimit;
