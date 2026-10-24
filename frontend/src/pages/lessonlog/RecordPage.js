import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { assessmentAPI } from '../../services/api';
import { useDialog } from '../../components/ui/DialogProvider';
import { Icon } from '../../components/navConfig';
import NoteEditor from '../../components/lessonlog/NoteEditor';
import RubricEditor from '../../components/lessonlog/RubricEditor';
import ClassAnswersEditor from '../../components/lessonlog/ClassAnswersEditor';
import { STATUS_LABEL, SCOPE_LABEL, scopeOf } from './lessonLogCore';

const BACK = 'M15 19l-7-7 7-7';

const BackLink = () => (
  <Link to="/lesson-log" className="inline-flex min-h-[44px] items-center gap-1 text-sm text-brand-700 hover:text-brand-900">
    <Icon d={BACK} className="h-4 w-4" /> บันทึกหลังแผน
  </Link>
);

const RecordPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dialog = useDialog();

  const [detail, setDetail] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setError('');
    assessmentAPI.record(id)
      .then(res => { if (!cancelled) setDetail(res.data); })
      .catch(e => {
        if (cancelled) return;
        if (e.response?.status === 404) setNotFound(true);
        else setError(e.response?.data?.error || 'โหลดบันทึกไม่สำเร็จ');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Doc settings feed the paper preview in NoteEditor; the page still works without them.
  useEffect(() => {
    let cancelled = false;
    assessmentAPI.settings()
      .then(res => { if (!cancelled) setSettings(res.data); })
      .catch(() => { /* preview falls back to its defaults */ });
    return () => { cancelled = true; };
  }, []);

  const rename = async () => {
    const name = await dialog.prompt({
      title: 'แก้ชื่อบันทึก',
      label: 'ชื่อบันทึก',
      defaultValue: detail.name,
      confirmText: 'ต่อไป',
      validate: (v) => (v && v.trim() ? '' : 'ใส่ชื่อบันทึก')
    });
    if (name === null) return;
    const dateText = await dialog.prompt({
      title: 'แก้วันที่',
      label: 'วันที่ (เช่น 24 มิ.ย. 69)',
      defaultValue: detail.dateText || '',
      confirmText: 'บันทึก'
    });
    if (dateText === null) return;
    setBusy(true);
    try {
      const res = await assessmentAPI.updateRecord(detail.id, { name: name.trim(), dateText: dateText.trim() });
      setDetail(res.data);
    } catch (e) {
      await dialog.alert({ title: 'แก้ไขไม่สำเร็จ', message: e.response?.data?.error || 'ลองใหม่อีกครั้ง', type: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await dialog.confirm({
      title: 'ลบบันทึกนี้?',
      message: `"${detail.name}" และคะแนนที่กรอกไว้จะถูกลบ กู้คืนไม่ได้`,
      type: 'danger',
      confirmText: 'ลบบันทึก'
    });
    if (!ok) return;
    setBusy(true);
    try {
      await assessmentAPI.deleteRecord(detail.id);
      navigate('/lesson-log');
    } catch (e) {
      setBusy(false);
      await dialog.alert({ title: 'ลบไม่สำเร็จ', message: e.response?.data?.error || 'ลองใหม่อีกครั้ง', type: 'danger' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand-600" role="status" aria-label="กำลังโหลด" />
      </div>
    );
  }

  if (notFound || error || !detail) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <BackLink />
        <div className="rounded-lg bg-white p-5 shadow">
          <h1 className="font-semibold text-gray-800">{notFound ? 'ไม่พบบันทึกนี้' : error || 'โหลดบันทึกไม่สำเร็จ'}</h1>
          {notFound && <p className="mt-1 text-sm text-gray-600">บันทึกอาจถูกลบไปแล้ว หรืออยู่ในกลุ่มอื่น</p>}
          <Link to="/lesson-log" className="mt-4 inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
            กลับไปรายการบันทึก
          </Link>
        </div>
      </div>
    );
  }

  const done = detail.status === 'DONE';
  const meta = [detail.class?.className, detail.subject?.subjectName, detail.dateText].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <header>
        <BackLink />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {(detail.templateName || scopeOf(detail)) && (
              <p className="text-xs text-gray-500">
                {[detail.templateName, SCOPE_LABEL[scopeOf(detail)]].filter(Boolean).join(' · ')}
              </p>
            )}
            <h1 className="break-words text-xl font-bold text-gray-800 sm:text-2xl">{detail.name}</h1>
            <p className="mt-0.5 text-sm text-gray-600">{meta}</p>
          </div>
          <span className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${done ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            {STATUS_LABEL[detail.status] || ''}
          </span>
        </div>
        {detail.canEdit && (
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={rename}
              disabled={busy}
              className="min-h-[44px] rounded-lg px-3 text-sm text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            >
              แก้ชื่อ/วันที่
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="min-h-[44px] rounded-lg px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              ลบ
            </button>
          </div>
        )}
      </header>

      {detail.kind === 'NOTE' ? (
        <NoteEditor record={detail} canEdit={detail.canEdit} settings={settings} onSaved={setDetail} />
      ) : detail.kind === 'CLASS' ? (
        <ClassAnswersEditor standalone record={detail} canEdit={detail.canEdit} settings={settings} onSaved={setDetail} />
      ) : (
        <>
          {(detail.classFields || []).length > 0 && (
            <ClassAnswersEditor record={detail} canEdit={detail.canEdit} settings={settings} onSaved={setDetail} />
          )}
          <RubricEditor record={detail} canEdit={detail.canEdit} onSaved={setDetail} />
        </>
      )}
    </div>
  );
};

export default RecordPage;
