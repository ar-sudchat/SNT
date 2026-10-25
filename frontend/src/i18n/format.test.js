import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider, useLang, t, tx, tMsg } from './index';

// พจนานุกรมจำลอง: ทดสอบกลไก (พหูพจน์ / ประโยคมีแท็ก / ข้อความ server) โดยไม่ผูกกับคำแปลจริง
jest.mock('./locales/en.json', () => ({
  'ลบ {n} คน': 'Delete {n} {n|student|students}',
  'ส่งครบ <b>{done}/{all}</b> คน': '<b>{done}/{all}</b> students done',
  'เลขที่ {no} {name} · ส่งแล้ว': '{name} (no. {no}) · submitted',
  'ไม่พบนักเรียนรหัส {studentCode}': 'No student with ID {studentCode}',
  'นำเข้าครู {success} คนสำเร็จ, ไม่สำเร็จ {failed} รายการ': 'Imported {success} {success|teacher|teachers}, {failed} failed',
  'มีอยู่แล้ว': 'Already exists',
}));
jest.mock('./locales/fr.json', () => ({ 'ลบ {n} คน': 'Supprimer {n} {n|élève|élèves}' }));

global.IS_REACT_ACT_ENVIRONMENT = true;

let setLangRef;
const Probe = () => { setLangRef = useLang().setLang; return null; };
const switchTo = async (id) => { await act(async () => { await setLangRef(id); }); };
const html = (nodes) => renderToStaticMarkup(<>{nodes}</>);

beforeAll(async () => {
  localStorage.clear();
  const el = document.createElement('div');
  await act(async () => { createRoot(el).render(<I18nProvider><Probe /></I18nProvider>); });
});

test('พหูพจน์: เลือกรูปตามจำนวนและกฎของภาษา', async () => {
  await switchTo('en');
  expect(t('ลบ {n} คน', { n: 1 })).toBe('Delete 1 student');
  expect(t('ลบ {n} คน', { n: 3 })).toBe('Delete 3 students');
  expect(t('ลบ {n} คน', { n: 0 })).toBe('Delete 0 students');
  await switchTo('fr');
  expect(t('ลบ {n} คน', { n: 0 })).toBe('Supprimer 0 élève'); // ฝรั่งเศส: 0 เป็นเอกพจน์
  expect(t('ลบ {n} คน', { n: 2 })).toBe('Supprimer 2 élèves');
});

test('tx: ย้ายแท็กและ element ได้ตามคำแปล · ภาษาไทยได้ประโยคเดิม', async () => {
  const b = (c) => <b>{c}</b>;
  await switchTo('en');
  expect(html(tx('ส่งครบ <b>{done}/{all}</b> คน', { done: 3, all: 5, b }))).toBe('<b>3/5</b> students done');
  expect(html(tx('เลขที่ {no} {name} · ส่งแล้ว', { no: 7, name: <i>Ann</i> }))).toBe('<i>Ann</i> (no. 7) · submitted');
  await switchTo('th');
  expect(html(tx('ส่งครบ <b>{done}/{all}</b> คน', { done: 3, all: 5, b }))).toBe('ส่งครบ <b>3/5</b> คน');
  expect(html(tx('ยังไม่ส่ง<br/>สมุด', { br: () => <br /> }))).toBe('ยังไม่ส่ง<br/>สมุด');
});

test('tMsg: ข้อความ server ที่แทรกค่า จับรูปแบบแล้วแปล · ไม่ตรงรูปแบบคืนเดิม', async () => {
  await switchTo('en');
  expect(tMsg('ไม่พบนักเรียนรหัส 12345')).toBe('No student with ID 12345');
  expect(tMsg('นำเข้าครู 1 คนสำเร็จ, ไม่สำเร็จ 0 รายการ')).toBe('Imported 1 teacher, 0 failed');
  expect(tMsg('มีอยู่แล้ว')).toBe('Already exists');
  expect(tMsg('ข้อความอื่นจาก server')).toBe('ข้อความอื่นจาก server');
  await switchTo('th');
  expect(tMsg('ไม่พบนักเรียนรหัส 12345')).toBe('ไม่พบนักเรียนรหัส 12345');
});
