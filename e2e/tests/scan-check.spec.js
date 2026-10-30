const { test, expect } = require('@playwright/test');
const { login, watchConsole, forbidNativeDialogs } = require('./helpers');
const { mockApi } = require('./mockApi');

// สแกนตรวจงานต่อเนื่อง /teacher/scan — API งาน/สแกน/ความคืบหน้าเป็น mock
const STUDENTS = [
  { id: 11, studentCode: 'S001', name: 'เด็กชายทดสอบ หนึ่ง', className: 'ป.4/1', studentNumber: 1 },
  { id: 12, studentCode: 'S002', name: 'เด็กหญิงทดสอบ สอง', className: 'ป.4/1', studentNumber: 2 },
  { id: 13, studentCode: 'S003', name: 'เด็กชายทดสอบ สาม', className: 'ป.4/1', studentNumber: 3 },
];
const TASK = {
  id: 501, taskName: 'E2E ใบงานที่ 1', taskNumber: 1, scoringType: 'SCORED', maxScore: 10, deadline: null, rooms: [],
  subject: { id: 7, subjectName: 'วิทยาศาสตร์ E2E', teacherId: 1, gradeId: 4 },
};

function buildHandlers(calls) {
  const state = {}; // studentId -> { status, score }
  const progress = () => {
    const checked = Object.values(state).filter(s => s.status === 'APPROVED' || s.status === 'REJECTED').length;
    return { checked, total: STUDENTS.length, pending: 0, notSubmitted: STUDENTS.length - checked };
  };
  return [
    ['GET', /^tasks$/, () => ({ body: [TASK] })],
    ['GET', /^classes$/, () => ({ body: [] })],
    ['GET', /^submissions\/task-progress$/, () => ({ body: { progress: progress() } })],
    ['GET', /^submissions\/task-sheet$/, () => ({
      body: {
        task: { taskName: TASK.taskName, scoringType: 'SCORED', maxScore: 10 },
        students: STUDENTS.map(s => ({ ...s, status: state[s.id]?.status || 'NOT_SUBMITTED', score: state[s.id]?.score ?? null })),
      },
    })],
    ['POST', /^submissions\/scan-check$/, ({ body }) => {
      const s = STUDENTS.find(x => x.studentCode === body.studentCode || (body.qrcodeData || '').includes(x.studentCode));
      if (!s) return { status: 404, body: { error: 'ไม่พบนักเรียนรหัสนี้' } };
      const prev = state[s.id];
      const explicit = body.score !== undefined;
      if (prev && prev.status === 'APPROVED' && !explicit && !body.status) {
        return { body: { student: s, status: 'APPROVED', previousStatus: 'APPROVED', previousScore: prev.score, alreadyChecked: true, score: prev.score, maxScore: 10, scoringType: 'SCORED', progress: progress() } };
      }
      const score = explicit ? body.score : 10;
      state[s.id] = { status: body.status || 'APPROVED', score };
      return { body: { student: s, status: state[s.id].status, previousStatus: prev?.status || 'NOT_SUBMITTED', previousScore: prev?.score ?? null, alreadyChecked: false, score, maxScore: 10, scoringType: 'SCORED', progress: progress() } };
    }],
  ];
}

test.describe('สแกนตรวจงาน /teacher/scan', () => {
  test('เลือกงาน → สแกนต่อเนื่อง → ปรับคะแนน +/- → ดูรายชื่อ', async ({ page }) => {
    const errors = watchConsole(page);
    const dialogs = forbidNativeDialogs(page);
    await login(page, 'teacher');
    await page.evaluate(() => localStorage.removeItem('scancheck_task'));
    const calls = [];
    const handlers = buildHandlers(calls);
    // เก็บประวัติเรียก API
    const wrapped = handlers.map(([m, re, fn]) => [m, re, (c) => { calls.push({ m, path: c.path, body: c.body }); return fn(c); }]);
    await mockApi(page, wrapped);
    await page.goto('/teacher/scan');

    // ยังไม่ได้เลือกงาน → เห็นตัวเลือกงาน และปุ่มสแกน/บันทึกใช้ไม่ได้
    await expect(page.getByRole('heading', { name: 'เลือกงานที่จะตรวจ' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'เปิดกล้องสแกน' })).toBeDisabled();
    await page.getByRole('button', { name: /E2E ใบงานที่ 1/ }).click();
    await expect(page.getByText('กำลังตรวจ', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E ใบงานที่ 1').first()).toBeVisible();
    await expect(page.getByText('ตรวจแล้ว 0/3')).toBeVisible();

    // สแกนคนแรก (พิมพ์รหัสแทนกล้อง) → ได้คะแนนเต็มทันที
    const code = page.getByLabel('รหัสนักเรียน');
    await code.fill('S001');
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    const status = page.getByRole('status');
    await expect(status).toContainText('เด็กชายทดสอบ หนึ่ง');
    await expect(status).toContainText('10/10');
    await expect(page.getByText('ตรวจแล้ว 1/3')).toBeVisible();
    await expect(code).toHaveValue('');

    // สแกนต่อคนที่สอง (กด Enter) → ผลเปลี่ยนเป็นคนล่าสุด และประวัติรอบนี้มีสองคน
    await code.fill('S002');
    await code.press('Enter');
    await expect(status).toContainText('เด็กหญิงทดสอบ สอง');
    await expect(page.getByText('ตรวจแล้ว 2/3')).toBeVisible();
    const history = page.getByRole('region', { name: 'ตรวจแล้วรอบนี้' });
    await expect(history.getByRole('listitem')).toHaveCount(2);

    // ปุ่มคะแนน − / + : ลด 2 ครั้ง = 8 แล้วเพิ่ม 1 = 9 และส่งค่าสุดท้ายไป server
    await page.getByRole('button', { name: 'ลดคะแนน' }).click();
    await expect(status).toContainText('9/10');
    await page.getByRole('button', { name: 'ลดคะแนน' }).click();
    await expect(status).toContainText('8/10');
    await page.getByRole('button', { name: 'เพิ่มคะแนน' }).click();
    await expect(status).toContainText('9/10');
    await expect(history).toContainText('9/10');
    await expect.poll(() => calls.filter(c => c.m === 'POST' && c.body?.score === 9).length).toBeGreaterThan(0);
    // ปุ่มคะแนนลัด
    await page.getByRole('button', { name: 'ตั้งคะแนน 5' }).click();
    await expect(status).toContainText('5/10');
    await expect.poll(() => calls.filter(c => c.m === 'POST' && c.body?.score === 5).length).toBeGreaterThan(0);
    // เพดาน: ตั้ง 10 แล้วปุ่ม + ใช้ไม่ได้ · ตั้ง 0 แล้วปุ่ม − ใช้ไม่ได้
    await page.getByRole('button', { name: 'ตั้งคะแนน 10' }).click();
    await expect(page.getByRole('button', { name: 'เพิ่มคะแนน' })).toBeDisabled();
    await page.getByRole('button', { name: 'ตั้งคะแนน 0' }).click();
    await expect(page.getByRole('button', { name: 'ลดคะแนน' })).toBeDisabled();

    // สแกนคนเดิมซ้ำ → เตือนว่ามีคะแนนอยู่แล้ว ไม่ทับ
    await code.fill('S001');
    await code.press('Enter');
    await expect(status).toContainText('มีคะแนนอยู่แล้ว');

    // รหัสที่ไม่มี → ข้อความผิดพลาดภาษาไทย
    await code.fill('NOPE');
    await code.press('Enter');
    await expect(page.getByRole('alert')).toContainText('ไม่พบนักเรียนรหัสนี้');

    // ใบความคืบหน้า: เปิดรายชื่อ แท็บ ยังไม่ส่ง/ส่งแล้ว
    await page.getByRole('button', { name: 'ดูรายชื่อว่าใครส่ง/ไม่ส่ง' }).click();
    const sheet = page.getByRole('dialog', { name: 'รายชื่อของงานนี้' });
    await expect(sheet.getByText('ยังไม่ส่ง 1 คน')).toBeVisible();
    await expect(sheet.getByRole('tab', { name: /ยังไม่ส่ง/ })).toHaveAttribute('aria-selected', 'true');
    await expect(sheet.getByText('เด็กชายทดสอบ สาม')).toBeVisible();
    await sheet.getByRole('tab', { name: /^ทั้งหมด/ }).click();
    await expect(sheet.getByText('เด็กหญิงทดสอบ สอง')).toBeVisible();
    await expect(sheet.getByText('0/10').first()).toBeVisible();
    await sheet.getByRole('button', { name: 'ปิด' }).click();
    await expect(sheet).toBeHidden();

    // เปลี่ยนงาน → กลับไปหน้าเลือกงาน
    await page.getByRole('button', { name: 'เปลี่ยนงาน' }).click();
    await expect(page.getByRole('heading', { name: 'เลือกงานที่จะตรวจ' })).toBeVisible();

    expect(dialogs).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('งานที่เลือกไว้ถูกจำหลังรีโหลด', async ({ page }) => {
    await login(page, 'teacher');
    await mockApi(page, buildHandlers([]));
    await page.goto('/teacher/scan');
    await page.getByRole('button', { name: /E2E ใบงานที่ 1/ }).click();
    await expect(page.getByText('ตรวจแล้ว 0/3')).toBeVisible();
    await page.reload();
    await expect(page.getByText('กำลังตรวจ', { exact: true })).toBeVisible();
    await expect(page.getByText('ตรวจแล้ว 0/3')).toBeVisible();
  });

  test('เปิดกล้องไม่ได้ (headless) → ข้อความไทย และยังพิมพ์รหัสต่อได้', async ({ page }) => {
    await login(page, 'teacher');
    await mockApi(page, buildHandlers([]));
    await page.goto('/teacher/scan');
    await page.getByRole('button', { name: /E2E ใบงานที่ 1/ }).click();
    await page.getByRole('button', { name: 'เปิดกล้องสแกน' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('รหัสนักเรียน')).toBeEnabled();
  });
});
