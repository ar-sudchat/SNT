import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assessmentAPI, subjectAPI } from '../../services/api';
import { useDialog } from '../ui/DialogProvider';
import SmartComboBox from '../ui/SmartComboBox';
import { scoreOf, toneOf, cycleDown, isWeakLevel, responseOf, maxPoints } from '../../pages/lessonlog/lessonLogCore';

// ประเมินรายคน (RUBRIC): มือถือ = การ์ดรายคน แตะช่องเพื่อเปลี่ยน · md+ = ตารางพร้อมคีย์บอร์ด
// รองรับ 4 แบบคำตอบ: SCORE (1..N) · PASSFAIL (2 = ผ่าน, 1 = ไม่ผ่าน) · CHECK (1 = ✓, 0 = –) · TEXT (ข้อความสั้น)
// props: { record: RecordDetail, canEdit, onSaved(detail) }

// สีของช่องคะแนนตามระดับ (เต็ม / ต่ำสุด / ระหว่างกลาง)
const TONE_ON = {
  hi: 'bg-pass/15 border-pass/60 text-green-900',
  mid: 'bg-pending/15 border-pending/60 text-amber-900',
  lo: 'bg-fail/15 border-fail/60 text-red-900',
};
const TONE_OFF = 'bg-white border-gray-300 text-gray-700';

const errText = (e, fallback) => e?.response?.data?.error || fallback;

const TEXT_MAX = 200;

// ค่าเริ่มต้นของแต่ละแบบ: เต็ม / ผ่าน / ✓ / ว่าง
function defaultValue(record) {
  const t = responseOf(record);
  if (t === 'PASSFAIL') return 2;
  if (t === 'CHECK') return 1;
  if (t === 'TEXT') return '';
  return record.maxScore;
}

function normOne(record, v) {
  const t = responseOf(record);
  if (t === 'TEXT') return typeof v === 'string' ? v.slice(0, TEXT_MAX) : '';
  if (v === null || v === undefined || v === '') return defaultValue(record);
  const x = Number(v);
  if (t === 'PASSFAIL') return x === 1 ? 1 : 2;
  if (t === 'CHECK') return x === 0 ? 0 : 1;
  return x >= 1 && x <= record.maxScore ? Math.round(x) : record.maxScore;
}

function normValues(record, vals) {
  return (record.criteria || []).map((_, i) => normOne(record, vals?.[i]));
}

function toMap(record) {
  const m = {};
  (record.students || []).forEach(s => { m[s.id] = normValues(record, s.values); });
  return m;
}

const sameValues = (a, b) => (!a && !b) || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]));

function LevelPill({ label }) {
  if (!label) return null;
  const weak = isWeakLevel(label);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
      weak ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-brand-50 text-brand-800 border-brand-200'}`}>
      {label}
    </span>
  );
}

const RubricEditor = ({ record, canEdit, onSaved }) => {
  const dialog = useDialog();
  const criteria = useMemo(() => record.criteria || [], [record.criteria]);
  const type = responseOf(record);
  const max = record.maxScore;
  const n = criteria.length;
  const pts = maxPoints(record);
  const showTotals = pts > 0;
  const hasLevels = (record.levels || []).length > 0;
  const showLevels = showTotals && hasLevels;
  const avgMode = type === 'SCORE' && !!record.useAverage;
  const students = useMemo(() => record.students || [], [record.students]);

  const [base, setBase] = useState(() => toMap(record)); // ค่าที่บันทึกบนเซิร์ฟเวอร์
  const [values, setValues] = useState(() => toMap(record));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // ดึงจากงาน
  const [fillOpen, setFillOpen] = useState(null); // criterionIndex ที่เปิดแผงอยู่
  const [tasks, setTasks] = useState(null);       // null = ยังไม่โหลด
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState('');
  const [pickedTask, setPickedTask] = useState('');
  const [filling, setFilling] = useState(false);

  const groupRefs = useRef({});
  const messageTimer = useRef(null);

  const applyDetail = useCallback((detail) => {
    const m = toMap(detail);
    setBase(m);
    setValues(m);
  }, []);

  // เปลี่ยนไปบันทึกอื่น (record.id เปลี่ยน) → รีเซ็ตค่าในจอ
  // updatedAt เปลี่ยนจากภายนอก (เช่น บันทึกคำตอบระดับห้อง) ต้องไม่ล้างคะแนนที่ยังไม่บันทึก
  // ส่วนการบันทึก/ดึงจากงานของตัวเองจะใช้ applyDetail กับ detail ที่ได้กลับมาเอง
  const sigRef = useRef(record.id);
  useEffect(() => {
    if (sigRef.current === record.id) return;
    sigRef.current = record.id;
    applyDetail(record);
  }, [record, applyDetail]);

  useEffect(() => () => clearTimeout(messageTimer.current), []);

  const flash = (text) => {
    setMessage(text);
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 5000);
  };

  // นักเรียนที่คะแนนต่างจากที่บันทึกไว้
  const changedIds = useMemo(() => {
    const set = new Set();
    students.forEach(s => { if (!sameValues(values[s.id], base[s.id])) set.add(s.id); });
    return set;
  }, [students, values, base]);
  const changedCount = changedIds.size;

  // เตือนก่อนออกจากหน้าเมื่อยังไม่บันทึก
  useEffect(() => {
    if (!canEdit || changedCount === 0) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [canEdit, changedCount]);

  // คำนวณสด
  const rows = useMemo(() => students.map(s => {
    const v = values[s.id] || normValues(record, s.values);
    return { student: s, values: v, ...scoreOf(record, v) };
  }), [students, values, record]);

  const levelCounts = useMemo(() => {
    const c = {};
    rows.forEach(r => { c[r.level] = (c[r.level] || 0) + 1; });
    return c;
  }, [rows]);

  const setScore = (studentId, idx, v) => {
    if (!canEdit) return;
    setMessage('');
    setValues(prev => {
      const cur = prev[studentId] || [];
      if (cur[idx] === v) return prev;
      const next = cur.slice();
      next[idx] = v;
      return { ...prev, [studentId]: next };
    });
  };

  const BULK = {
    SCORE: { label: 'ให้เต็มทุกคน', warn: `คะแนนที่ลดไว้ ${changedCount} คน จะกลับเป็นเต็ม ${max} ทุกช่อง` },
    PASSFAIL: { label: 'ให้ผ่านทุกคน', warn: `ที่ปรับไว้ ${changedCount} คน จะกลับเป็นผ่านทุกช่อง` },
    CHECK: { label: 'เช็กทุกคน', warn: `ที่เอาเครื่องหมายออกไว้ ${changedCount} คน จะกลับเป็น ✓ ทุกช่อง` },
  }[type];

  const fillAll = async () => {
    if (!canEdit || !BULK) return;
    if (changedCount > 0) {
      const ok = await dialog.confirm({
        title: BULK.label,
        message: BULK.warn,
        confirmText: BULK.label,
        type: 'warning',
      });
      if (!ok) return;
    }
    setMessage('');
    const m = {};
    students.forEach(s => { m[s.id] = criteria.map(() => defaultValue(record)); });
    setValues(m);
  };

  const save = async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (changedCount > 0) {
        const scores = students.filter(s => changedIds.has(s.id)).map(s => ({ studentId: s.id, values: values[s.id] }));
        await assessmentAPI.saveScores(record.id, scores);
      }
      const res = await assessmentAPI.updateRecord(record.id, { status: 'DONE' });
      const detail = res.data;
      applyDetail(detail);
      if (onSaved) onSaved(detail);
      flash('บันทึกแล้ว');
    } catch (e) {
      setError(errText(e, 'บันทึกไม่สำเร็จ ลองกดบันทึกอีกครั้ง'));
    } finally {
      setSaving(false);
    }
  };

  // ---- ดึงคะแนนจากการส่งงาน ----
  const FILL = {
    SCORE: { title: 'ดึงคะแนนจากงาน', what: 'คะแนน', button: 'ดึงคะแนน', link: 'คะแนน', rule: `ส่งตรงเวลา = ${max} · ส่งช้า = ${Math.max(1, max - 1)} · ยังไม่ส่ง/ไม่ผ่าน = 1 (ใช้กับช่องนี้ช่องเดียว)` },
    PASSFAIL: { title: 'ดึงผลจากงาน', what: 'ผล ผ่าน/ไม่ผ่าน', button: 'ดึงผล', link: 'ผล ผ่าน/ไม่ผ่าน', rule: 'ส่งตรงเวลา/ส่งช้า = ผ่าน · ยังไม่ส่ง = ไม่ผ่าน (ใช้กับช่องนี้ช่องเดียว)' },
    CHECK: { title: 'ดึงการเช็กจากงาน', what: 'การเช็ก ✓', button: 'ดึงการเช็ก', link: 'การเช็ก ✓', rule: 'ส่งตรงเวลา/ส่งช้า = ✓ · ยังไม่ส่ง = – (ใช้กับช่องนี้ช่องเดียว)' },
  }[type] || {};
  const scanIdx = type === 'TEXT' ? [] : criteria.map((c, i) => (c.source === 'scan' ? i : -1)).filter(i => i >= 0);
  const hasSubject = !!record.subject?.id;

  const openFill = async (idx) => {
    if (fillOpen === idx) { setFillOpen(null); return; }
    setFillOpen(idx);
    setPickedTask('');
    if (tasks || tasksLoading) return;
    setTasksLoading(true);
    setTasksError('');
    try {
      const res = await subjectAPI.getTasks(record.subject.id);
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setTasksError(errText(e, 'โหลดรายการงานไม่สำเร็จ'));
    } finally {
      setTasksLoading(false);
    }
  };

  const doFill = async (idx) => {
    if (!pickedTask || filling) return;
    const task = (tasks || []).find(t => String(t.id) === String(pickedTask));
    if (changedCount > 0) {
      const ok = await dialog.confirm({
        title: FILL.title,
        message: `ช่อง "${criteria[idx].label}" จะถูกแทนด้วย${FILL.what}จากงานนี้ และที่ปรับไว้แต่ยังไม่บันทึก ${changedCount} คนจะหายไป`,
        confirmText: FILL.button,
        type: 'warning',
      });
      if (!ok) return;
    }
    setFilling(true);
    setError('');
    setMessage('');
    try {
      const res = await assessmentAPI.fillFromTask(record.id, { taskId: Number(pickedTask), criterionIndex: idx });
      const detail = res.data;
      applyDetail(detail);
      if (onSaved) onSaved(detail);
      setFillOpen(null);
      flash(`ดึงจากงาน ${task?.taskName || ''} แล้ว ${detail.filled ?? 0} คน`);
    } catch (e) {
      setError(errText(e, 'ดึงคะแนนไม่สำเร็จ'));
    } finally {
      setFilling(false);
    }
  };

  // ---- คีย์บอร์ด (md+) ----
  const focusGroup = (r, c) => {
    const el = groupRefs.current[`${r}-${c}`];
    if (el) el.focus();
  };

  const onGroupKey = (e, r, c, studentId) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (c + 1 < n) focusGroup(r, c + 1); else if (r + 1 < rows.length) focusGroup(r + 1, 0);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (c > 0) focusGroup(r, c - 1); else if (r > 0) focusGroup(r - 1, n - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (r + 1 < rows.length) focusGroup(r + 1, c);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (r > 0) focusGroup(r - 1, c);
    } else if (canEdit && type === 'SCORE' && /^[0-9]$/.test(e.key)) {
      const d = Number(e.key);
      if (d >= 1 && d <= max) { e.preventDefault(); setScore(studentId, c, d); }
    } else if (canEdit && type === 'PASSFAIL') {
      if (e.key === '1' || e.key === '2') { e.preventDefault(); setScore(studentId, c, Number(e.key)); }
      else if (e.key === ' ') { e.preventDefault(); setScore(studentId, c, cycleDown(record, values[studentId]?.[c])); }
    } else if (canEdit && type === 'CHECK') {
      if (e.key === '1' || e.key === '0') { e.preventDefault(); setScore(studentId, c, Number(e.key)); }
      else if (e.key === ' ') { e.preventDefault(); setScore(studentId, c, cycleDown(record, values[studentId]?.[c])); }
    }
  };

  // ช่องข้อความ: ลูกศรขึ้น/ลง/Enter ย้ายระหว่างคน (ซ้าย/ขวาเป็นของเคอร์เซอร์)
  const onTextKey = (e, r, c) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent?.isComposing) return;
    if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      if (r + 1 < rows.length) focusGroup(r + 1, c);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (r > 0) focusGroup(r - 1, c);
    }
  };

  const totalText = (r) => (avgMode ? `เฉลี่ย ${r.average.toFixed(2)}` : `${r.total}/${pts}`);

  // สีช่อง: CHECK ที่ไม่ติ๊กเป็นสีกลาง ไม่ใช่สีแดง
  const cellCls = (v) => (type === 'CHECK' && v !== 1 ? TONE_OFF : TONE_ON[toneOf(record, v)]);

  const HINT = {
    SCORE: `ทุกคนได้ ${max} คะแนนไว้ก่อน แตะช่องเพื่อลดคะแนนเฉพาะคน`,
    PASSFAIL: 'ทุกคนได้ผ่านไว้ก่อน แตะเพื่อเปลี่ยนเฉพาะคน',
    CHECK: 'ทุกคนเช็ก ✓ ไว้ก่อน แตะเพื่อเอาออกเฉพาะคน',
    TEXT: `พิมพ์สั้นๆ ในแต่ละช่อง (ไม่เกิน ${TEXT_MAX} ตัวอักษร) เว้นว่างได้`,
  }[type];
  const KEY_HELP = {
    SCORE: `ใช้ปุ่มลูกศรเลื่อนระหว่างช่อง กดตัวเลข 1 ถึง ${max} เพื่อใส่คะแนน`,
    PASSFAIL: 'ใช้ปุ่มลูกศรเลื่อนระหว่างช่อง กด 2 = ผ่าน, 1 = ไม่ผ่าน, เว้นวรรคเพื่อสลับ',
    CHECK: 'ใช้ปุ่มลูกศรเลื่อนระหว่างช่อง กดเว้นวรรคเพื่อเช็กหรือเอาออก',
    TEXT: '',
  }[type];

  const scale = useMemo(() => Array.from({ length: max }, (_, i) => max - i), [max]); // max..1

  return (
    <div className="space-y-4">
      {/* สรุประดับคุณภาพ (สด) + คำแนะนำ + ความหมายช่อง รวมแถวเดียว */}
      <div className="flex flex-wrap items-center gap-2">
        {showLevels && (record.levels || []).map(l => {
          const weak = isWeakLevel(l.label);
          const count = levelCounts[l.label] || 0;
          return (
            <span key={l.label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 min-h-[32px] text-sm ${
                weak ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-brand-50 text-brand-800 border-brand-200'}`}>
              {l.label}
              <b className="tabular-nums">{count}</b>
            </span>
          );
        })}
        <span className="text-xs text-gray-500">{canEdit ? HINT : 'ดูได้อย่างเดียว แก้ไขได้เฉพาะผู้สร้างบันทึกหรือผู้จัดการกลุ่ม'}</span>
        {criteria.some(c => c.short && c.short !== c.label) && (
          <details className="relative ml-auto">
            <summary className="flex min-h-[36px] cursor-pointer select-none items-center rounded-lg px-2 text-sm text-brand-700 hover:bg-brand-50">
              ความหมายของแต่ละช่อง
            </summary>
            <ul className="absolute right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] space-y-1 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-lg">
              {criteria.map((c, i) => (
                <li key={i}><b>{c.short || c.label}</b> = {c.label}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* ดึงคะแนนจากการสแกน */}
      {canEdit && scanIdx.length > 0 && (
        hasSubject ? (
          <div className="space-y-2">
            {scanIdx.map(idx => (
              <div key={idx}>
                <button type="button" onClick={() => openFill(idx)} aria-expanded={fillOpen === idx}
                  className="min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 text-left">
                  ดึง{FILL.link} '{criteria[idx].label}' จากการส่งงาน
                </button>
                {fillOpen === idx && (
                  <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50/50 p-3 space-y-3">
                    <p className="block text-sm text-gray-700">
                      เลือกงานของวิชา {record.subject.subjectName}
                    </p>
                    {tasksLoading && <p className="text-sm text-gray-600">กำลังโหลดรายการงาน…</p>}
                    {tasksError && <p className="text-sm text-red-700">{tasksError}</p>}
                    {tasks && tasks.length === 0 && (
                      <p className="text-sm text-gray-600">วิชานี้ยังไม่มีงาน สร้างงานแล้วสแกนส่งงานก่อน จึงจะดึงคะแนนได้</p>
                    )}
                    {tasks && tasks.length > 0 && (
                      <>
                        <SmartComboBox
                          options={tasks.map(t => ({ value: String(t.id), label: `งานที่ ${t.taskNumber} ${t.taskName}` }))}
                          value={pickedTask}
                          onChange={v => setPickedTask(v ?? '')}
                          placeholder="เลือกงาน…"
                          ariaLabel={`เลือกงานของวิชา ${record.subject.subjectName}`}
                        />
                        <p className="text-xs text-gray-600">
                          {FILL.rule}
                        </p>
                      </>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setFillOpen(null)}
                        className="min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50">
                        ปิด
                      </button>
                      <button type="button" onClick={() => doFill(idx)} disabled={!pickedTask || filling}
                        className="min-h-[44px] px-4 rounded-lg border border-brand-600 text-brand-700 bg-white text-sm font-medium hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed">
                        {filling ? 'กำลังดึง…' : FILL.button}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">เลือกวิชาตอนสร้างบันทึกเพื่อดึง{FILL.link}จากการส่งงาน</p>
        )
      )}

      {students.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-gray-600">
          ห้องนี้ยังไม่มีนักเรียน เพิ่มนักเรียนในห้องก่อน แล้วกลับมาประเมิน
        </div>
      )}

      {/* มือถือ: การ์ดรายคน */}
      {students.length > 0 && (
        <ul className="space-y-3 md:hidden" aria-label="ให้ข้อมูลรายคน">
          {rows.map(r => {
            const s = r.student;
            const changed = changedIds.has(s.id);
            return (
              <li key={s.id}
                className={`rounded-lg border-2 bg-white p-3 ${changed ? 'border-accent-400' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 shrink-0 rounded-full bg-gray-100 text-gray-700 text-sm font-medium flex items-center justify-center tabular-nums">
                    {s.studentNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">{s.name}</div>
                    {showTotals && <div className="text-sm text-gray-600 tabular-nums">{totalText(r)}</div>}
                  </div>
                  {showLevels && <LevelPill label={r.level} />}
                </div>

                {type === 'TEXT' ? (
                  <div className="space-y-2">
                    {criteria.map((c, i) => {
                      const id = `rb-${record.id}-${s.id}-${i}`;
                      return (
                        <div key={i}>
                          <label htmlFor={id} className="block text-sm text-gray-700 mb-1">{c.label}</label>
                          <input id={id} type="text" value={r.values[i] ?? ''} maxLength={TEXT_MAX}
                            readOnly={!canEdit}
                            onChange={e => setScore(s.id, i, e.target.value)}
                            className="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 text-base focus:ring-2 focus:ring-brand-500 focus:border-transparent read-only:bg-gray-50" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(n, 1), type === 'PASSFAIL' ? 2 : 3)}, minmax(0, 1fr))` }}>
                    {criteria.map((c, i) => {
                      const v = r.values[i];
                      const cls = cellCls(v);
                      const big = type === 'PASSFAIL' ? (v === 2 ? 'ผ่าน' : 'ไม่ผ่าน') : type === 'CHECK' ? (v === 1 ? '✓' : '–') : v;
                      const word = type === 'PASSFAIL' ? (v === 2 ? 'ผ่าน' : 'ไม่ผ่าน') : type === 'CHECK' ? (v === 1 ? 'เช็กแล้ว' : 'ยังไม่เช็ก') : `ได้ ${v} คะแนน`;
                      const hintTap = type === 'SCORE' ? 'แตะเพื่อลด' : 'แตะเพื่อเปลี่ยน';
                      const inner = (
                        <>
                          <span className={`${type === 'PASSFAIL' ? 'text-lg' : 'text-xl'} font-semibold leading-none tabular-nums`}>{big}</span>
                          <span className="text-xs mt-1 leading-tight line-clamp-2">{c.short || c.label}</span>
                        </>
                      );
                      return canEdit ? (
                        <button key={i} type="button"
                          onClick={() => setScore(s.id, i, cycleDown(record, v))}
                          aria-label={`${c.label} ${word} ${hintTap}`}
                          className={`min-h-[56px] rounded-lg border px-1 py-2 flex flex-col items-center justify-center active:scale-95 transition-transform ${cls}`}>
                          {inner}
                        </button>
                      ) : (
                        <div key={i} aria-label={`${c.label} ${word}`}
                          className={`min-h-[56px] rounded-lg border px-1 py-2 flex flex-col items-center justify-center ${cls}`}>
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* md+: ตาราง */}
      {students.length > 0 && (
        <div className="hidden md:block overflow-auto max-h-[70vh] rounded-lg border border-gray-200 bg-white">
          {canEdit && KEY_HELP && <p className="sr-only">{KEY_HELP}</p>}
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-gray-50 border-b border-gray-200 px-2 py-2 w-12 min-w-[3rem] text-center font-medium text-gray-700">ที่</th>
                <th className="sticky top-0 left-12 z-30 bg-gray-50 border-b border-gray-200 px-3 py-2 min-w-[9rem] text-left font-medium text-gray-700">ชื่อ-สกุล</th>
                {criteria.map((c, i) => (
                  <th key={i} className={`sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-2 py-2 text-center font-medium text-gray-700 ${
                    type === 'TEXT' ? 'min-w-[12rem]' : type === 'PASSFAIL' ? 'min-w-[9rem]' : 'min-w-[6.5rem]'}`}>
                    {c.label}
                  </th>
                ))}
                {showTotals && (
                  <th className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap">
                    {avgMode ? 'เฉลี่ย' : 'รวม'}
                  </th>
                )}
                {showLevels && (
                  <th className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">ระดับ</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const s = r.student;
                const changed = changedIds.has(s.id);
                const bg = changed ? 'bg-accent-50' : 'bg-white';
                return (
                  <tr key={s.id}>
                    <td className={`sticky left-0 z-10 ${bg} border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-700 ${changed ? 'shadow-[inset_3px_0_0_0_rgb(var(--accent))]' : ''}`}>
                      {s.studentNumber}
                    </td>
                    <td className={`sticky left-12 z-10 ${bg} border-b border-gray-100 px-3 py-1.5 text-gray-900 whitespace-nowrap`}>{s.name}</td>
                    {criteria.map((c, ci) => {
                      const v = r.values[ci];
                      return (
                        <td key={ci} className={`${bg} border-b border-gray-100 px-2 py-1.5 text-center`}>
                          {type === 'TEXT' ? (
                            <input type="text" value={v ?? ''} maxLength={TEXT_MAX}
                              ref={el => { groupRefs.current[`${ri}-${ci}`] = el; }}
                              readOnly={!canEdit}
                              aria-label={`${s.name} ${c.label}`}
                              onChange={e => setScore(s.id, ci, e.target.value)}
                              onKeyDown={e => onTextKey(e, ri, ci)}
                              className="w-full min-w-[10rem] h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent read-only:bg-gray-50" />
                          ) : (
                            <div
                              ref={el => { groupRefs.current[`${ri}-${ci}`] = el; }}
                              role="group"
                              aria-label={`${s.name} ${c.label} ${type === 'SCORE' ? `ได้ ${v} คะแนน` : type === 'PASSFAIL' ? (v === 2 ? 'ผ่าน' : 'ไม่ผ่าน') : (v === 1 ? 'เช็กแล้ว' : 'ยังไม่เช็ก')}`}
                              tabIndex={0}
                              onKeyDown={e => onGroupKey(e, ri, ci, s.id)}
                              className="inline-flex rounded-lg border border-gray-300 overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1">
                              {type === 'CHECK' ? (
                                <button type="button" tabIndex={-1}
                                  disabled={!canEdit}
                                  aria-pressed={v === 1}
                                  onClick={() => setScore(s.id, ci, cycleDown(record, v))}
                                  className={`w-12 h-9 text-base font-semibold disabled:cursor-default ${
                                    v === 1 ? TONE_ON.hi : `${TONE_OFF} ${canEdit ? 'hover:bg-gray-100' : 'text-gray-400'}`}`}>
                                  {v === 1 ? '✓' : '–'}
                                </button>
                              ) : (type === 'PASSFAIL' ? [2, 1] : scale).map(num => {
                                const on = num === v;
                                const label = type === 'PASSFAIL' ? (num === 2 ? 'ผ่าน' : 'ไม่ผ่าน') : num;
                                return (
                                  <button key={num} type="button" tabIndex={-1}
                                    disabled={!canEdit}
                                    aria-pressed={on}
                                    onClick={() => setScore(s.id, ci, num)}
                                    className={`${type === 'PASSFAIL' ? 'px-3 min-w-[3.5rem]' : 'w-7'} h-9 text-sm font-semibold tabular-nums border-l border-gray-200 first:border-l-0 disabled:cursor-default ${
                                      on ? TONE_ON[toneOf(record, num)] : `${TONE_OFF} ${canEdit ? 'hover:bg-gray-100' : 'text-gray-400'}`}`}>
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {showTotals && (
                      <td className={`${bg} border-b border-gray-100 px-3 py-1.5 text-center tabular-nums whitespace-nowrap text-gray-900`}>
                        {avgMode ? r.average.toFixed(2) : `${r.total}/${pts}`}
                      </td>
                    )}
                    {showLevels && (
                      <td className={`${bg} border-b border-gray-100 px-3 py-1.5`}><LevelPill label={r.level} /></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ข้อความสถานะ */}
      <div aria-live="polite">
        {message && <p className="rounded-lg bg-green-50 border border-green-200 text-green-900 text-sm px-3 py-2">{message}</p>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">{error}</p>}

      {/* แถบล่าง (ติดขอบ เหนือแถบเมนูล่างบนมือถือ) */}
      {canEdit && students.length > 0 && (
        <div className="sticky z-20 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-0 -mx-1 rounded-lg border border-gray-200 bg-white/95 backdrop-blur p-3 shadow-lg flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600 mr-auto" aria-live="polite">
            {changedCount > 0 ? `ปรับคะแนนแล้ว ${changedCount} คน ยังไม่บันทึก` : 'ยังไม่มีการเปลี่ยนแปลง'}
          </span>
          {BULK && (
            <button type="button" onClick={fillAll} disabled={saving}
              className="min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50">
              {BULK.label}
            </button>
          )}
          <button type="button" onClick={save} disabled={saving}
            className="min-h-[44px] px-6 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-60">
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      )}
    </div>
  );
};

export default RubricEditor;
