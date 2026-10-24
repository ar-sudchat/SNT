// Google OAuth2 (authorization code flow) without extra deps.
// state = HMAC-signed {n, exp} (short TTL) + nonce cookie (CSRF).
// id_token is verified by Google's tokeninfo endpoint, then claims are re-checked locally.
const crypto = require('node:crypto');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const STATE_TTL_MS = 10 * 60 * 1000;

const isConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const publicUrl = () => (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/+$/, '');
const redirectUri = () => process.env.GOOGLE_REDIRECT_URI || `${publicUrl()}/api/auth/google/callback`;
const secret = () => process.env.JWT_SECRET || '';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (s) => crypto.createHmac('sha256', 'google-state:' + secret()).update(s).digest('base64url');

function createState(now = Date.now()) {
  const nonce = b64u(crypto.randomBytes(16));
  const payload = b64u(JSON.stringify({ n: nonce, exp: now + STATE_TTL_MS }));
  return { state: `${payload}.${hmac(payload)}`, nonce };
}

// Returns true only if signature matches, not expired, and nonce equals the cookie nonce.
function verifyState(state, cookieNonce, now = Date.now()) {
  if (typeof state !== 'string' || !cookieNonce) return false;
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return false;
  const expect = hmac(payload);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return false;
  let p;
  try { p = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return false; }
  if (!p || typeof p.exp !== 'number' || p.exp < now) return false;
  const a = Buffer.from(String(p.n)), b = Buffer.from(String(cookieNonce));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authUrl(state) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `${AUTH_URL}?${q}`;
}

async function exchangeCode(code, fetchImpl = fetch) {
  const r = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(), grant_type: 'authorization_code',
    }).toString(),
  });
  if (!r.ok) throw Object.assign(new Error('token exchange failed'), { status: 401 });
  const j = await r.json();
  if (!j.id_token) throw Object.assign(new Error('no id_token'), { status: 401 });
  return j.id_token;
}

// Verify id_token: signature via Google tokeninfo, then aud/iss/exp/email_verified locally.
async function verifyIdToken(idToken, fetchImpl = fetch, now = Date.now()) {
  const r = await fetchImpl(`${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
  if (!r.ok) throw Object.assign(new Error('invalid id_token'), { status: 401 });
  const c = await r.json();
  const fail = (m) => { throw Object.assign(new Error(m), { status: 401 }); };
  if (c.aud !== process.env.GOOGLE_CLIENT_ID) fail('aud mismatch');
  if (!ISSUERS.has(c.iss)) fail('iss mismatch');
  if (!(Number(c.exp) * 1000 > now)) fail('expired');
  if (!(c.email_verified === true || c.email_verified === 'true')) fail('email not verified');
  if (!c.sub || !c.email) fail('missing claims');
  return { sub: String(c.sub), email: String(c.email).toLowerCase(), name: c.name || null };
}

module.exports = { isConfigured, publicUrl, redirectUri, createState, verifyState, authUrl, exchangeCode, verifyIdToken, STATE_TTL_MS };
