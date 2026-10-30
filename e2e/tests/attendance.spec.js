const { test, expect } = require('@playwright/test');
const { login, watchConsole, forbidNativeDialogs } = require('./helpers');
const { mockApi } = require('./mockApi');

// เช็คชื่อเข้าเรียน /attendance (3 แบบ) — API เป็น mock ในหน่วยความจำ ไม่เขียนฐานข้อมูลจริง
const STUDENTS = [
  { id: 11, studentCode: 'S001', name: 'เด็กชายทดสอบ หนึ่ง', className: 'ป.4/1', classId: 3, studentNumber: 1 },
  { id: 12, studentCode: 'S002', name: 'เด็กหญิงทดสอบ สอง', className: 'ป.4/1', classId: 3, studentNumber: 2 },
  { id: 13, studentCode: 'S003', name: 'เด็กชายทดสอบ สาม', className: 'ป.4/1', classId: 3, studentNumber: 3 },
];
const SUBJECT = { id: 7, subjectCode: 'SC41', subjectName: 'วิทยาศาสตร์ E2E' };

function handlers() {
  const subj = {}; // studentId -> PRESENT|ABSENT
  const day = {};
  const counts = (m, withUnchecked) => {
    const present = STUDENTS.filter(s => m[s.id] === 'PRESENT').length;
    const absent = withUnchecked ? STUDENTS.filter(s => m[s.id] === 'ABSENT').length : STUDENTS.length - present;
    return { present, absent, total: STUDENTS.length, unchecked: STUDENTS.length - present - (withUnchecked ? absent : 0) };
  };
  const rows = (m, withUnchecked) => STUDENTS.map(s => ({ ...s, status: m[s.id] || (withUnchecked ? null : 'ABSENT') }));
  const find = (b) => STUDENTS.find(s => s.studentCode === b.studentCode || (b.qrcodeData || '').includes(s.studentCode));
  return [
    ['GET', /^reports\/teacher\/subjects$/, () => ({ body: [SUBJECT] })],
    ['GET', /^classes$/, () => ({ body: [{ id: 3, className: 'ป.4/1', gradeId: 4 }] })],
    ['GET', /^attendance\/sheet$/, () => ({ body: { subject: SUBJECT, students: rows(subj, true), counts: counts(subj, true) } })],
    ['GET', /^attendance\/day\/sheet$/, () => ({ body: { cls: { className: 'ป.4/1' }, students: rows(day, false), counts: counts(day, false) } })],
    ['POST', /^attendance\/scan$/, ({ body }) => {
      const s = find(body);
      if (!s) return { status: 404, body: { error: 'ไม่พบนักเรียนรหัสนี้' } };
      const already = subj[s.id] === 'PRESENT';
      subj[s.id] = 'PRESENT';
      return { body: { student: s, subject: SUBJECT, alreadyMarked: already } };
    }],
    ['POST', /^attendance\/day\/scan$/, ({ body }) => {
      const s = find(body);
      if (!s) return { status: 404, body: { error: 'ไม่พบนักเรียนรหัสนี้' } };
      const already = day[s.id] === 'PRESENT';
      day[s.id] = 'PRESENT';
      return { body: { student: s, alreadyMarked: already } };
    }],
    ['PUT', /^attendance\/mark$/, ({ body }) => { subj[body.studentId] = body.status; return { body: { ok: true } }; }],
    ['PUT', /^attendance\/day\/mark$/, ({ body }) => { day[body.studentId] = body.present ? 'PRESENT' : 'ABSENT'; return { body: { ok: true } }; }],
    ['POST', /^attendance\/close$/, () => { STUDENTS.forEach(s => { if (!subj[s.id]) subj[s.id] = 'ABSENT'; }); return { body: { ok: true } }; }],
  ];
}

async function open(page) {
  await login(page, 'teacher');
  await page.evaluate(() => { ['attendance_mode', 'attendance_subject', 'attendance_class'].forEach(k => localStorage.removeItem(k)); });
  const calls = [];
  await mockApi(page, handlers().map(([m, re, fn]) => [m, re, (c) => { calls.push({ m, path: c.path, body: c.body }); return fn(c); }]));
  await page.goto('/attendance');
  return calls;
}

const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const row = (page, name) => page.getByRole('button', { name: new RegExp(name) });

test.describe('เช็คชื่อ /attendance', () => {
  test('มีครบ 3 แบบ และสลับแบบได้ (จำแบบที่เลือกหลังรีโหลด)', async ({ page }) => {
    const errors = watchConsole(page);
    await open(page);
    await expect(page.getByRole('heading', { name: 'เช็คชื่อเข้าเรียน' })).toBeVisible();
    for (const n of ['มาเรียนไหม', 'เลือกวิชาเอง', 'สแกนเล่มวิชา']) await expect(tab(page, n)).toBeVisible();
    await expect(tab(page, 'เลือกวิชาเอง')).toHaveAttribute('aria-selected', 'true'); // ค่าเริ่มต้น
    await tab(page, 'สแกนเล่มวิชา').click();
    await expect(tab(page, 'สแกนเล่มวิชา')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('ไม่ต้องเลือกวิชา')).toBeVisible();
    await page.reload();
    await expect(tab(page, 'สแกนเล่มวิชา')).toHaveAttribute('aria-selected', 'true');
    expect(errors).toEqual([]);
  });

  test('เลือกวิชาเอง: สแกน/พิมพ์รหัส → มา · กดแถวสลับ มา/ไม่มา · ปิดคาบ = ที่เหลือไม่มา', async ({ page }) => {
    const errors = watchConsole(page);
    const dialogs = forbidNativeDialogs(page);
    const calls = await open(page);
    await tab(page, 'เลือกวิชาเอง').click();
    // มีวิชาเดียว → เลือกให้เอง · เห็นรายชื่อ ยังไม่เช็คทั้งหมด
    await expect(page.getByRole('heading', { name: 'วิทยาศาสตร์ E2E' })).toBeVisible();
    await expect(page.getByText('มา 0/3 · ไม่มา 0 · ยังไม่เช็ค 3')).toBeVisible();

    const code = page.getByLabel('รหัสนักเรียน');
    await code.fill('S001');
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('เด็กชายทดสอบ หนึ่ง');
    await expect(page.getByRole('status')).toContainText('มา');
    await expect(page.getByText('มา 1/3 · ไม่มา 0 · ยังไม่เช็ค 2')).toBeVisible();
    expect(calls.find(c => c.path === 'attendance/scan').body).toMatchObject({ studentCode: 'S001', subjectId: 7 });

    // สแกนซ้ำ → เช็คไปแล้ว
    await code.fill('S001');
    await code.press('Enter');
    await expect(page.getByRole('status')).toContainText('เช็คไปแล้ว');

    // รหัสผิด → ข้อความผิดพลาด
    await code.fill('NOPE');
    await code.press('Enter');
    await expect(page.getByRole('alert')).toContainText('ไม่พบนักเรียนรหัสนี้');

    // เช็คมือ: คนที่ 2 ยังไม่เช็ค → มา → ไม่มา
    await row(page, 'เด็กหญิงทดสอบ สอง').click();
    await expect(page.getByText('มา 2/3 · ไม่มา 0 · ยังไม่เช็ค 1')).toBeVisible();
    await row(page, 'เด็กหญิงทดสอบ สอง').click();
    await expect(page.getByText('มา 1/3 · ไม่มา 1 · ยังไม่เช็ค 1')).toBeVisible();
    expect(calls.filter(c => c.path === 'attendance/mark').map(c => c.body.status)).toEqual(['PRESENT', 'ABSENT']);

    // ปิดคาบ: ยกเลิกก่อน → ไม่เปลี่ยน, แล้วยืนยัน → ที่เหลือ = ไม่มา
    await page.getByRole('button', { name: 'ปิดคาบ (ที่เหลือ = ไม่มา)' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('ปิดคาบนี้?');
    await dlg.getByRole('button', { name: 'ยกเลิก' }).click();
    await expect(page.getByText('มา 1/3 · ไม่มา 1 · ยังไม่เช็ค 1')).toBeVisible();
    expect(calls.some(c => c.path === 'attendance/close')).toBe(false);

    await page.getByRole('button', { name: 'ปิดคาบ (ที่เหลือ = ไม่มา)' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'ปิดคาบ', exact: true }).click();
    await expect(page.getByText('มา 1/3 · ไม่มา 2 · ยังไม่เช็ค 0')).toBeVisible();
    expect(calls.find(c => c.path === 'attendance/close').body).toMatchObject({ subjectId: 7 });

    expect(dialogs).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('มาเรียนไหม: เลือกห้อง · พิมพ์รหัส = มาโรงเรียน · กดแถวสลับ · ไม่มีปุ่มปิดคาบ', async ({ page }) => {
    const errors = watchConsole(page);
    const calls = await open(page);
    await tab(page, 'มาเรียนไหม').click();
    await expect(page.getByRole('heading', { name: 'ป.4/1' })).toBeVisible(); // มีห้องเดียว → เลือกให้
    await expect(page.getByText('มา 0/3 · ไม่มา 3', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /ปิดคาบ/ })).toHaveCount(0);

    await page.getByLabel('รหัสนักเรียน').fill('S003');
    await page.getByLabel('รหัสนักเรียน').press('Enter');
    await expect(page.getByRole('status')).toContainText('เด็กชายทดสอบ สาม');
    await expect(page.getByText('มา 1/3 · ไม่มา 2', { exact: true })).toBeVisible();
    expect(calls.find(c => c.path === 'attendance/day/scan').body).toMatchObject({ studentCode: 'S003' });

    await row(page, 'เด็กชายทดสอบ หนึ่ง').click();
    await expect(page.getByText('มา 2/3 · ไม่มา 1', { exact: true })).toBeVisible();
    await row(page, 'เด็กชายทดสอบ สาม').click(); // กดซ้ำคนที่มา → ไม่มา
    await expect(page.getByText('มา 1/3 · ไม่มา 2', { exact: true })).toBeVisible();
    expect(calls.filter(c => c.path === 'attendance/day/mark').map(c => c.body.present)).toEqual([true, false]);
    expect(errors).toEqual([]);
  });

  test('สแกนเล่มวิชา: ไม่ต้องเลือกวิชา · QR ของเล่มบอกวิชาเอง', async ({ page }) => {
    const errors = watchConsole(page);
    const calls = await open(page);
    await tab(page, 'มาเรียนไหม').click(); // แบบ "เลือกวิชาเอง" (ค่าเริ่มต้น) ค้างรายชื่อวิชาไว้ จึงผ่านแบบอื่นก่อนเพื่อล้าง
    await tab(page, 'สแกนเล่มวิชา').click();
    await expect(page.getByRole('button', { name: 'เปิดกล้องสแกน' })).toBeEnabled(); // ไม่ต้องเลือกวิชา
    await expect(page.getByRole('heading', { name: 'วิทยาศาสตร์ E2E' })).toHaveCount(0); // ยังไม่มีรายชื่อจนกว่าจะสแกน

    // ข้อความที่ขึ้นต้น SNT-/KS1. ถูกส่งเป็น qrcodeData (เหมือนที่กล้องอ่านได้)
    await page.getByLabel('รหัสนักเรียน').fill('SNT-S002-7');
    await page.getByLabel('รหัสนักเรียน').press('Enter');
    await expect(page.getByRole('status')).toContainText('เด็กหญิงทดสอบ สอง');
    await expect(page.getByRole('status')).toContainText('วิทยาศาสตร์ E2E');
    await expect(page.getByRole('heading', { name: 'วิทยาศาสตร์ E2E' })).toBeVisible();
    await expect(page.getByText('มา 1/3 · ไม่มา 0 · ยังไม่เช็ค 2')).toBeVisible();
    const scan = calls.find(c => c.path === 'attendance/scan');
    expect(scan.body).toMatchObject({ qrcodeData: 'SNT-S002-7' });
    expect(scan.body.subjectId).toBeUndefined();

    // ปิดคาบได้จากรายชื่อที่ได้จากการสแกน
    await page.getByRole('button', { name: 'ปิดคาบ (ที่เหลือ = ไม่มา)' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'ปิดคาบ', exact: true }).click();
    await expect(page.getByText('มา 1/3 · ไม่มา 2 · ยังไม่เช็ค 0')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('เลือกวิชาเอง + เปิดกล้องไม่ได้ → ข้อความไทย', async ({ page }) => {
    await open(page);
    await tab(page, 'เลือกวิชาเอง').click();
    await page.getByRole('button', { name: 'เปิดกล้องสแกน' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('รหัสนักเรียน')).toBeEnabled();
  });
});
