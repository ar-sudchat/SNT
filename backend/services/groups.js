// Groups (กลุ่ม) = tenants. Every user owns a personal group; others join by join code or invite.
const crypto = require('crypto');

// No 0/O, 1/I/L: unambiguous when read aloud or typed from a screen.
const JOIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const JOIN_CODE_RE = /^[A-HJKMNP-Z2-9]{3}-[A-HJKMNP-Z2-9]{3}$/;

function newJoinCode() {
  const b = crypto.randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += JOIN_ALPHABET[b[i] % JOIN_ALPHABET.length];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

// Accepts "k7q29x", "K7Q 29X", "k7q-29x" -> "K7Q-29X"; null when not a valid code.
function normalizeJoinCode(raw) {
  const s = String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 6) return null;
  const code = `${s.slice(0, 3)}-${s.slice(3)}`;
  return JOIN_CODE_RE.test(code) ? code : null;
}

// Internal-only slug (URLs no longer use it).
const newSlug = () => `g-${crypto.randomBytes(5).toString('hex')}`;

function thaiAcademicYear(d = new Date()) {
  const y = d.getMonth() < 4 ? d.getFullYear() - 1 : d.getFullYear();
  return y + 543;
}

function validateGroupName(raw) {
  const name = String(raw == null ? '' : raw).trim();
  if (name.length < 1 || name.length > 120) return { ok: false, error: 'ชื่อกลุ่มต้องยาว 1-120 ตัวอักษร' };
  return { ok: true, name };
}

const personalGroupName = (user) =>
  `กลุ่มของ ${String(user.displayName || (user.email || '').split('@')[0] || 'ฉัน').slice(0, 100)}`;

const isUniqueErr = (e) => e && e.code === 'P2002';

// Creates tenant(kind=group) + OWNER membership + current AcademicYear. db: prisma client (unscoped/bypassed).
async function createGroup(db, user, name) {
  const be = thaiAcademicYear();
  for (let attempt = 0; ; attempt++) {
    try {
      const run = async (tx) => {
        const tenant = await tx.tenant.create({ data: { name, slug: newSlug(), joinCode: newJoinCode(), kind: 'group' } });
        await tx.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: 'OWNER' } });
        await tx.academicYear.create({ data: { tenantId: tenant.id, year: String(be), name: `ปีการศึกษา ${be}`, isCurrent: true } });
        return tenant;
      };
      return db.$transaction ? await db.$transaction(run) : await run(db);
    } catch (e) {
      if (isUniqueErr(e) && attempt < 4) continue; // slug/joinCode collision: retry
      throw e;
    }
  }
}

const createPersonalGroup = (db, user) => createGroup(db, user, personalGroupName(user));

module.exports = {
  JOIN_ALPHABET, JOIN_CODE_RE, newJoinCode, normalizeJoinCode, newSlug, thaiAcademicYear,
  validateGroupName, personalGroupName, createGroup, createPersonalGroup,
};
