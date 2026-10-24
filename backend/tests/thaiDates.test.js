// วันที่สอน: แปลงข้อความไทย -> วันจริง และตรวจวันจริงที่หน้าจอส่งมา (ไม่แตะฐานข้อมูล)
const test = require('node:test');
const assert = require('node:assert');
const { parseThaiDates, cleanDates, formatThaiDates, dateFields } = require('../services/thaiDates');

test('parseThaiDates: รูปแบบที่ครูเขียน', () => {
  assert.deepStrictEqual(parseThaiDates('3, 9, 10 มิ.ย. 69'), ['2026-06-03', '2026-06-09', '2026-06-10']);
  assert.deepStrictEqual(parseThaiDates('19-20 พ.ค. 69'), ['2026-05-19', '2026-05-20']);
  assert.deepStrictEqual(parseThaiDates('30 พ.ค. - 2 มิ.ย. 69'), ['2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02']);
  assert.deepStrictEqual(parseThaiDates('28, 30 พ.ค. และ 3 มิ.ย. 69'), ['2026-05-28', '2026-05-30', '2026-06-03']);
  assert.deepStrictEqual(parseThaiDates('30 ธ.ค. - 2 ม.ค. 69'), ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'], 'ข้ามปี');
  assert.deepStrictEqual(parseThaiDates('5 มิถุนายน 2569'), ['2026-06-05'], 'ชื่อเดือนเต็ม + ปี 4 หลัก');
  assert.deepStrictEqual(parseThaiDates('5 มิ.ย.', 2025), ['2025-06-05'], 'ไม่มีปี ใช้ปีที่ให้มา');
  assert.deepStrictEqual(parseThaiDates('31 ก.พ. 69'), [], 'วันไม่มีจริง');
  assert.deepStrictEqual(parseThaiDates(''), []);
  assert.deepStrictEqual(parseThaiDates('สัปดาห์ที่ 3'), []);
  assert.ok(parseThaiDates('1 ม.ค. - 31 ธ.ค. 69').length <= 62, 'จำกัดจำนวนวัน');
});

test('cleanDates: รับเฉพาะ YYYY-MM-DD ที่มีจริง', () => {
  assert.deepStrictEqual(cleanDates(['2026-06-10', '2026-06-03', '2026-06-10']), ['2026-06-03', '2026-06-10']);
  assert.deepStrictEqual(cleanDates([]), []);
  for (const bad of [null, 'x', ['2026-02-30'], ['2026-6-3'], [20260603], Array(63).fill('2026-06-03')]) {
    assert.strictEqual(cleanDates(bad), null, JSON.stringify(bad).slice(0, 40));
  }
});

test('formatThaiDates + dateFields', () => {
  assert.strictEqual(formatThaiDates(['2026-05-28', '2026-05-30', '2026-06-03']), '28, 30 พ.ค. และ 3 มิ.ย. 69');
  assert.strictEqual(formatThaiDates(['2025-12-31', '2026-01-02']), '31 ธ.ค. 68 และ 2 ม.ค. 69');
  const f = dateFields(['2026-06-03', '2026-06-10'], 'ignored');
  assert.strictEqual(f.dateFrom.toISOString().slice(0, 10), '2026-06-03');
  assert.strictEqual(f.dateTo.toISOString().slice(0, 10), '2026-06-10');
  assert.strictEqual(f.teachDates.length, 2);
  const empty = dateFields(null, '');
  assert.deepStrictEqual(empty.teachDates, []); assert.strictEqual(empty.dateFrom, null); assert.ok(!('assessedOn' in empty));
});
