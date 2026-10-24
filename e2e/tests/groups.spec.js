const { test, expect } = require('@playwright/test');
const {
  newE2EUser, cleanupE2EData, signupViaUI, loginViaEmail, switcherButton, forbidNativeDialogs,
} = require('./helpers');

// ---- หน้าที่ผู้เยี่ยมชมเห็น (ไม่ต้องมีบัญชี) ----
test.describe('ผู้เยี่ยมชมที่ยังไม่ล็อกอิน', () => {
  test('หน้า Landing โหลด และมีปุ่มสมัครไปที่ /signup', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('link', { name: /สมัครใช้ฟรี/ }).filter({ visible: true }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/signup');
    await cta.click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('หน้า /login มีปุ่ม Google และสลับไปเข้าสู่ระบบผู้ดูแลระบบได้', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('เข้าสู่ระบบด้วย Google')).toBeVisible();
    await expect(page.locator('#username')).toHaveAttribute('type', 'email');
    await page.getByRole('button', { name: 'เข้าสู่ระบบผู้ดูแลระบบ' }).click();
    await expect(page.locator('#username')).toHaveAttribute('type', 'text');
    await expect(page.getByText('เข้าสู่ระบบด้วย Google')).toBeHidden();
  });

  test('หน้า /signup มีปุ่ม Google และลิงก์เข้าร่วมกลุ่มด้วยรหัส', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByText('สมัครด้วย Google')).toBeVisible();
    await expect(page.getByRole('link', { name: 'เข้าร่วมกลุ่มด้วยรหัส' })).toBeVisible();
  });
});

// ---- กลุ่ม: สมัคร -> รหัส -> เข้าร่วม -> สลับ -> สมาชิก -> ออก ----
test.describe.serial('กลุ่ม (multi-tenant)', () => {
  let A; let B; let code; let nativeDialogs;
  const groupA = () => `กลุ่มของ ${A.name}`;
  const groupB = () => `กลุ่มของ ${B.name}`;

  test.beforeAll(() => { cleanupE2EData(); A = newE2EUser('a'); B = newE2EUser('b'); });
  test.afterAll(() => { cleanupE2EData(); });
  test.beforeEach(({ page }) => { nativeDialogs = forbidNativeDialogs(page); });
  test.afterEach(() => { expect(nativeDialogs, 'ห้ามมี alert/confirm/prompt ของเบราว์เซอร์').toEqual([]); });

  // เปิดรายการกลุ่มแล้วเลือกกลุ่มตามชื่อ (สลับแล้วหน้าโหลดใหม่)
  const openSwitcher = async (page) => {
    await switcherButton(page).click();
    await expect(page.getByRole('listbox')).toBeVisible();
  };
  const switchToGroup = async (page, name) => {
    await openSwitcher(page);
    await page.getByRole('option', { name }).getByRole('button').click();
    await expect(switcherButton(page)).toContainText(name);
  };

  test('สมัครใหม่ -> เข้าหน้าครู และชื่อกลุ่มส่วนตัวอยู่ในตัวสลับกลุ่ม', async ({ page }) => {
    await signupViaUI(page, A);
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
    await expect(switcherButton(page)).toContainText(groupA());
  });

  test('ตั้งค่ากลุ่ม: แสดงรหัสเข้ากลุ่ม XXX-XXX', async ({ page }) => {
    await loginViaEmail(page, A);
    await page.goto('/group');
    await expect(page.getByRole('heading', { name: 'ตั้งค่ากลุ่ม' })).toBeVisible();
    const codeEl = page.locator('p[aria-label^="รหัสกลุ่ม"]');
    await expect(codeEl).toHaveText(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
    code = (await codeEl.textContent()).trim();
    await expect(page.getByRole('button', { name: 'คัดลอกรหัส' })).toBeVisible();
  });

  test('คนที่สอง: สมัคร -> /join ใส่รหัส -> ตัวสลับกลุ่มมี 2 กลุ่ม และสลับได้', async ({ page }) => {
    expect(code, 'ต้องได้รหัสจากเทสต์ก่อนหน้า').toBeTruthy();
    await signupViaUI(page, B);
    await expect(switcherButton(page)).toContainText(groupB());

    await page.goto('/join');
    await page.locator('#join-code').fill(code);
    await page.getByRole('button', { name: 'เข้าร่วมกลุ่ม', exact: true }).click();
    await expect(page).toHaveURL(/\/(teacher|dashboard)?$/);
    await expect(switcherButton(page)).toContainText(groupA());

    await openSwitcher(page);
    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(page.getByRole('option', { name: groupA() })).toBeVisible();
    await expect(page.getByRole('option', { name: groupB() })).toBeVisible();

    await page.getByRole('option', { name: groupB() }).getByRole('button').click();
    await expect(switcherButton(page)).toContainText(groupB());
    await switchToGroup(page, groupA());
  });

  test('รายชื่อสมาชิกของกลุ่มแสดงทั้งสองคน', async ({ page }) => {
    await loginViaEmail(page, B);
    await switchToGroup(page, groupA());
    await page.goto('/group');
    const members = page.locator('section[aria-labelledby="g-members"]');
    await expect(members.getByRole('heading', { name: /สมาชิก \(2\)/ })).toBeVisible();
    await expect(members.getByRole('listitem').filter({ hasText: A.name })).toHaveCount(1);
    const me = members.getByRole('listitem').filter({ hasText: B.name });
    await expect(me).toHaveCount(1);
    await expect(me).toContainText('(ฉัน)');
  });

  test('ออกจากกลุ่ม -> กลับมาที่กลุ่มส่วนตัวของตัวเอง', async ({ page }) => {
    await loginViaEmail(page, B);
    await switchToGroup(page, groupA());
    await page.goto('/group');
    const me = page.locator('section[aria-labelledby="g-members"]').getByRole('listitem').filter({ hasText: '(ฉัน)' });
    await me.getByRole('button', { name: 'ออกจากกลุ่ม' }).click();
    const dlg = page.getByRole('dialog', { name: 'ออกจากกลุ่ม?' });
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'ยืนยัน' }).click();
    await expect(switcherButton(page)).toContainText(groupB());
    await openSwitcher(page);
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option', { name: groupA() })).toHaveCount(0);
  });

  test('"+ สร้างกลุ่มใหม่" เปิดกล่องโต้ตอบของ KruScan (ไม่ใช่ prompt ของเบราว์เซอร์) แล้วยกเลิกได้', async ({ page }) => {
    await loginViaEmail(page, A);
    const before = await switcherButton(page).textContent();
    await openSwitcher(page);
    await page.getByRole('button', { name: '+ สร้างกลุ่มใหม่' }).click();
    const dlg = page.getByRole('dialog', { name: 'สร้างกลุ่มใหม่' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByLabel('ชื่อกลุ่ม')).toBeVisible();
    await dlg.getByRole('button', { name: 'ยกเลิก' }).click();
    await expect(dlg).toBeHidden();
    await expect(switcherButton(page)).toHaveText(before);
    await openSwitcher(page);
    await expect(page.getByRole('option')).toHaveCount(1); // ยกเลิกแล้ว ต้องไม่มีกลุ่มใหม่เกิดขึ้น
  });
});
