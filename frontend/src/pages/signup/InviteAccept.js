import { t } from '../../i18n';
import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { inviteAPI, errMsg } from './client';
import AuthLayout, { Field, PasswordField, FormError, Spinner, primaryBtn, linkClass } from './AuthLayout';

const ROLE = { TEACHER: 'ครู', ADMIN: 'ผู้ดูแลระบบ' };
const STATUS_MSG = { accepted: 'คำเชิญนี้ถูกใช้แล้ว', expired: 'คำเชิญหมดอายุแล้ว กรุณาขอลิงก์ใหม่จากเจ้าของกลุ่ม' };

const InviteAccept = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    inviteAPI.preview(token).then((r) => setInfo(r.data)).catch((e) => setLoadError(errMsg(e, t('ไม่พบคำเชิญนี้'))));
  }, [token]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const accept = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const body = user ? {} : { name: form.name, email: info.email || form.email, password: form.password };
      const { data } = await inviteAPI.accept(token, body);
      localStorage.setItem('token', data.token);
      await checkAuth();
      navigate(data.role === 'ADMIN' ? '/admin' : '/teacher', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const usable = info && info.status === 'ok';
  const groupName = info && (info.groupName || info.schoolName || info.tenantName);

  return (
    <AuthLayout title={usable ? t('คุณได้รับเชิญเข้าร่วม') : t('คำเชิญเข้าร่วมกลุ่ม')}>
      {loadError && <FormError message={loadError} />}
      {!info && !loadError && <p className="flex items-center gap-2 text-gray-500" role="status"><Spinner />{t('กำลังโหลดคำเชิญ...')}</p>}
      {info && !usable && <FormError message={t(STATUS_MSG[info.status])} />}
      {usable && (
        <form onSubmit={accept} className="space-y-5">
          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3.5">
            <p className="font-display text-lg font-semibold leading-snug text-brand-800">{groupName}</p>
            <p className="mt-0.5 text-sm text-gray-600">{t('ในฐานะ')}{ROLE[info.role] ? t(ROLE[info.role]) : info.role}</p>
          </div>
          {user ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3 text-[15px] text-gray-700">{t('จะเข้าร่วมด้วยบัญชี ')}{user.email || t('ที่เข้าสู่ระบบอยู่')}</p>
          ) : (
            <>
              <Field id="invite-name" label={t("ชื่อ-นามสกุล")} value={form.name} onChange={set('name')} maxLength={80} autoComplete="name" />
              <Field id="invite-email" type="email" label={t("อีเมล")} value={info.email || form.email} onChange={set('email')} required readOnly={!!info.email}
                autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} />
              <PasswordField id="invite-password" label={t("รหัสผ่าน")} value={form.password} onChange={set('password')} required minLength={8}
                autoComplete="current-password" hint={t("ตั้งใหม่อย่างน้อย 8 ตัว หรือใช้รหัสเดิมถ้ามีบัญชีแล้ว")} />
            </>
          )}
          <FormError message={error} />
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy && <Spinner />}{busy ? t('กำลังเข้าร่วม...') : t('ตอบรับคำเชิญ')}
          </button>
        </form>
      )}
      <p className="mt-7 border-t border-gray-100 pt-6 text-center text-[15px] text-gray-600"><Link to="/login" className={linkClass}>{t('กลับหน้าเข้าสู่ระบบ')}</Link></p>
    </AuthLayout>
  );
};

export default InviteAccept;
