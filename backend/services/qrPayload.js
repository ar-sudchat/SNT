// QR payload format. New: KS1.<tenantSlug>.<token>. Legacy: SNT-<studentId>-<subjectId>-<rand> (current tenant).
const crypto = require('crypto');

const OTHER_SCHOOL_MSG = 'QR นี้เป็นของกลุ่มอื่น';
const KS1_RE = /^KS1\.([a-z0-9-]{3,40})\.([A-Za-z0-9_-]{16,128})$/;

const newToken = () => crypto.randomBytes(16).toString('hex'); // 128-bit

function formatPayload(slug, token = newToken()) {
  return `KS1.${slug}.${token}`;
}

// -> { kind: 'ks1', slug, token } | { kind: 'legacy' } | null
const URL_RE = /^https?:\/\/[^\s]+\/q\/(KS1\.[a-z0-9-]{3,40}\.[A-Za-z0-9_-]{16,128})\/?(?:[?#]\S*)?$/;

// QR ที่พิมพ์ใหม่เป็นลิงก์ <เว็บ>/q/<KS1...> เพื่อให้กล้องมือถือเปิดได้ — ครูสแกนก็ยังอ่านได้เหมือนเดิม
const toUrlPayload = (base, payload) => `${String(base).replace(/\/+$/, '')}/q/${payload}`;

function parsePayload(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  const u = URL_RE.exec(s);
  if (u) s = u[1];
  const m = KS1_RE.exec(s);
  if (m) return { kind: 'ks1', slug: m[1], token: m[2], raw: s };
  if (s.startsWith('SNT-') && s.length <= 200) return { kind: 'legacy' };
  return null;
}

// true when payload belongs to another school than currentSlug. Legacy never conflicts.
const isForeign = (parsed, currentSlug) => !!parsed && parsed.kind === 'ks1' && parsed.slug !== currentSlug;

module.exports = { OTHER_SCHOOL_MSG, toUrlPayload, newToken, formatPayload, parsePayload, isForeign };
