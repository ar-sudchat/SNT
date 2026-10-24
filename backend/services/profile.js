// Pure validation for profile updates (no I/O) — tested in tests/profile.test.js
const AVATAR_MAX_BYTES = 150 * 1024;
const ACCENTS = ['brand', 'sky', 'violet', 'rose', 'amber', 'emerald'];
const PRESETS = ['teacher', 'owl', 'cat', 'robot', 'rocket', 'book', 'fox', 'panda', 'bear', 'alien', 'star', 'plant', 'frog', 'penguin'];
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAGIC = {
  png: b => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpeg: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};
const clean = s => String(s).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();

// Returns { data } with only allowed keys, or { error } (Thai message)
function validateProfile(body) {
  const b = body && typeof body === 'object' ? body : {};
  const data = {};
  if ('avatar' in b) {
    if (b.avatar === null || b.avatar === '') data.avatar = null;
    else {
      const m = typeof b.avatar === 'string' && b.avatar.length < 300000 && DATA_URL.exec(b.avatar);
      if (!m) return { error: 'รูปโปรไฟล์ต้องเป็นไฟล์ PNG, JPEG หรือ WebP' };
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > AVATAR_MAX_BYTES) return { error: 'รูปโปรไฟล์ใหญ่เกิน 150KB' };
      if (!MAGIC[m[1]](buf)) return { error: 'ไฟล์รูปไม่ถูกต้อง' };
      data.avatar = b.avatar;
    }
  }
  if ('avatarPreset' in b) {
    if (b.avatarPreset === null || b.avatarPreset === '') data.avatarPreset = null;
    else if (PRESETS.includes(b.avatarPreset)) data.avatarPreset = b.avatarPreset;
    else return { error: 'ไม่พบรูปการ์ตูนที่เลือก' };
  }
  if ('displayName' in b) {
    const v = b.displayName == null ? '' : clean(b.displayName);
    if (v.length > 40) return { error: 'ชื่อที่แสดงยาวได้ไม่เกิน 40 ตัวอักษร' };
    data.displayName = v || null;
  }
  if ('bio' in b) {
    const v = b.bio == null ? '' : clean(b.bio);
    if (v.length > 120) return { error: 'คำแนะนำตัวยาวได้ไม่เกิน 120 ตัวอักษร' };
    data.bio = v || null;
  }
  if ('accent' in b) {
    if (b.accent === null || b.accent === '') data.accent = null;
    else if (ACCENTS.includes(b.accent)) data.accent = b.accent;
    else return { error: 'สีที่เลือกไม่ถูกต้อง' };
  }
  if (!Object.keys(data).length) return { error: 'ไม่มีข้อมูลที่จะบันทึก' };
  return { data };
}

// Longest run of consecutive days ending today or yesterday (Bangkok time)
function dayKey(d) { return new Date(new Date(d).getTime() + 7 * 3600e3).toISOString().slice(0, 10); }
function streakOf(dates, now = new Date()) {
  const set = new Set(dates.map(dayKey));
  let cur = new Date(now);
  if (!set.has(dayKey(cur))) cur = new Date(cur.getTime() - 86400e3);
  let n = 0;
  while (set.has(dayKey(cur))) { n++; cur = new Date(cur.getTime() - 86400e3); }
  return n;
}

module.exports = { validateProfile, streakOf, dayKey, ACCENTS, PRESETS, AVATAR_MAX_BYTES };
