import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useDialog } from '../../components/ui/DialogProvider';

// หน้าผู้ดูแลแพลตฟอร์ม — backend ตรวจสิทธิ์จาก PLATFORM_ADMIN_EMAILS (หน้านี้แค่แสดงผลตามที่ API อนุญาต)
// TODO: บังคับ 2FA (TOTP) ก่อนใช้งานจริง
const fmt = (d) => new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

export default function OpsTenants() {
  const dialog = useDialog();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/ops/tenants');
      setRows(data.tenants); setError('');
    } catch (e) {
      setRows([]);
      setError(e.response?.status === 403 ? 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลแพลตฟอร์ม' : (e.response?.data?.error || 'โหลดข้อมูลไม่สำเร็จ'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (t) => {
    const next = t.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    if (next === 'SUSPENDED') {
      const okSuspend = await dialog.confirm({
        title: 'ระงับกลุ่มนี้?',
        message: `ระงับกลุ่ม "${t.name}" ? สมาชิกทั้งกลุ่มจะใช้งานไม่ได้`,
        confirmText: 'ระงับกลุ่ม',
        type: 'danger',
      });
      if (!okSuspend) return;
    }
    setBusy(t.id);
    try { await api.post(`/ops/tenants/${t.id}/status`, { status: next }); await load(); }
    catch (e) { setError(e.response?.data?.error || 'เปลี่ยนสถานะไม่สำเร็จ'); }
    finally { setBusy(''); }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-title">ผู้ดูแลแพลตฟอร์ม · กลุ่มทั้งหมด</h1>
      {error && <p role="alert" className="mt-4 rounded-xl bg-fail/10 px-4 py-3 text-fail">{error}</p>}
      {rows === null ? <p className="mt-4 text-ink/60">กำลังโหลด…</p> : (rows.length === 0 && error) ? null : (
        <div className="mt-4 overflow-x-auto rounded-2xl bg-card ring-1 ring-ink/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-th text-th-fg">
              <tr>{['กลุ่ม', 'รหัสอ้างอิง', 'แพ็กเกจ', 'สถานะ', 'นักเรียน', 'ครู', 'สร้างเมื่อ', ''].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.id} className="border-t border-ink/10">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-ink/70">{t.slug}</td>
                  <td className="px-4 py-3">{t.plan}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${t.status === 'ACTIVE' ? 'bg-pass/15 text-pass' : 'bg-fail/15 text-fail'}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{t.students}</td>
                  <td className="px-4 py-3 tabular-nums">{t.teachers}</td>
                  <td className="px-4 py-3 text-ink/70">{fmt(t.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {t.status !== 'PENDING_DELETE' && (
                      <button type="button" disabled={busy === t.id} onClick={() => toggle(t)}
                        className="min-h-[40px] rounded-lg px-3 font-medium ring-1 ring-ink/20 hover:bg-page disabled:opacity-50">
                        {t.status === 'SUSPENDED' ? 'เปิดใช้งาน' : 'ระงับ'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !error && <tr><td colSpan="8" className="px-4 py-8 text-center text-ink/60">ยังไม่มีกลุ่ม</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
