// Outbox สำหรับบันทึกผลการส่งงานตอนเน็ตหลุด (ไม่ใช้ service worker)
// เก็บคิวใน IndexedDB (สำรองด้วย localStorage) — key = studentId:taskId เก็บเฉพาะค่าล่าสุด
// backend createOrUpdate เป็น upsert ตาม (studentId, taskId) จึงส่งซ้ำได้อย่างปลอดภัย
import { submissionAPI } from '../../../services/api';

const DB_NAME = 'snt-offline';
const STORE = 'outbox';
const LS_KEY = 'snt_outbox_v1';

const pairKey = (p) => `${p.studentId}:${p.taskId}`;
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let dbPromise = null;
const openDb = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (!window.indexedDB) return resolve(null);
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
};

const idbTx = async (mode, fn) => {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const out = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(out && 'result' in out ? out.result : true);
      tx.onerror = () => resolve(undefined);
      tx.onabort = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
};

const lsRead = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
};
const lsWrite = (items) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch { /* ignore */ }
};

export const listQueued = async () => {
  const fromIdb = await idbTx('readonly', (s) => s.getAll());
  const items = Array.isArray(fromIdb) ? fromIdb : [];
  // รวมของที่อาจตกไปอยู่ localStorage (กรณี IDB ใช้ไม่ได้ชั่วคราว)
  const map = new Map(items.map((i) => [i.key, i]));
  lsRead().forEach((i) => {
    const cur = map.get(i.key);
    if (!cur || cur.queuedAt < i.queuedAt) map.set(i.key, i);
  });
  return [...map.values()].sort((a, b) => a.queuedAt - b.queuedAt);
};

const putItem = async (item) => {
  const ok = await idbTx('readwrite', (s) => s.put(item));
  const ls = lsRead().filter((i) => i.key !== item.key);
  if (!ok) ls.push(item);
  lsWrite(ls);
};

const removeItem = async (key, clientId) => {
  const all = await listQueued();
  const cur = all.find((i) => i.key === key);
  // ถ้ามีค่าที่ใหม่กว่าเข้าคิวระหว่างส่ง อย่าลบทิ้ง
  if (clientId && cur && cur.clientId !== clientId) return;
  await idbTx('readwrite', (s) => s.delete(key));
  lsWrite(lsRead().filter((i) => i.key !== key));
};

const listeners = new Set();
const notify = () => listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// network error = ไม่มี response จาก server หรือเครื่องออฟไลน์
export const isNetworkError = (err) =>
  !err?.response || (typeof navigator !== 'undefined' && navigator.onLine === false);

const enqueue = async (payload) => {
  const item = { key: pairKey(payload), clientId: newId(), queuedAt: Date.now(), payload };
  await putItem(item);
  notify();
  return item;
};

// บันทึกผล: คืน 'sent' หรือ 'queued' — error จาก server (4xx/5xx) โยนต่อให้ผู้เรียกแสดง
export const saveSubmission = async (payload) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await enqueue(payload);
    return 'queued';
  }
  try {
    await submissionAPI.createOrUpdate(payload);
    // ค่าที่ส่งสำเร็จใหม่กว่าของในคิว → ล้างคิวคู่นี้ ไม่ให้ flush ทับ
    const key = pairKey(payload);
    if ((await listQueued()).some((i) => i.key === key)) {
      await removeItem(key);
      notify();
    }
    return 'sent';
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueue(payload);
      return 'queued';
    }
    throw err;
  }
};

let flushing = null;
// ส่งของในคิวทีละรายการ — หยุดเมื่อเน็ตยังหลุด, ทิ้งรายการที่ server ปฏิเสธ (คืนไว้ใน rejected)
export const flushOutbox = () => {
  if (flushing) return flushing;
  flushing = (async () => {
    const result = { sent: 0, rejected: [], stillOffline: false };
    try {
      const items = await listQueued();
      for (const item of items) {
        try {
          await submissionAPI.createOrUpdate(item.payload);
          await removeItem(item.key, item.clientId);
          result.sent += 1;
        } catch (err) {
          if (isNetworkError(err)) { result.stillOffline = true; break; }
          await removeItem(item.key, item.clientId);
          result.rejected.push({ item, error: err.response?.data?.error || 'บันทึกไม่สำเร็จ' });
        }
      }
    } finally {
      flushing = null;
      notify();
    }
    return result;
  })();
  return flushing;
};
