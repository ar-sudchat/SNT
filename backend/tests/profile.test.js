const test = require('node:test');
const assert = require('node:assert');
const { validateProfile, streakOf } = require('../services/profile');

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(10)]);
const url = (mime, buf) => `data:image/${mime};base64,${buf.toString('base64')}`;

test('accepts png/jpeg/webp data URLs', () => {
  for (const [m, b] of [['png', png], ['jpeg', jpeg], ['webp', webp]]) {
    const r = validateProfile({ avatar: url(m, b) });
    assert.ok(r.data, m); assert.strictEqual(r.data.avatar, url(m, b));
  }
});

test('rejects svg, gif, non-data URLs and script payloads', () => {
  for (const a of ['data:image/svg+xml;base64,PHN2Zz4=', url('gif', png), 'https://evil/x.png', 'javascript:alert(1)',
    `data:image/png;base64,${png.toString('base64')}"><script>`, 123, {}]) {
    assert.match(validateProfile({ avatar: a }).error || '', /PNG|รูป/);
  }
});

test('rejects mismatched magic bytes', () => {
  assert.strictEqual(validateProfile({ avatar: url('png', jpeg) }).error, 'ไฟล์รูปไม่ถูกต้อง');
});

test('rejects avatar over 150KB decoded', () => {
  const big = Buffer.concat([png, Buffer.alloc(150 * 1024)]);
  assert.strictEqual(validateProfile({ avatar: url('png', big) }).error, 'รูปโปรไฟล์ใหญ่เกิน 150KB');
});

test('null avatar removes it', () => {
  assert.deepStrictEqual(validateProfile({ avatar: null }).data, { avatar: null });
});

test('strips unknown fields, html and control chars', () => {
  const r = validateProfile({ displayName: ' ครู<b>สม</b>\n ใจ ', role: 'ADMIN', password: 'x', bio: 'hi' });
  assert.deepStrictEqual(r.data, { displayName: 'ครูbสม/b ใจ', bio: 'hi' });
});

test('bio max 120, name max 40, accent/preset whitelists', () => {
  assert.match(validateProfile({ bio: 'ก'.repeat(121) }).error, /120/);
  assert.ok(validateProfile({ bio: 'ก'.repeat(120) }).data);
  assert.match(validateProfile({ displayName: 'a'.repeat(41) }).error, /40/);
  assert.ok(validateProfile({ accent: 'violet' }).data);
  assert.ok(validateProfile({ accent: 'red;}' }).error);
  assert.ok(validateProfile({ avatarPreset: 'owl' }).data);
  assert.ok(validateProfile({ avatarPreset: '../x' }).error);
  assert.ok(validateProfile({}).error);
});

test('streak counts consecutive Bangkok days ending today or yesterday', () => {
  const now = new Date('2026-10-24T05:00:00Z');
  const d = (s) => new Date(s);
  assert.strictEqual(streakOf([d('2026-10-24T01:00:00Z'), d('2026-10-23T10:00:00Z'), d('2026-10-22T03:00:00Z'), d('2026-10-20T03:00:00Z')], now), 3);
  assert.strictEqual(streakOf([d('2026-10-23T03:00:00Z')], now), 1);
  assert.strictEqual(streakOf([d('2026-10-21T03:00:00Z')], now), 0);
});
