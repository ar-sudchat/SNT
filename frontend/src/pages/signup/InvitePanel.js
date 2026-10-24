import React, { useState, useEffect, useCallback } from 'react';
import { inviteAPI, errMsg } from './client';
import { useDialog } from '../../components/ui/DialogProvider';
import { SmartComboBox } from '../../components/ui';

const ROLE = { TEACHER: 'ครู', ADMIN: 'ผู้ดูแล' };
const STATUS = { ok: ['รอตอบรับ', 'bg-amber-50 text-amber-700'], accepted: ['ตอบรับแล้ว', 'bg-green-50 text-green-700'], expired: ['หมดอายุ', 'bg-gray-100 text-gray-500'] };

// "เชิญครู" panel: create a link to copy into LINE (no email is sent).
const InvitePanel = () => {
  const dialog = useDialog();
  const [rows, setRows] = useState([]);
  const [role, setRole] = useState('TEACHER');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState(null); // newly created link
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    try { setRows((await inviteAPI.list()).data); setError(''); } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const copy = async (link) => {
    try { await navigator.clipboard.writeText(link); setCopied(link); setTimeout(() => setCopied(''), 2000); } catch (e) { dialog.copyText({ title: 'คัดลอกลิงก์นี้', message: 'เบราว์เซอร์คัดลอกให้อัตโนมัติไม่ได้ กดคัดลอกหรือเลือกข้อความด้านล่าง', text: link }); }
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { data } = await inviteAPI.create({ role, email: email.trim() || undefined });
      setFresh(data); setEmail(''); copy(data.link); load();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  const remove = async (id) => {
    try { await inviteAPI.remove(id); if (fresh?.id === id) setFresh(null); load(); } catch (err) { setError(errMsg(err)); }
  };

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5" aria-labelledby="invite-title">
      <h2 id="invite-title" className="text-lg font-bold text-gray-800">เชิญด้วยลิงก์</h2>
      <p className="mb-3 text-sm text-gray-500">สร้างลิงก์เชิญแล้วคัดลอกไปส่งทาง LINE · ลิงก์ใช้ได้ครั้งเดียว อายุ 7 วัน</p>
      <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
        <SmartComboBox
          options={[{ value: 'TEACHER', label: 'ครู' }, { value: 'ADMIN', label: 'ผู้ดูแลระบบ' }]}
          value={role}
          onChange={(v) => v && setRole(v)}
          searchable={false}
          clearable={false}
          ariaLabel="บทบาท"
          className="sm:w-44"
        />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมล (ไม่บังคับ)" className="min-h-[44px] flex-1 rounded-lg border border-gray-300 px-3" />
        <button disabled={busy} className="min-h-[44px] rounded-lg bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'กำลังสร้าง...' : 'สร้างลิงก์เชิญ'}</button>
      </form>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {fresh && (
        <div className="mt-3 rounded-lg bg-brand-50 p-3 text-sm">
          <p className="mb-1 font-semibold text-brand-700">{copied === fresh.link ? 'คัดลอกลิงก์แล้ว' : 'ลิงก์เชิญ'}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={fresh.link} onFocus={(e) => e.target.select()} className="min-h-[44px] flex-1 rounded-lg border border-gray-300 bg-white px-3" />
            <button onClick={() => copy(fresh.link)} className="min-h-[44px] rounded-lg border border-brand-600 px-4 text-brand-700">คัดลอก</button>
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="font-medium text-gray-800">{ROLE[r.role] || r.role}</span>
              <span className="min-w-0 flex-1 truncate text-gray-500">{r.email || 'ไม่ระบุอีเมล'}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
              {r.link && <button onClick={() => copy(r.link)} className="min-h-[44px] px-2 text-brand-700 underline">{copied === r.link ? 'คัดลอกแล้ว' : 'คัดลอก'}</button>}
              {r.status !== 'accepted' && <button onClick={() => remove(r.id)} className="min-h-[44px] px-2 text-red-600 underline">ยกเลิก</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default InvitePanel;
