import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { assessmentAPI } from '../../services/api';
import { useDialog } from '../../components/ui/DialogProvider';
import WindowModal from '../../components/ui/WindowModal';
import PageHeader, { CRUMB_LINK } from '../../components/ui/PageHeader';
import { RESPONSE_TYPES, SCOPE_LABEL, scopeOf, responseOf } from './lessonLogCore';
import TemplateEditorModal, { INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_ICON, errMsg, nextKey } from './TemplateEditorModal';

// จัดการแบบประเมินของบันทึกหลังแผน + ข้อมูลที่พิมพ์ลงไฟล์ Word (ชื่อโรงเรียน/ผู้ลงนาม)
// หน้า = ภาพรวมเป็นการ์ด · สร้าง/แก้ทำใน popup (TemplateEditorModal)

const MAX_SIGNERS = 6;

const responseLabel = (id) => (RESPONSE_TYPES.find(r => r.id === id) || RESPONSE_TYPES[0]).label;

// ชิปกรองตามแบบ (NOTE นับเป็นระดับห้อง ตาม scopeOf)
const FILTERS = [
  { id: 'ALL', label: 'ทั้งหมด' },
  { id: 'CLASS', label: SCOPE_LABEL.CLASS },
  { id: 'STUDENT', label: SCOPE_LABEL.STUDENT },
  { id: 'BOTH', label: 'ห้อง+รายนักเรียน' },
];

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>
    {children}
  </div>
);

// ---- การ์ดแบบประเมิน ----

function TemplateCard({ t, onEdit, onRemove }) {
  const isNote = t.kind === 'NOTE';
  const isStudent = t.kind === 'RUBRIC';
  const rt = responseOf(t);
  const nQ = (t.classFields || []).length;
  const nItems = (t.criteria || []).length;
  const levels = (t.levels || []).map(l => l.label).join(' / ');
  const counts = [nQ > 0 && `${nQ} คำถามระดับห้อง`, isStudent && `${nItems} รายการ`].filter(Boolean).join(' · ');

  return (
    <li className="flex flex-col rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-2">
        <h2 className="flex-1 min-w-0 font-semibold text-gray-900 break-words">{t.name}</h2>
        {t.isBuiltIn && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">สำเร็จรูป</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-brand-800">{SCOPE_LABEL[scopeOf(t)]}</span>
        {isStudent && (
          <span className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-700">
            {rt === 'SCORE' ? `ให้คะแนน 1–${t.maxScore}` : responseLabel(rt)}
          </span>
        )}
        {isNote && <span className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-700">บันทึกข้อความหลังสอน</span>}
      </div>
      {counts && <p className="mt-2 text-sm text-gray-600">{counts}</p>}
      {isStudent && levels && <p className="text-sm text-gray-500 truncate" title={levels}>{levels}</p>}
      <div className="mt-auto pt-3 flex items-center gap-2">
        {t.canEdit ? (
          <>
            <button type="button" className={`${BTN_SECONDARY} flex-1`} onClick={() => onEdit(t)}>แก้ไข</button>
            {!t.isBuiltIn && (
              <button type="button" className="min-h-[44px] px-3 text-sm text-red-700 hover:underline" onClick={() => onRemove(t)}>ลบ</button>
            )}
          </>
        ) : (
          <span className="text-xs text-gray-500">ดูได้อย่างเดียว</span>
        )}
      </div>
    </li>
  );
}

// ---- ข้อมูลในไฟล์ Word: สรุปบนหน้า แก้ใน popup ----

const toRows = (signers) => (signers || []).map(s => ({ _k: nextKey(), role: s.role || '', name: s.name || '' }));

function DocSettingsCard({ canManage }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState({ schoolName: '', signers: [] });
  const [draft, setDraft] = useState(null); // { schoolName, signers } ตอนเปิด popup
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);

  const apply = useCallback((res) => {
    setData({ schoolName: res.schoolName || '', signers: toRows(res.signers) });
  }, []);

  useEffect(() => {
    let alive = true;
    assessmentAPI.settings()
      .then(res => { if (alive) { apply(res.data); setLoaded(true); } })
      .catch(err => { if (alive) setLoadError(errMsg(err, 'โหลดข้อมูลไม่สำเร็จ')); });
    return () => { alive = false; clearTimeout(timer.current); };
  }, [apply]);

  const openEdit = () => { setError(''); setDraft({ schoolName: data.schoolName, signers: toRows(data.signers) }); };
  const close = () => { if (!saving) setDraft(null); };
  const setSigners = (fn) => setDraft(d => ({ ...d, signers: fn(d.signers) }));
  const setSigner = (i, patch) => setSigners(list => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const save = async () => {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const res = await assessmentAPI.saveSettings({
        schoolName: draft.schoolName.trim(),
        signers: draft.signers.map(s => ({ role: s.role.trim(), name: s.name.trim() })).filter(s => s.role || s.name),
      });
      apply(res.data);
      setDraft(null);
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(errMsg(err, 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally {
      setSaving(false);
    }
  };

  const signerText = data.signers.map(s => [s.role, s.name].filter(Boolean).join(' ')).join(' · ');

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[12rem]">
          <h2 className="font-semibold text-gray-900">ข้อมูลในไฟล์ Word</h2>
          <p className="text-xs text-gray-500">ชื่อโรงเรียนและผู้ลงนามที่พิมพ์ท้ายแบบบันทึกเมื่อส่งออก</p>
          {loadError && <p className="mt-1 text-sm text-red-700" role="alert">{loadError}</p>}
          {!loaded && !loadError && <p className="mt-1 text-sm text-gray-500">กำลังโหลด…</p>}
          {loaded && (
            <div className="mt-2 space-y-0.5 text-sm text-gray-800">
              <p><span className="text-gray-500">โรงเรียน </span>{data.schoolName || '—'}</p>
              <p className="break-words"><span className="text-gray-500">ผู้ลงนาม </span>{signerText || 'ยังไม่มี'}</p>
            </div>
          )}
        </div>
        {loaded && canManage && (
          <div className="flex items-center gap-2">
            {saved && <span className="text-sm text-green-700" role="status">บันทึกแล้ว</span>}
            <button type="button" className={BTN_SECONDARY} onClick={openEdit}>แก้ไข</button>
          </div>
        )}
        {loaded && !canManage && <p className="w-full text-sm text-gray-600">แจ้งผู้ดูแลกลุ่มเพื่อแก้ไข</p>}
      </div>

      <WindowModal
        open={!!draft}
        title="ข้อมูลในไฟล์ Word"
        onClose={close}
        id="lesson-log-doc-settings"
        initialWidth="max-w-lg"
        footer={draft && (
          <div className="space-y-2">
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} disabled={saving} onClick={close}>ยกเลิก</button>
              <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
            </div>
          </div>
        )}
      >
        {draft && (
          <div className="p-4 space-y-4">
            <Field label="ชื่อโรงเรียน">
              <input
                data-autofocus
                className={INPUT}
                value={draft.schoolName}
                maxLength={120}
                onChange={(e) => setDraft(d => ({ ...d, schoolName: e.target.value }))}
              />
            </Field>
            <div>
              <h3 className="text-sm font-medium text-gray-800 mb-2">ผู้ลงนาม</h3>
              {draft.signers.length === 0 && <p className="text-sm text-gray-500 mb-2">ยังไม่มีผู้ลงนาม</p>}
              <ul className="space-y-3">
                {draft.signers.map((s, i) => (
                  <li key={s._k} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <input
                      className={INPUT}
                      value={s.role}
                      maxLength={80}
                      placeholder="ตำแหน่ง เช่น หัวหน้ากลุ่มสาระฯ"
                      aria-label={`ตำแหน่งผู้ลงนามที่ ${i + 1}`}
                      onChange={(e) => setSigner(i, { role: e.target.value })}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        className={INPUT}
                        value={s.name}
                        maxLength={80}
                        placeholder="ชื่อ-สกุล"
                        aria-label={`ชื่อ-สกุลผู้ลงนามที่ ${i + 1}`}
                        onChange={(e) => setSigner(i, { name: e.target.value })}
                      />
                      <button
                        type="button"
                        className={`${BTN_ICON} text-red-700 shrink-0`}
                        aria-label={`เอาผู้ลงนามที่ ${i + 1} ออก`}
                        onClick={() => setSigners(list => list.filter((_, j) => j !== i))}
                      >✕</button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`${BTN_SECONDARY} mt-2`}
                disabled={draft.signers.length >= MAX_SIGNERS}
                onClick={() => setSigners(list => [...list, { _k: nextKey(), role: '', name: '' }])}
              >+ เพิ่มผู้ลงนาม</button>
            </div>
          </div>
        )}
      </WindowModal>
    </section>
  );
}

// ---- หน้าหลัก ----

export default function TemplatesPage() {
  const dialog = useDialog();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [editing, setEditing] = useState(null); // { seq, template|null }
  const seq = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await assessmentAPI.templates();
      setTemplates(res.data || []);
      setLoadError('');
    } catch (err) {
      setLoadError(errMsg(err, 'โหลดแบบประเมินไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => setEditing({ seq: ++seq.current, template: null });
  const openEdit = (t) => setEditing({ seq: ++seq.current, template: t });
  const onSaved = async () => { setEditing(null); await load(); };

  const remove = async (t) => {
    const ok = await dialog.confirm({
      title: 'ลบแบบประเมิน',
      message: `ลบ "${t.name}" ใช่ไหม`,
      confirmText: 'ลบแบบประเมิน',
      type: 'danger',
    });
    if (!ok) return;
    try {
      const res = await assessmentAPI.deleteTemplate(t.id);
      if (res.data?.deactivated) {
        await dialog.alert({ title: 'ซ่อนแบบประเมินแล้ว', message: 'มีบันทึกที่ใช้แบบนี้อยู่ จึงซ่อนไว้แทนการลบ', type: 'info' });
      }
      await load();
    } catch (err) {
      await dialog.alert({ title: 'ลบไม่สำเร็จ', message: errMsg(err, 'ลองใหม่อีกครั้ง'), type: 'danger' });
    }
  };

  // นับจำนวนต่อแบบ · ชิปที่ไม่มีแบบประเมินไม่ต้องแสดง
  const counts = templates.reduce((acc, t) => ({ ...acc, [scopeOf(t)]: (acc[scopeOf(t)] || 0) + 1 }), { ALL: templates.length });
  const chips = FILTERS.filter(f => counts[f.id]);
  const active = counts[filter] ? filter : 'ALL';
  const shown = active === 'ALL' ? templates : templates.filter(t => scopeOf(t) === active);

  return (
    <div className="mx-auto max-w-3xl lg:max-w-6xl space-y-4 pb-24 sm:pb-6">
      <PageHeader title="แบบประเมิน" crumb={<Link to="/lesson-log" className={CRUMB_LINK}>‹ บันทึกหลังแผน</Link>}>
        <button type="button" className={BTN_PRIMARY} onClick={openCreate}>+ สร้างแบบประเมิน</button>
      </PageHeader>

      {loading && <p className="text-sm text-gray-500">กำลังโหลด…</p>}
      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {loadError}{' '}
          <button type="button" className="min-h-[44px] underline" onClick={() => { setLoading(true); load(); }}>ลองใหม่</button>
        </div>
      )}

      {!loading && !loadError && templates.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-600">
          ยังไม่มีแบบประเมิน กด "+ สร้างแบบประเมิน" เพื่อเริ่ม
        </p>
      )}

      {chips.length > 2 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามแบบ">
          {chips.map(f => (
            <button
              key={f.id}
              type="button"
              aria-pressed={active === f.id}
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border text-sm ${active === f.id
                ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}
            >
              {f.label}
              <span className={active === f.id ? 'text-white/80' : 'text-gray-500'}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(t => <TemplateCard key={t.id} t={t} onEdit={openEdit} onRemove={remove} />)}
        </ul>
      )}

      {/* Every teacher of the group may edit the school name and signers. */}
      <DocSettingsCard canManage />

      {editing && (
        <TemplateEditorModal
          key={editing.seq}
          template={editing.template}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
