import { t } from '../../i18n';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { assessmentAPI } from '../../services/api';
import { useDialog } from '../../components/ui/DialogProvider';
import { Icon } from '../../components/navConfig';
import NoteEditor from '../../components/lessonlog/NoteEditor';
import RubricEditor from '../../components/lessonlog/RubricEditor';
import ClassAnswersEditor from '../../components/lessonlog/ClassAnswersEditor';
import WindowModal from '../../components/ui/WindowModal';
import ThaiDatePicker from '../../components/ui/ThaiDatePicker';
import { STATUS_LABEL, SCOPE_LABEL, scopeOf } from './lessonLogCore';

const BACK = 'M15 19l-7-7 7-7';

const BackLink = () => (
  <Link to="/lesson-log" className="inline-flex min-h-[44px] items-center gap-1 text-sm text-brand-700 hover:text-brand-900">
    <Icon d={BACK} className="h-4 w-4" />{t(' บันทึกหลังแผน')}</Link>
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
  // แก้ชื่อ/วันที่: { name, text, dates, error } ตอนเปิด popup
  const [edit, setEdit] = useState(null);

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
        else setError(e.response?.data?.error || t('โหลดบันทึกไม่สำเร็จ'));
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

  const rename = () => setEdit({ name: detail.name, text: detail.dateText || '', dates: detail.dates || [], error: '' });

  const saveEdit = async (e) => {
    e.preventDefault();
    const name = edit.name.trim();
    if (!name) { setEdit(v => ({ ...v, error: t('ใส่ชื่อบันทึก') })); return; }
    setBusy(true);
    try {
      // ไม่ได้เลือกวันใหม่ (บันทึกเก่าที่ยังไม่มีวันจริง) ให้ server แปลงจากข้อความเดิม
      const body = { name, dateText: edit.text.trim() };
      if (edit.dates.length || !edit.text.trim()) body.dates = edit.dates;
      const res = await assessmentAPI.updateRecord(detail.id, body);
      setDetail(res.data);
      setEdit(null);
    } catch (err) {
      setEdit(v => ({ ...v, error: err.response?.data?.error || t('แก้ไขไม่สำเร็จ ลองใหม่อีกครั้ง') }));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await dialog.confirm({
      title: t('ลบบันทึกนี้?'),
      message: t('"{value1}" และคะแนนที่กรอกไว้จะถูกลบ กู้คืนไม่ได้', { value1: detail.name }),
      type: 'danger',
      confirmText: t('ลบบันทึก')
    });
    if (!ok) return;
    setBusy(true);
    try {
      await assessmentAPI.deleteRecord(detail.id);
      navigate('/lesson-log');
    } catch (e) {
      setBusy(false);
      await dialog.alert({ title: t('ลบไม่สำเร็จ'), message: e.response?.data?.error || t('ลองใหม่อีกครั้ง'), type: 'danger' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand-600" role="status" aria-label={t("กำลังโหลด")} />
      </div>
    );
  }

  if (notFound || error || !detail) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <BackLink />
        <div className="rounded-lg bg-white p-5 shadow">
          <h1 className="font-semibold text-gray-800">{notFound ? t('ไม่พบบันทึกนี้') : error || t('โหลดบันทึกไม่สำเร็จ')}</h1>
          {notFound && <p className="mt-1 text-sm text-gray-600">{t('บันทึกอาจถูกลบไปแล้ว หรืออยู่ในกลุ่มอื่น')}</p>}
          <Link to="/lesson-log" className="mt-4 inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">{t('กลับไปรายการบันทึก')}</Link>
        </div>
      </div>
    );
  }

  const done = detail.status === 'DONE';
  const meta = [detail.class?.className, detail.subject?.subjectName, detail.dateText].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      {/* หัวกะทัดรัด: ย้อนกลับ + ชื่อ + ข้อมูล + ปุ่ม อยู่แถวเดียวบนคอม */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link to="/lesson-log" aria-label={t("กลับไปบันทึกหลังแผน")} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50">
          <Icon d={BACK} className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-lg font-bold leading-tight text-gray-800 sm:text-xl">{detail.name}</h1>
          <p className="truncate text-sm text-gray-500">
            {[meta, t(detail.templateName), t(SCOPE_LABEL[scopeOf(detail)])].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${done ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            {STATUS_LABEL[detail.status] ? t(STATUS_LABEL[detail.status]) : ''}
          </span>
          {detail.canEdit && (
            <>
              <button type="button" onClick={rename} disabled={busy} className="min-h-[44px] rounded-lg px-3 text-sm text-brand-700 hover:bg-brand-50 disabled:opacity-50">{t('แก้ชื่อ/วันที่')}</button>
              <button type="button" onClick={remove} disabled={busy} className="min-h-[44px] rounded-lg px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">{t('ลบ')}</button>
            </>
          )}
        </div>
      </header>

      <WindowModal open={!!edit} id="record-edit" title={t("แก้ชื่อ/วันที่")} onClose={() => setEdit(null)} initialWidth="max-w-md">
        {edit && (
          <form onSubmit={saveEdit} noValidate className="space-y-4 p-4">
            <label className="block text-sm font-medium text-gray-700">{t('ชื่อบันทึก')}<input
                autoFocus
                value={edit.name}
                onChange={(e) => setEdit(v => ({ ...v, name: e.target.value, error: '' }))}
                className="mt-1 block min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
            <div>
              <label htmlFor="record-edit-date" className="block text-sm font-medium text-gray-700">{t('วันที่ (เลือกได้หลายวันหรือเป็นช่วง)')}</label>
              <ThaiDatePicker id="record-edit-date" value={edit.text} dates={edit.dates} onChange={(text, dates) => setEdit(v => ({ ...v, text, dates }))} />
            </div>
            {edit.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{edit.error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEdit(null)} className="min-h-[44px] rounded-lg border border-gray-300 px-4 text-sm text-gray-700 hover:bg-gray-50">{t('ยกเลิก')}</button>
              <button type="submit" disabled={busy} className="min-h-[44px] rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? t('กำลังบันทึก…') : t('บันทึก')}</button>
            </div>
          </form>
        )}
      </WindowModal>

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
