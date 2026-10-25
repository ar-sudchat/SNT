import { t } from '../../i18n';
import React, { useState, useEffect, useCallback } from 'react';
import api, { groupAPI, tenantAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../../components/ui';
import PageHeader from '../../components/ui/PageHeader';
import { useDialog } from '../../components/ui/DialogProvider';
import InvitePanel from '../signup/InvitePanel';

const ROLE = { ADMIN: 'ผู้ดูแล', OWNER: 'เจ้าของ', TEACHER: 'ครู', STUDENT: 'นักเรียน' };
const errOf = (e, d) => e?.response?.data?.error || d;

const currentTid = () => {
  try {
    const b = localStorage.getItem('token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b)).tid || null;
  } catch { return null; }
};

const GroupSettings = () => {
  const dialog = useDialog();
  const { user } = useAuth();
  const [id, setId] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // {kind:'rotate'|'remove', member?}

  const isAdmin = group?.role === 'ADMIN' || group?.role === 'OWNER' || user?.role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      let gid = currentTid();
      if (!gid) {
        const r = await tenantAPI.memberships();
        gid = r.data?.current?.tenantId || r.data?.current?.id || r.data?.current;
      }
      if (!gid) throw new Error('no group');
      setId(gid);
      const [g, m] = await Promise.all([groupAPI.get(gid), groupAPI.members(gid)]);
      setGroup(g.data); setName(g.data.name || '');
      setMembers(Array.isArray(m.data) ? m.data : (m.data?.members || []));
      setError('');
    } catch (e) { setError(errOf(e, t('โหลดข้อมูลกลุ่มไม่สำเร็จ'))); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2500); };
  const copy = async (text, ok) => {
    try { await navigator.clipboard.writeText(text); flash(ok); } catch { dialog.copyText({ title: t('คัดลอกข้อความนี้'), message: t('เบราว์เซอร์คัดลอกให้อัตโนมัติไม่ได้ กดคัดลอกหรือเลือกข้อความด้านล่าง'), text }); }
  };
  const inviteText = group ? t('ชวนเข้ากลุ่ม "{name}" ใน KruScan\nรหัสเข้ากลุ่ม: {joinCode}\nเข้าที่ {origin}/join แล้วกรอกรหัสนี้', { name: group.name, joinCode: group.joinCode, origin: window.location.origin }) : '';

  const rename = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === group.name) return;
    setBusy(true);
    try { await groupAPI.rename(id, name.trim()); flash(t('เปลี่ยนชื่อกลุ่มแล้ว')); await load(); }
    catch (err) { setError(errOf(err, t('เปลี่ยนชื่อไม่สำเร็จ'))); } finally { setBusy(false); }
  };

  const doConfirm = async () => {
    const c = confirm; setConfirm(null); setBusy(true);
    try {
      if (c.kind === 'rotate') { await groupAPI.rotateCode(id); flash(t('เปลี่ยนรหัสใหม่แล้ว')); await load(); }
      else {
        if (c.self) {
          // Leaving the current group invalidates this token, so take a token for another group first.
          const r = await tenantAPI.memberships();
          const next = (r.data?.memberships || []).find(m => m.tenantId !== id);
          const s = next ? await tenantAPI.switchTenant(next.tenantId) : null;
          const token = s?.data?.token;
          if (token) { localStorage.setItem('token', token); api.defaults.headers.common['Authorization'] = `Bearer ${token}`; }
          await groupAPI.removeMember(id, c.member.userId || c.member.id);
          if (!token) localStorage.removeItem('token');
          window.location.assign(token ? '/' : '/login');
          return;
        }
        await groupAPI.removeMember(id, c.member.userId || c.member.id);
        flash(c.self ? t('ออกจากกลุ่มแล้ว') : t('นำออกจากกลุ่มแล้ว')); await load();
      }
    } catch (err) { setError(errOf(err, t('ทำรายการไม่สำเร็จ'))); } finally { setBusy(false); }
  };

  const card = 'rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5';
  const btn = 'min-h-[44px] rounded-lg px-4 font-semibold';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t("ตั้งค่ากลุ่ม")} subtitle={t("รหัสเชิญ สมาชิก และชื่อกลุ่ม")} />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {msg && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{msg}</p>}

      {group && (
        <>
          <section className={card} aria-labelledby="g-code">
            <h2 id="g-code" className="text-lg font-bold text-gray-800">{t('รหัสเข้ากลุ่ม')}</h2>
            <p className="mb-3 text-sm text-gray-500">{t('ส่งรหัสนี้ให้คนที่ต้องการเข้ากลุ่ม · เขากรอกที่หน้า "เข้าร่วมกลุ่มด้วยรหัส"')}</p>
            <p className="select-all rounded-xl bg-brand-50 py-4 text-center font-mono text-4xl font-bold tracking-widest text-brand-800 sm:text-5xl" aria-label={t('รหัสกลุ่ม {joinCode}', { joinCode: group.joinCode })}>{group.joinCode}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button onClick={() => copy(group.joinCode, t('คัดลอกรหัสแล้ว'))} className={`${btn} border border-brand-600 text-brand-700`}>{t('คัดลอกรหัส')}</button>
              <button onClick={() => copy(inviteText, t('คัดลอกข้อความเชิญแล้ว วางในไลน์ได้เลย'))} className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}>{t('คัดลอกข้อความเชิญไปวางในไลน์')}</button>
              {isAdmin && <button disabled={busy} onClick={() => setConfirm({ kind: 'rotate' })} className={`${btn} border border-gray-300 text-gray-700 sm:ml-auto`}>{t('เปลี่ยนรหัสใหม่')}</button>}
            </div>
          </section>

          {isAdmin && (
            <section className={card} aria-labelledby="g-name">
              <h2 id="g-name" className="mb-2 text-lg font-bold text-gray-800">{t('ชื่อกลุ่ม')}</h2>
              <form onSubmit={rename} className="flex flex-col gap-2 sm:flex-row">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className="min-h-[44px] flex-1 rounded-lg border border-gray-300 px-3" aria-label={t("ชื่อกลุ่ม")} />
                <button disabled={busy} className={`${btn} bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50`}>{t('บันทึก')}</button>
              </form>
            </section>
          )}

          <section className={card} aria-labelledby="g-members">
            <h2 id="g-members" className="mb-2 text-lg font-bold text-gray-800">{t('สมาชิก ({length})', { length: members.length })}</h2>
            <ul className="divide-y divide-gray-100">
              {members.map((m) => {
                const uid = m.userId || m.id;
                const self = uid === user?.id;
                return (
                  <li key={uid} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{m.name || m.displayName || m.email}{self && t(' (ฉัน)')}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{ROLE[m.role] ? t(ROLE[m.role]) : m.role}</span>
                    {(isAdmin || self) && (
                      <button onClick={() => setConfirm({ kind: 'remove', member: m, self })} className="min-h-[44px] px-2 text-red-600 underline">{self ? t('ออกจากกลุ่ม') : t('นำออก')}</button>
                    )}
                  </li>
                );
              })}
              {members.length === 0 && <li className="py-3 text-sm text-gray-500">{t('ยังไม่มีสมาชิก')}</li>}
            </ul>
          </section>

          {isAdmin && <InvitePanel />}
        </>
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        type={confirm?.kind === 'rotate' ? 'warning' : 'danger'}
        title={confirm?.kind === 'rotate' ? t('เปลี่ยนรหัสใหม่?') : confirm?.self ? t('ออกจากกลุ่ม?') : t('นำสมาชิกออก?')}
        message={confirm?.kind === 'rotate' ? t('รหัสเดิมจะใช้ไม่ได้อีก คนที่อยู่ในกลุ่มแล้วไม่ได้รับผลกระทบ') : confirm?.self ? t('คุณจะเข้ากลุ่มนี้ไม่ได้จนกว่าจะมีรหัสใหม่') : t('นำ {value1} ออกจากกลุ่ม?', { value1: confirm?.member?.name || 'สมาชิก' })}
        confirmText={confirm?.kind === 'rotate' ? t('เปลี่ยนรหัส') : t('ยืนยัน')}
      />
    </div>
  );
};

export default GroupSettings;
