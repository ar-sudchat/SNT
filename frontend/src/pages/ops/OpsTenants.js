import { t, dateLocale } from '../../i18n';
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useDialog } from '../../components/ui/DialogProvider';

// หน้าผู้ดูแลแพลตฟอร์ม — backend ตรวจสิทธิ์จาก PLATFORM_ADMIN_EMAILS (หน้านี้แค่แสดงผลตามที่ API อนุญาต)
// TODO: บังคับ 2FA (TOTP) ก่อนใช้งานจริง
const fmt = (d) => new Date(d).toLocaleDateString(dateLocale(), { year: 'numeric', month: 'short', day: 'numeric' });

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
      setError(e.response?.status === 403 ? t('บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลแพลตฟอร์ม') : (e.response?.data?.error || t('โหลดข้อมูลไม่สำเร็จ')));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (row) => {
    const next = row.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    if (next === 'SUSPENDED') {
      const okSuspend = await dialog.confirm({
        title: t('ระงับกลุ่มนี้?'),
        message: t('ระงับกลุ่ม "{name}" ? สมาชิกทั้งกลุ่มจะใช้งานไม่ได้', { name: row.name }),
        confirmText: t('ระงับกลุ่ม'),
        type: 'danger',
      });
      if (!okSuspend) return;
    }
    setBusy(row.id);
    try { await api.post(`/ops/tenants/${row.id}/status`, { status: next }); await load(); }
    catch (e) { setError(e.response?.data?.error || t('เปลี่ยนสถานะไม่สำเร็จ')); }
    finally { setBusy(''); }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-title">{t('ผู้ดูแลแพลตฟอร์ม · กลุ่มทั้งหมด')}</h1>
      {error && <p role="alert" className="mt-4 rounded-xl bg-fail/10 px-4 py-3 text-fail">{error}</p>}
      {rows === null ? <p className="mt-4 text-ink/60">{t('กำลังโหลด…')}</p> : (rows.length === 0 && error) ? null : (
        <div className="mt-4 overflow-x-auto rounded-2xl bg-card ring-1 ring-ink/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-th text-th-fg">
              <tr>{['กลุ่ม', 'รหัสอ้างอิง', 'แพ็กเกจ', 'สถานะ', 'นักเรียน', 'ครู', 'สร้างเมื่อ', ''].map(h => <th key={h} className="px-4 py-3 font-semibold">{t(h)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-t border-ink/10">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-ink/70">{row.slug}</td>
                  <td className="px-4 py-3">{row.plan}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${row.status === 'ACTIVE' ? 'bg-pass/15 text-pass' : 'bg-fail/15 text-fail'}`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.students}</td>
                  <td className="px-4 py-3 tabular-nums">{row.teachers}</td>
                  <td className="px-4 py-3 text-ink/70">{fmt(row.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {row.status !== 'PENDING_DELETE' && (
                      <button type="button" disabled={busy === row.id} onClick={() => toggle(row)}
                        className="min-h-[40px] rounded-lg px-3 font-medium ring-1 ring-ink/20 hover:bg-page disabled:opacity-50">
                        {row.status === 'SUSPENDED' ? t('เปิดใช้งาน') : t('ระงับ')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !error && <tr><td colSpan="8" className="px-4 py-8 text-center text-ink/60">{t('ยังไม่มีกลุ่ม')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
