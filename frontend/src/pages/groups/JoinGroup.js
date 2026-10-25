import { t } from '../../i18n';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { groupsAPI, normalizeCode, errMsg } from '../signup/client';
import AuthLayout, { Field, FormError, Spinner, primaryBtn, secondaryBtn, linkClass } from '../signup/AuthLayout';

// /join and /join/:code — enter a join code (XXX-XXX) to join a group, then switch to it.
const JoinGroup = () => {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const { user, loading, loginWithToken, checkAuth } = useAuth();
  const [code, setCode] = useState(normalizeCode(urlCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const auto = useRef(false);

  const join = async (c) => {
    setBusy(true); setError('');
    try {
      const { data } = await groupsAPI.join(c);
      if (data.token) await loginWithToken(data.token); else await checkAuth();
      navigate('/', { replace: true });
    } catch (err) {
      setError(errMsg(err, t('ไม่พบกลุ่มที่ใช้รหัสนี้ ตรวจสอบรหัสอีกครั้ง')));
      setBusy(false);
    }
  };

  // Link with a full code and a signed-in user: join straight away.
  useEffect(() => {
    if (!loading && user && urlCode && /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(normalizeCode(urlCode)) && !auto.current) {
      auto.current = true;
      join(normalizeCode(urlCode));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, urlCode]);

  const submit = (e) => { e.preventDefault(); join(code); };
  const valid = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code);
  const needLogin = !loading && !user;

  return (
    <AuthLayout title={t("เข้าร่วมกลุ่ม")} subtitle={t("กรอกรหัส 6 หลักที่เจ้าของกลุ่มส่งให้ เช่น ABC-123")}>
      {needLogin ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3 text-[15px] text-gray-700">{t('เข้าสู่ระบบก่อน แล้วจะพากลับมาเข้าร่วมกลุ่มให้')}{code && valid ? <>{t(' (รหัส ')}<span className="font-semibold tracking-wider">{code}</span>)</> : ''}
          </p>
          <Link to="/login" state={{ from: `/join${valid ? `/${code}` : ''}` }} className={primaryBtn}>{t('เข้าสู่ระบบ')}</Link>
          <Link to="/signup" className={secondaryBtn}>{t('สมัครใช้ฟรี')}</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Field id="join-code" label={t("รหัสเข้าร่วมกลุ่ม")} value={code} onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="XXX-XXX" inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={7} required
            inputClassName="min-h-[56px] text-center text-2xl font-semibold uppercase tracking-[0.25em] placeholder:tracking-[0.25em]" />
          <FormError message={error} />
          <button type="submit" disabled={busy || !valid} className={primaryBtn}>
            {busy && <Spinner />}{busy ? t('กำลังเข้าร่วม...') : t('เข้าร่วมกลุ่ม')}
          </button>
        </form>
      )}
      <p className="mt-7 border-t border-gray-100 pt-6 text-center text-[15px] text-gray-600">
        <Link to={user ? '/' : '/login'} className={linkClass}>{user ? t('กลับหน้าหลัก') : t('กลับหน้าเข้าสู่ระบบ')}</Link>
      </p>
    </AuthLayout>
  );
};

export default JoinGroup;
