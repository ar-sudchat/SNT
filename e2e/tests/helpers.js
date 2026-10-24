const { expect } = require('@playwright/test');

const API = process.env.SNT_API || 'http://localhost:5001/api';
const USERS = {
  admin: { username: 'admin', password: '1234' },
  teacher: { username: 'T001', password: 'T001' },
};

async function login(page, who) {
  const { username, password } = USERS[who];
  await page.goto('/login');
  await page.getByLabel(/รหัส/).first().fill(username);
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
