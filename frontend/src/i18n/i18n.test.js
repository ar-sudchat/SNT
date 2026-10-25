import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, useLang, t, tc, tMsg, getLang, dateLocale } from './index';
import en from './locales/en.json';
import ja from './locales/ja.json';

global.IS_REACT_ACT_ENVIRONMENT = true; // ให้ act() ของ React 18 ทำงานใน jest

// ตัวช่วย: เปิด provider แล้วสั่งเปลี่ยนภาษา
let setLangRef;
const Probe = () => { setLangRef = useLang().setLang; return null; };
const mount = async () => {
  const el = document.createElement('div');
  await act(async () => { createRoot(el).render(<I18nProvider><Probe /></I18nProvider>); });
};
const switchTo = async (id) => { await act(async () => { await setLangRef(id); }); };

beforeAll(async () => { localStorage.clear(); await mount(); });

test('ภาษาไทย: คืนต้นฉบับ แทนค่าตัวแปร', async () => {
  await switchTo('th');
  expect(getLang()).toBe('th');
  expect(t('บันทึกแล้ว')).toBe('บันทึกแล้ว');
  expect(t('สร้างแล้ว {n} ห้อง', { n: 3 })).toBe('สร้างแล้ว 3 ห้อง');
  expect(dateLocale()).toBe('th-TH');
});

test('อังกฤษ: แปล · ไม่มีคำแปลคืนไทย · ค่าไม่ใช่ข้อความคืนเดิม', async () => {
  await switchTo('en');
  expect(document.documentElement.lang).toBe('en');
  expect(t('บันทึกแล้ว')).toBe(en['บันทึกแล้ว']);
  expect(t('ข้อความที่ไม่มีในพจนานุกรม')).toBe('ข้อความที่ไม่มีในพจนานุกรม');
  expect(t(undefined)).toBe(undefined);
  expect(dateLocale()).toBe('en-GB');
});

test('ช่องว่างหัวท้ายของต้นฉบับ: หาคำแปลเจอ และคืนช่องว่างให้ (ยกเว้นจีน/ญี่ปุ่น)', async () => {
  await switchTo('en');
  expect(t(' บันทึกแล้ว ')).toBe(` ${en['บันทึกแล้ว']} `);
  await switchTo('ja');
  expect(t(' บันทึกแล้ว ')).toBe(ja['บันทึกแล้ว']);
});

test('tc: ใช้คำแปลตามบริบท ถ้าไม่มีใช้คำแปลปกติ', async () => {
  await switchTo('en');
  expect(tc('unit', 'คะแนน')).toBe(en['unit::คะแนน']);
  expect(tc('ไม่มีบริบทนี้', 'บันทึกแล้ว')).toBe(en['บันทึกแล้ว']);
});

test('โหมดตรวจ qa: ครอบ ⟦ ⟧ · ภาษาไม่รู้จักกลับเป็นไทย', async () => {
  await switchTo('qa');
  expect(t('บันทึกแล้ว')).toBe('⟦บันทึกแล้ว⟧');
  await switchTo('xx');
  expect(getLang()).toBe('th');
});

test('พจนานุกรมทุกภาษา: ตัวแปร {..} ตรงกับต้นฉบับ · พหูพจน์ {n|..|..} อ้างตัวแปรที่มีจริง', () => {
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  const pluralOk = (k, v) => [...v.matchAll(/\{(\w+)\|/g)].every((m) => k.includes(`{${m[1]}}`));
  for (const lang of ['en', 'zh', 'ja', 'ko', 'fr', 'de']) {
    const d = require(`./locales/${lang}.json`);
    const bad = Object.entries(d).filter(([k, v]) => !k.includes('::') && (vars(k) !== vars(v) || !pluralOk(k, v))).map(([k]) => k);
    expect({ lang, bad }).toEqual({ lang, bad: [] });
  }
});

test('ข้อความจริงจาก backend: แปลด้วยพจนานุกรมจริง (รูปแบบ + พหูพจน์)', async () => {
  await switchTo('en');
  const samples = [
    'ไม่พบนักเรียนรหัส 671199',
    'นำเข้านักเรียน 1 คนสำเร็จ, ไม่สำเร็จ 0 รายการ',
    'ไม่พบห้องเรียน "ป.4/9" กรุณาสร้างห้องเรียนก่อน',
    'ใช้ผู้ช่วย AI บ่อยเกินไป กรุณารอประมาณ 1 นาทีแล้วลองใหม่',
    'มีอยู่แล้ว',
    'ส่งแล้ว รอตรวจ',
  ];
  // ค่าในเครื่องหมายคำพูด (ชื่อห้อง) เป็นข้อมูลไทยได้ · ส่วนอื่นต้องไม่เหลือภาษาไทย
  for (const m of samples) expect({ m, out: tMsg(m).replace(/["“”][^"“”]*["“”]/g, '') }).not.toEqual(expect.objectContaining({ out: expect.stringMatching(/[\u0E00-\u0E7F]/) }));
  expect(tMsg('ไม่พบนักเรียนรหัส 671199')).toContain('671199');
  expect(tMsg('ไม่พบห้องเรียน "ป.4/9" กรุณาสร้างห้องเรียนก่อน')).toContain('ป.4/9');
  expect(tMsg('นำเข้านักเรียน 1 คนสำเร็จ, ไม่สำเร็จ 0 รายการ')).not.toMatch(/1 students/);
});
