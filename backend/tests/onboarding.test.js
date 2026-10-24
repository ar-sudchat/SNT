const test = require('node:test');
const assert = require('node:assert');
const c = require('../controllers/onboardingController');

test('slug validation: format, length, reserved', () => {
  assert.ok(c.validateSlug('Wat-Pho-1').ok);
  assert.strictEqual(c.validateSlug('Wat-Pho-1').slug, 'wat-pho-1');
  for (const bad of ['ab', 'a'.repeat(31), 'has space', 'ไทย', 'a_b_c', '-abc', 'abc-', '', null, undefined]) {
    assert.strictEqual(c.validateSlug(bad).ok, false, String(bad));
  }
  for (const r of ['api', 's', 'ops', 'admin', 'auth', 'p', 'privacy', 'guide', 'static']) {
    assert.ok(c.RESERVED_SLUGS.has(r));
  }
  for (const r of ['api', 'ops', 'admin', 'auth', 'privacy', 'guide', 'static']) assert.strictEqual(c.validateSlug(r).ok, false, r);
});

test('invite token: 32 random bytes, unique', () => {
  const a = c.newInviteToken(), b = c.newInviteToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notStrictEqual(a, b);
});

test('invite state: ok / expired / accepted (single use)', () => {
  const now = new Date('2026-10-24T00:00:00Z');
  const fresh = { acceptedAt: null, expiresAt: new Date(now.getTime() + c.INVITE_TTL_MS) };
  assert.strictEqual(c.INVITE_TTL_MS, 7 * 86400000);
  assert.strictEqual(c.inviteState(fresh, now), 'ok');
  assert.strictEqual(c.inviteState({ ...fresh, expiresAt: new Date(now.getTime() - 1) }, now), 'expired');
  assert.strictEqual(c.inviteState({ ...fresh, expiresAt: now }, now), 'expired');
  assert.strictEqual(c.inviteState({ ...fresh, acceptedAt: now }, now), 'accepted');
});

test('only OWNER/ADMIN may manage invites', () => {
  assert.ok(c.canManageInvites('OWNER'));
  assert.ok(c.canManageInvites('ADMIN'));
  assert.ok(!c.canManageInvites('TEACHER'));
  assert.ok(!c.canManageInvites('STUDENT'));
  assert.ok(!c.canManageInvites(undefined));
});

test('Thai academic year switches in May', () => {
  assert.strictEqual(c.thaiAcademicYear(new Date(2026, 9, 1)), 2569);
  assert.strictEqual(c.thaiAcademicYear(new Date(2027, 1, 1)), 2569);
  assert.strictEqual(c.thaiAcademicYear(new Date(2027, 4, 1)), 2570);
});

test('password rule and rate limiter', () => {
  assert.ok(c.validatePassword('short'));
  assert.strictEqual(c.validatePassword('longenough1'), null);
  const rl = c.makeRateLimit(2, 1000, 'x');
  const res = () => { const r = { code: 200, status(n) { r.code = n; return r; }, json() { return r; }, set() {} }; return r; };
  let passed = 0; const next = () => { passed++; };
  for (let i = 0; i < 3; i++) rl({ ip: '1.1.1.1' }, res(), next);
  assert.strictEqual(passed, 2);
});
