import { t } from '../i18n';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { tenantAPI, groupAPI } from '../services/api';
import api from '../services/api';
import { useDialog } from './ui/DialogProvider';

// Read `tid` from the stored JWT (display only; the server decides real access).
const currentTid = () => {
  try {
    const t = localStorage.getItem('token');
    const b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b)).tid || null;
  } catch { return null; }
};

// Accept both flat ({tenantId, tenantName}) and nested ({tenant:{id,name}}) membership shapes.
const norm = (m) => ({
  id: m.tenantId || m.tenant?.id || m.id,
  name: m.tenantName || m.tenant?.name || m.name || t('กลุ่ม'),
  role: m.role
});

// Store a new group token (same storage as AuthContext) and reload into that group.
const applyToken = (token) => {
  if (!token) throw new Error('no token');
  localStorage.setItem('token', token);
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  window.location.assign('/');
};

const TenantSwitcher = () => {
  const dialog = useDialog();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef(null);
  const tid = currentTid();

  useEffect(() => {
    let alive = true;
    tenantAPI.memberships()
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.memberships || []);
        if (alive) setItems(list.map(norm));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const switchTo = useCallback(async (id) => {
    setBusy(true); setErr('');
    try {
      const r = await tenantAPI.switchTenant(id);
      applyToken(r.data?.token);
    } catch (e) {
      setErr(e.response?.data?.error || t('สลับกลุ่มไม่สำเร็จ'));
      setBusy(false);
    }
  }, []);

  const current = items.find(i => i.id === tid) || items[0] || { name: t('กลุ่ม') };

  const createGroup = async () => {
    const missingName = t('กรุณากรอกชื่อกลุ่ม');
    const longName = t('ชื่อกลุ่มยาวเกิน 120 ตัวอักษร');
    setOpen(false);
    const raw = await dialog.prompt({
      title: t('สร้างกลุ่มใหม่'),
      label: t('ชื่อกลุ่ม'),
      placeholder: t('ครูวิทย์ ม.ต้น'),
      confirmText: t('สร้างกลุ่ม'),
      validate: (v) => {
        const t = (v || '').trim();
        if (!t) return missingName;
        if (t.length > 120) return longName;
        return '';
      },
    });
    const name = (raw || '').trim();
    if (!name) return;
    setBusy(true); setErr('');
    try {
      const r = await groupAPI.create(name);
      applyToken(r.data?.token);
    } catch (e) {
      setErr(e.response?.data?.error || t('สร้างกลุ่มไม่สำเร็จ'));
      setBusy(false);
    }
  };

  const itemCls = 'flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50 disabled:cursor-default';

  return (
    <div ref={box} className="relative min-w-0">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        title={t("สลับกลุ่ม")}
        className="flex min-h-[44px] min-w-0 max-w-[9rem] items-center gap-1 rounded-lg bg-brand-50 px-2.5 text-sm text-brand-800 ring-1 ring-brand-100 hover:bg-brand-100 sm:max-w-[14rem]">
        <span className="truncate font-medium">{current.name}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true"><path d="M5 7l5 6 5-6H5z" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 max-h-80 w-64 max-w-[calc(100vw-1.5rem)] overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-ink-200">
          <p className="px-3 pt-1 text-xs text-gray-500">{t("กลุ่มของฉัน")}</p>
          <ul role="listbox">
            {items.map(i => (
              <li key={i.id} role="option" aria-selected={i.id === current.id}>
                <button type="button" disabled={busy || i.id === current.id} onClick={() => switchTo(i.id)}
                  className={`${itemCls} ${i.id === current.id ? 'font-semibold text-brand-700' : 'text-gray-700'}`}>
                  <span className="truncate">{i.name}</span>
                  {i.id === current.id && <span aria-hidden="true">✓</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-gray-100 pt-1">
            <Link to="/group" onClick={() => setOpen(false)} className={`${itemCls} text-gray-700`}>{t("ตั้งค่ากลุ่ม / รหัสเชิญ")}</Link>
            <button type="button" disabled={busy} onClick={createGroup} className={`${itemCls} text-brand-700`}>{t("+ สร้างกลุ่มใหม่")}</button>
            <Link to="/join" onClick={() => setOpen(false)} className={`${itemCls} text-brand-700`}>{t("เข้าร่วมกลุ่มด้วยรหัส")}</Link>
          </div>
          {err && <p className="px-3 py-2 text-xs text-red-700" role="alert">{err}</p>}
        </div>
      )}
    </div>
  );
};

export default TenantSwitcher;
