const { expect } = require('@playwright/test');

const API = process.env.SNT_API || 'http://localhost:5001/api';
const USERS = {
  admin: { username: 'admin', password: '1234' },
  teacher: { username: 'T001', password: 'T001' },
};

async function login(page, who) {
  const { username, password } = USERS[who];
  await page.goto('/login');
  // Default form is email; username/teacher-code logins use the admin toggle.
  await page.getByRole('button', { name: 'เข้าสู่ระบบผู้ดูแลระบบ' }).click();
  await page.locator('#username').fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
}

// เก็บ console error / pageerror ระหว่างทดสอบ
function watchConsole(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // 4xx จากการทดสอบเชิงลบ (รหัสผิด ฯลฯ) ไม่นับ
    if (/Failed to load resource.*(40[0-9])/.test(t)) return;
    errors.push('console: ' + t);
  });
  return errors;
}

async function apiToken(request, who) {
  const res = await request.post(`${API}/auth/login`, { data: USERS[who] });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token;
}

module.exports = { API, USERS, login, watchConsole, apiToken };

// ---------- กลุ่ม (multi-tenant) ----------
// ข้อมูลที่เทสต์สร้างใช้อีเมล e2e-grp-*@example.test เท่านั้น แล้วลบทิ้งผ่าน psql กับฐาน local (snt_local) เท่านั้น
const { execFileSync } = require('child_process');
const E2E_EMAIL_LIKE = 'e2e-grp-%@example.test';
const E2E_PASSWORD = 'E2e-pass-12345';

function uniqueId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function newE2EUser(label) {
  const id = uniqueId();
  return { name: `E2E-${label}-${id}`, email: `e2e-grp-${label.toLowerCase()}-${id}@example.test`, password: E2E_PASSWORD };
}

// ล้างผู้ใช้ทดสอบ + กลุ่มที่เหลือไม่มีสมาชิก — ปฏิเสธการทำงานถ้าไม่ใช่ฐาน local
function localDbUrl() {
  const url = process.env.E2E_DATABASE_URL || `postgresql://${process.env.USER}@localhost:5432/snt_local?host=/tmp`;
  if (!/\/snt_local(\?|$)/.test(url)) throw new Error('E2E cleanup ใช้ได้กับฐาน snt_local เท่านั้น: ' + url);
  return url;
}

function cleanupE2EData() {
  // ตารางข้อมูลของกลุ่มทุกตารางที่มีคอลัมน์ tenantId (Teacher, AcademicYear ฯลฯ) ลบก่อน แล้วค่อยลบ Tenant และ User
  const sql = `
    CREATE TEMP TABLE e2e_t AS SELECT DISTINCT m."tenantId" AS id FROM "Membership" m JOIN "User" u ON u.id = m."userId" WHERE u.email LIKE '${E2E_EMAIL_LIKE}';
    DELETE FROM "User" WHERE email LIKE '${E2E_EMAIL_LIKE}';
    DO $$ DECLARE r record; pass int; BEGIN
      FOR pass IN 1..6 LOOP
        FOR r IN SELECT table_name FROM information_schema.columns
                 WHERE table_schema = 'public' AND column_name = 'tenantId' AND table_name NOT IN ('Tenant', 'Membership', 'Invite', 'AuditLog') LOOP
          BEGIN
            EXECUTE format('DELETE FROM %I WHERE "tenantId" IN (SELECT id FROM e2e_t)', r.table_name);
          EXCEPTION WHEN foreign_key_violation THEN NULL; -- ตารางลูกยังไม่ถูกลบ รอบถัดไปค่อยลองใหม่
          END;
        END LOOP;
      END LOOP;
    END $$;
    DELETE FROM "Tenant" WHERE id IN (SELECT id FROM e2e_t);`;
  try {
    execFileSync('psql', [localDbUrl(), '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], { stdio: 'pipe' });
  } catch (e) {
    console.warn('E2E cleanup ไม่สำเร็จ:', String(e.stderr || e.message).slice(0, 300));
  }
}

async function signupViaUI(page, u) {
  await page.goto('/signup');
  await page.locator('#name').fill(u.name);
  await page.locator('#email').fill(u.email);
  await page.locator('#new-password').fill(u.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/teacher/);
}

async function loginViaEmail(page, u) {
  await page.goto('/login');
  await page.locator('#username').fill(u.email);
  await page.locator('input[type="password"]').fill(u.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
}

// ปุ่มสลับกลุ่มบนหัวหน้าจอ (title="สลับกลุ่ม")
const switcherButton = (page) => page.locator('button[title="สลับกลุ่ม"]');

// กล่องโต้ตอบของเบราว์เซอร์ (alert/confirm/prompt) ต้องไม่เกิดขึ้น — ถ้าเกิดให้เก็บไว้แล้วล้มเทสต์
function forbidNativeDialogs(page) {
  const seen = [];
  page.on('dialog', async (d) => { seen.push(`${d.type()}: ${d.message()}`); await d.dismiss().catch(() => {}); });
  return seen;
}

module.exports = Object.assign(module.exports, {
  E2E_PASSWORD, newE2EUser, cleanupE2EData, signupViaUI, loginViaEmail, switcherButton, forbidNativeDialogs,
});
