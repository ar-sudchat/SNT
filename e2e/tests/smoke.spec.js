const { test, expect } = require('@playwright/test');
const { API, login, watchConsole, apiToken } = require('./helpers');

test.describe('เข้าสู่ระบบ', () => {
  test('admin/1234 เข้าได้', async ({ page }) => {
    await login(page, 'admin');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('T001/T001 เข้าได้', async ({ page }) => {
    await login(page, 'teacher');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('รหัสผ่านผิด แสดงข้อความผิดพลาดภาษาไทย', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#username').fill('e2e-no-such-user@example.com');
    await page.locator('input[type="password"]').fill('wrong-pass-E2E');
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText('เข้าสู่ระบบไม่สำเร็จ')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('ครู', () => {
  test('หน้าแรกครูโหลด และมี "สแกนส่งงาน"', async ({ page }) => {
    await login(page, 'teacher');
    await page.goto('/teacher');
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /สแกน/ }).filter({ visible: true }).first()).toBeVisible();
  });

  test('สแกนเนอร์: พิมพ์รหัสผิด แสดงข้อผิดพลาดภาษาไทย', async ({ page }) => {
    await login(page, 'teacher');
    await page.goto('/teacher/scan');
    await expect(page.getByRole('heading', { name: 'สแกนส่งงาน' })).toBeVisible();
    await page.getByRole('button', { name: /พิมพ์รหัสแทน/ }).click();
    await page.getByPlaceholder('รหัสนักเรียน หรือ รหัส QR').fill('E2E-INVALID-CODE-000');
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(/ไม่พบ|ไม่ถูกต้อง|ไม่สามารถ/).first()).toBeVisible();
  });
});

test.describe('แอดมิน', () => {
  test('รายชื่อนักเรียนโหลด + หน้าต่างแก้ไข ย่อ/คืน/ปิด', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/students');
    await expect(page.getByRole('heading', { name: 'นักเรียน', exact: true })).toBeVisible();
    // เปิดหน้าต่าง "เพิ่มนักเรียน" (ไม่บันทึก) — ไม่แตะข้อมูลจริง
    await page.getByRole('button', { name: 'เพิ่มนักเรียน' }).first().click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'ย่อหน้าต่าง' }).click();
    const restore = page.getByRole('button', { name: 'คืนหน้าต่าง' });
    await expect(restore).toBeVisible();
    await restore.click();
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
    await expect(dlg).toBeHidden();
  });

  test('สร้างงานโดยไม่กรอกอะไร แสดง "กรุณาเลือกวิชา"', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/tasks');
    await expect(page.getByRole('heading', { name: 'งาน', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'เพิ่มงาน' }).first().click();
    await page.locator('button[type="submit"][form="task-form"]').click();
    await expect(page.getByText('กรุณาเลือกวิชา').first()).toBeVisible();
  });

  test('ดาวน์โหลดเทมเพลตนำเข้า (API) ได้ 200', async ({ request }) => {
    const token = await apiToken(request, 'admin');
    const res = await request.get(`${API}/import/templates/student`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect((await res.body()).length).toBeGreaterThan(10);
  });
});

test.describe('ติดตามงาน', () => {
  test('หน้าติดตามรายวิชาโหลด และมีตัวเลขสรุป', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/monitor/subject');
    await expect(page.getByRole('heading', { name: /ติดตามงาน/ }).first()).toBeVisible();
    await expect(page.locator('main, body').first()).toContainText(/\d+/);
  });
});

test.describe('ธีมสี', () => {
  test('เปลี่ยน data-color-theme และคงอยู่หลังรีโหลด', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    const html = page.locator('html');
    const before = await html.getAttribute('data-color-theme');
    const picker = page.locator('button[aria-label="ธีมสี"]:visible').first();
    if (!(await picker.isVisible())) {
      // มือถือ: ตัวเลือกธีมอยู่ในแผ่น "เพิ่มเติม" (ถ้าเมนูถูกออกแบบใหม่ ให้แก้ตรงนี้)
      await page.getByRole('button', { name: 'เพิ่มเติม' }).click();
    }
    await picker.click();
    const panel = page.getByRole('dialog', { name: 'เลือกธีมสี' }).or(page.locator('[aria-label="เลือกธีมสี"]'));
    const options = panel.locator('button[aria-pressed="false"]');
    await options.first().click();
    const after = await html.getAttribute('data-color-theme');
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
    await page.reload();
    await expect(html).toHaveAttribute('data-color-theme', after);
  });
});

test.describe('คุณภาพทั่วไป', () => {
  const ADMIN_PAGES = [
    '/dashboard', '/admin', '/admin/students', '/admin/teachers', '/admin/subjects',
    '/admin/classes', '/admin/tasks', '/admin/qrcode', '/admin/import', '/monitor/subject',
  ];

  test('ไม่มีหน้าไหนเลื่อนแนวนอนที่ 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await login(page, 'admin');
    const bad = [];
    for (const p of ADMIN_PAGES.concat(['/login'])) {
      await page.goto(p);
      await page.waitForLoadState('networkidle');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 1) bad.push(`${p} (+${over}px)`);
    }
    expect(bad, 'หน้าที่ล้นแนวนอน').toEqual([]);
  });

  test('ไม่มี console error ในหน้าที่เข้า', async ({ page }) => {
    const errors = watchConsole(page);
    await login(page, 'admin');
    for (const p of ADMIN_PAGES) {
      await page.goto(p);
      await page.waitForLoadState('networkidle');
    }
    await page.goto('/teacher/scan');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
});
