import { t } from '../../i18n';
import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { importAPI } from '../../services/api';
import { useDialog } from '../../components/ui/DialogProvider';
import { SmartComboBox } from '../../components/ui';

const labels = { studentCode: 'เลขประจำตัว', studentNumber: 'เลขที่', prefix: 'คำนำหน้า', firstName: 'ชื่อ', lastName: 'นามสกุล', fullName: 'ชื่อ-สกุล', className: 'ห้อง', grade: 'ชั้น', room: 'ห้องที่' };
const headers = ['เลขที่','ชื่อ','ห้อง','เลขประจำตัว'];
const sources = { rules: 'ระบบจับคอลัมน์ให้', ai: 'AI ช่วยจับคอลัมน์', user: 'ตามที่ครูเลือก' };
export default function SmartImport() {
  const dialog = useDialog();
  const picker = useRef(null);
  const sequence = useRef(0);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [defaultClass, setDefaultClass] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const load = async (selected, options = {}) => {
    const id = ++sequence.current;
    setLoading(true); setError(''); setResult(null);
    try {
      const { data } = await importAPI.smartPreview(selected, options);
      if (id === sequence.current) { setPreview(data); setDefaultClass(data.defaultClass || ''); }
    } catch (err) {
      if (id === sequence.current) { setPreview(null); setError(err.response?.data?.error || t('อ่านไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง')); }
    } finally { if (id === sequence.current) setLoading(false); }
  };
  const selectFile = selected => {
    if (!selected || loading || saving) return;
    setFile(selected); setPreview(null); setDefaultClass(''); load(selected);
  };
  const refresh = (options = {}) => load(file, { mapping: preview.mapping, headerRow: preview.headerRow, defaultClass, ...options });
  const commit = async () => {
    setSaving(true);
    try {
      if (!await dialog.confirm({ title: t('นำเข้ารายชื่อนักเรียน'), message: t("นำเข้า {value1} คน โดยรายชื่อรหัสเดิมจะอัปเดตชื่อ เลขที่ และห้อง ตรวจสอบข้อมูลแล้วใช่ไหม?", { value1: preview.total }), confirmText: t('นำเข้า') })) return;
      setError('');
      const { data } = await importAPI.smartCommit(preview.students);
      setResult(data);
    } catch (err) { setError(err.response?.data?.error || t('นำเข้าไม่สำเร็จ ลองใหม่อีกครั้ง')); }
    finally { setSaving(false); }
  };
  if (result) return <section className="rounded-lg bg-green-50 p-4 space-y-3" role="status">
    <h3 className="font-semibold">{t("นำเข้ารายชื่อสำเร็จ")}</h3>
    <p>{t("เพิ่มใหม่ {value1} คน · อัปเดต {value2} คน · สร้างห้อง {value3} ห้อง · สร้างชั้น {value4} ชั้น", { value1: result.created, value2: result.updated, value3: result.classesCreated, value4: result.gradesCreated })}</p>
    <Link to="/monitor" className="inline-flex items-center min-h-[44px] rounded-lg bg-brand-600 text-white px-4">{t("ไปหน้าติดตามงาน")}</Link>
  </section>;
  return <section className="space-y-4 min-w-0" aria-busy={loading || saving}>
    <p className="text-sm text-gray-600">{t("ไฟล์ Excel หรือ CSV แบบไหนก็ได้ ระบบจะดูเองว่าคอลัมน์ไหนคือ เลขประจำตัว เลขที่ ชื่อ และห้อง")}</p>
    <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }} className="border-2 border-dashed rounded-lg p-4 text-center space-y-2">
      <input ref={picker} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => selectFile(e.target.files[0])} />
      <button type="button" disabled={loading || saving} onClick={() => picker.current.click()} className="border rounded-lg px-4 min-h-[44px] disabled:opacity-50">{t("เลือกไฟล์รายชื่อ")}</button>
      <p className="text-sm text-gray-500 break-all">{file?.name || t('หรือลากไฟล์มาวางที่นี่')}</p>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3">{error}</p>}
    {loading && <p role="status">{t("กำลังอ่านและจับคอลัมน์...")}</p>}
    {preview && <>
      <p className="font-medium break-words">{t("พบนักเรียน {value1} คน · ห้อง {value2} · เพิ่มใหม่ {value3} · อัปเดต {value4}", { value1: preview.total, value2: [...new Set(preview.students.map(s => s.className || 'ยังไม่ระบุ'))].map(name => name === 'ยังไม่ระบุ' ? t('ยังไม่ระบุ') : name).join(', '), value3: preview.plan.create, value4: preview.plan.update })}</p>
      <span className="inline-block rounded-full bg-brand-50 text-brand-700 px-3 py-1 text-sm">{t(sources[preview.mappingSource])}</span>
      {preview.sheets?.length > 1 && <p className="text-sm text-gray-600 break-words">{t("อ่าน {value1} sheet: {value2}", { value1: preview.sheets.length, value2: preview.sheets.map(sh => t("{value1} ({value2} · {value3} คน)", { value1: sh.name, value2: sh.classes.join(', ') || t('ไม่ระบุห้อง'), value3: sh.students })).join(' · ') })}</p>}
      <details open={preview.confidence === 'low'} className="rounded-lg border p-3">
        <summary className="cursor-pointer select-none min-h-[44px] flex flex-col justify-center">
          <span className="font-semibold">{t("คอลัมน์ที่ระบบจับให้ (แตะเพื่อแก้)")}</span>
          <span className="text-sm text-gray-600 break-words">
            {Object.entries(labels).filter(([f]) => preview.mapping[f] != null).map(([f, label]) => `${t(label)} = ${preview.headers[preview.mapping[f]] || t("คอลัมน์ {value1}", { value1: preview.mapping[f] + 1 })}`).join(' · ') || t('ยังจับคอลัมน์ไม่ได้ เลือกเองด้านล่าง')}
          </span>
        </summary>
      <fieldset disabled={loading || saving} className="space-y-3 mt-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{Object.entries(labels).map(([field, label]) => <div key={field} className="text-sm min-w-0">{t(label)}
          {/* fieldset disabled ไม่มีผลกับ SmartComboBox ต้องส่ง disabled เอง */}
          <SmartComboBox
            options={[{ value: '', label: t('ไม่มี') }, ...preview.headers.map((h, i) => ({ value: i, label: `${i + 1}. ${h || t('ไม่มีหัวคอลัมน์')}` }))]}
            value={preview.mapping[field] ?? ''}
            onChange={v => refresh({ mapping: { ...preview.mapping, [field]: v === '' || v == null ? null : Number(v) } })}
            disabled={loading || saving}
            clearable={false}
            ariaLabel={t(label)}
            className="mt-1"
          />
        </div>)}</div>
        <label className="block text-sm">{t("ห้อง (ถ้าในไฟล์ไม่มี)")}<input value={defaultClass} maxLength={100} onChange={e => setDefaultClass(e.target.value)} onBlur={() => { if (defaultClass !== preview.defaultClass) refresh(); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} placeholder={t("เช่น ป.4/1")} className="block w-full min-h-[44px] border rounded-lg px-3 mt-1" />
        </label>
      </fieldset>
      </details>
      {!!preview.issues.length && <ul className="bg-amber-50 text-amber-800 rounded-lg p-3 max-h-60 overflow-y-auto">{preview.issues.map((issue, i) => <li key={i}>{t("{value1}แถว {value2}: {value3}", { value1: issue.sheet ? `${issue.sheet} · ` : '', value2: issue.row, value3: issue.message })}</li>)}</ul>}
      {preview.notes?.map((note, i) => <p key={i} className="text-amber-800">{note}</p>)}
      {!!preview.plan.newClasses.length && <p className="break-words">{t("สร้างห้องใหม่: {value1}", { value1: preview.plan.newClasses.join(', ') })}</p>}
      {preview.students.some(s => s.codeGenerated) && <p className="text-amber-800">{t("บางคนไม่มีเลขประจำตัว ระบบสร้างรหัสจากห้องและเลขที่ให้ ตรวจสอบก่อนนำเข้า")}</p>}
      {!preview.plan.currentYear && <p className="text-amber-800">{t("ยังไม่มีปีการศึกษาปัจจุบัน ตั้งค่าที่ ตั้งค่าระบบ → ปีการศึกษา ก่อน")}</p>}
      <div className="hidden md:block"><table className="w-full table-fixed text-sm text-left"><thead><tr>{headers.map(h => <th key={h} className="p-2">{t(h)}</th>)}</tr></thead><tbody>{preview.students.slice(0, 20).map(s => <tr key={`${s.sheet || ''}-${s.row}`} className="border-t">{[s.studentNumber ?? '—', s.name, s.className || '—', s.studentCode].map((v, i) => <td key={i} className="p-2 break-words">{v}</td>)}</tr>)}</tbody></table></div>
      <div className="md:hidden space-y-2">{preview.students.slice(0, 20).map(s => <div key={`${s.sheet || ''}-${s.row}`} className="border rounded-lg p-3 break-words"><p className="font-medium">{s.studentNumber ?? '—'} · {s.name}</p><p className="text-sm text-gray-600">{t("ห้อง {value1} · เลขประจำตัว {value2}", { value1: s.className || '—', value2: s.studentCode })}</p></div>)}</div>
      {preview.total > 20 && <p className="text-sm text-gray-500">{t("และอีก {value1} คน", { value1: preview.total - 20 })}</p>}
      <button type="button" disabled={loading || saving || !preview.total || !preview.plan.currentYear || preview.students.some(s => !s.className) || defaultClass !== preview.defaultClass} onClick={commit} className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-brand-600 text-white rounded-lg disabled:opacity-50">{saving ? t('กำลังนำเข้า...') : t("นำเข้า {value1} คน", { value1: preview.total })}</button>
    </>}
  </section>;
}
