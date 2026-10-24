import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { importAPI } from '../../services/api';
import { useDialog } from '../../components/ui/DialogProvider';

const labels = { studentCode: 'เลขประจำตัว', studentNumber: 'เลขที่', prefix: 'คำนำหน้า', firstName: 'ชื่อ', lastName: 'นามสกุล', fullName: 'ชื่อ-สกุล', className: 'ห้อง', grade: 'ชั้น', room: 'ห้องที่' };
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
      if (id === sequence.current) { setPreview(null); setError(err.response?.data?.error || 'อ่านไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง'); }
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
      if (!await dialog.confirm({ title: 'นำเข้ารายชื่อนักเรียน', message: `นำเข้า ${preview.total} คน โดยรายชื่อรหัสเดิมจะอัปเดตชื่อ เลขที่ และห้อง ตรวจสอบข้อมูลแล้วใช่ไหม?`, confirmText: 'นำเข้า' })) return;
      setError('');
      const { data } = await importAPI.smartCommit(preview.students);
      setResult(data);
    } catch (err) { setError(err.response?.data?.error || 'นำเข้าไม่สำเร็จ ลองใหม่อีกครั้ง'); }
    finally { setSaving(false); }
  };
  if (result) return <section className="rounded-lg bg-green-50 p-4 space-y-3" role="status">
    <h3 className="font-semibold">นำเข้ารายชื่อสำเร็จ</h3>
    <p>เพิ่มใหม่ {result.created} คน · อัปเดต {result.updated} คน · สร้างห้อง {result.classesCreated} ห้อง · สร้างชั้น {result.gradesCreated} ชั้น</p>
    <Link to="/monitor" className="inline-flex items-center min-h-[44px] rounded-lg bg-brand-600 text-white px-4">ไปหน้าติดตามงาน</Link>
  </section>;
  return <section className="space-y-4 min-w-0" aria-busy={loading || saving}>
    <p className="text-sm text-gray-600">ไฟล์ Excel หรือ CSV แบบไหนก็ได้ ระบบจะดูเองว่าคอลัมน์ไหนคือ เลขประจำตัว เลขที่ ชื่อ และห้อง</p>
    <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }} className="border-2 border-dashed rounded-lg p-4 text-center space-y-2">
      <input ref={picker} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => selectFile(e.target.files[0])} />
      <button type="button" disabled={loading || saving} onClick={() => picker.current.click()} className="border rounded-lg px-4 min-h-[44px] disabled:opacity-50">เลือกไฟล์รายชื่อ</button>
      <p className="text-sm text-gray-500 break-all">{file?.name || 'หรือลากไฟล์มาวางที่นี่'}</p>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3">{error}</p>}
    {loading && <p role="status">กำลังอ่านและจับคอลัมน์...</p>}
    {preview && <>
      <p className="font-medium break-words">พบนักเรียน {preview.total} คน · ห้อง {[...new Set(preview.students.map(s => s.className || 'ยังไม่ระบุ'))].join(', ')} · เพิ่มใหม่ {preview.plan.create} · อัปเดต {preview.plan.update}</p>
      <span className="inline-block rounded-full bg-brand-50 text-brand-700 px-3 py-1 text-sm">{sources[preview.mappingSource]}</span>
      {preview.sheets?.length > 1 && <p className="text-sm text-gray-600 break-words">อ่าน {preview.sheets.length} sheet: {preview.sheets.map(sh => `${sh.name} (${sh.classes.join(', ') || 'ไม่ระบุห้อง'} · ${sh.students} คน)`).join(' · ')}</p>}
      <details open={preview.confidence === 'low'} className="rounded-lg border p-3">
        <summary className="cursor-pointer select-none min-h-[44px] flex flex-col justify-center">
          <span className="font-semibold">คอลัมน์ที่ระบบจับให้ (แตะเพื่อแก้)</span>
          <span className="text-sm text-gray-600 break-words">
            {Object.entries(labels).filter(([f]) => preview.mapping[f] != null).map(([f, label]) => `${label} = ${preview.headers[preview.mapping[f]] || `คอลัมน์ ${preview.mapping[f] + 1}`}`).join(' · ') || 'ยังจับคอลัมน์ไม่ได้ เลือกเองด้านล่าง'}
          </span>
        </summary>
      <fieldset disabled={loading || saving} className="space-y-3 mt-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{Object.entries(labels).map(([field, label]) => <label key={field} className="text-sm min-w-0">{label}
          <select value={preview.mapping[field] ?? ''} onChange={e => refresh({ mapping: { ...preview.mapping, [field]: e.target.value === '' ? null : Number(e.target.value) } })} className="block w-full min-h-[44px] border rounded-lg px-2 mt-1">
            <option value="">ไม่มี</option>{preview.headers.map((h, i) => <option key={i} value={i}>{i + 1}. {h || 'ไม่มีหัวคอลัมน์'}</option>)}
          </select>
        </label>)}</div>
        <label className="block text-sm">ห้อง (ถ้าในไฟล์ไม่มี)
          <input value={defaultClass} maxLength={100} onChange={e => setDefaultClass(e.target.value)} onBlur={() => { if (defaultClass !== preview.defaultClass) refresh(); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} placeholder="เช่น ป.4/1" className="block w-full min-h-[44px] border rounded-lg px-3 mt-1" />
        </label>
      </fieldset>
      </details>
      {!!preview.issues.length && <ul className="bg-amber-50 text-amber-800 rounded-lg p-3 max-h-60 overflow-y-auto">{preview.issues.map((issue, i) => <li key={i}>{issue.sheet ? `${issue.sheet} · ` : ''}แถว {issue.row}: {issue.message}</li>)}</ul>}
      {preview.notes?.map((note, i) => <p key={i} className="text-amber-800">{note}</p>)}
      {!!preview.plan.newClasses.length && <p className="break-words">สร้างห้องใหม่: {preview.plan.newClasses.join(', ')}</p>}
      {preview.students.some(s => s.codeGenerated) && <p className="text-amber-800">บางคนไม่มีเลขประจำตัว ระบบสร้างรหัสจากห้องและเลขที่ให้ ตรวจสอบก่อนนำเข้า</p>}
      {!preview.plan.currentYear && <p className="text-amber-800">ยังไม่มีปีการศึกษาปัจจุบัน ตั้งค่าที่ ตั้งค่าระบบ → ปีการศึกษา ก่อน</p>}
      <div className="hidden md:block"><table className="w-full table-fixed text-sm text-left"><thead><tr>{['เลขที่','ชื่อ','ห้อง','เลขประจำตัว'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{preview.students.slice(0, 20).map(s => <tr key={`${s.sheet || ''}-${s.row}`} className="border-t">{[s.studentNumber ?? '—', s.name, s.className || '—', s.studentCode].map((v, i) => <td key={i} className="p-2 break-words">{v}</td>)}</tr>)}</tbody></table></div>
      <div className="md:hidden space-y-2">{preview.students.slice(0, 20).map(s => <div key={`${s.sheet || ''}-${s.row}`} className="border rounded-lg p-3 break-words"><p className="font-medium">{s.studentNumber ?? '—'} · {s.name}</p><p className="text-sm text-gray-600">ห้อง {s.className || '—'} · เลขประจำตัว {s.studentCode}</p></div>)}</div>
      {preview.total > 20 && <p className="text-sm text-gray-500">และอีก {preview.total - 20} คน</p>}
      <button type="button" disabled={loading || saving || !preview.total || !preview.plan.currentYear || preview.students.some(s => !s.className) || defaultClass !== preview.defaultClass} onClick={commit} className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-brand-600 text-white rounded-lg disabled:opacity-50">{saving ? 'กำลังนำเข้า...' : `นำเข้า ${preview.total} คน`}</button>
    </>}
  </section>;
}
