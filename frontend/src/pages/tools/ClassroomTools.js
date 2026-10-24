import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { classAPI, gradeAPI } from '../../services/api';
import { SmartComboBox } from '../../components/ui';
import RandomPicker from './RandomPicker';
import GroupMaker from './GroupMaker';
import ClassTimer from './ClassTimer';
import { btnSecondary } from './toolsUtils';

const TABS = [
  { key: 'pick', label: 'สุ่มชื่อ' },
  { key: 'group', label: 'แบ่งกลุ่ม' },
  { key: 'timer', label: 'จับเวลา' },
];

const ALL = 'ALL';
const GRADE_KEY = 'kruscan.tools.gradeId';
const CLASS_KEY = 'kruscan.tools.classId';
const readStored = (k) => { try { return window.localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const writeStored = (k, v) => {
  try { if (v === null || v === undefined || v === '') window.localStorage.removeItem(k); else window.localStorage.setItem(k, String(v)); } catch (e) { /* storage ปิดอยู่ */ }
};

const asList = (d) => (Array.isArray(d) ? d : d?.data || d?.classes || []);

const ClassroomTools = () => {
  const [tab, setTab] = useState('pick');
  const [classes, setClasses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [gradeId, setGradeId] = useState(() => readStored(GRADE_KEY) || ALL);
  const [classId, setClassId] = useState(() => readStored(CLASS_KEY) || null);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    let alive = true;
    classAPI.getAll()
      .then((r) => { if (alive) { setClasses(asList(r.data)); setClassesLoaded(true); } })
      .catch((e) => { if (alive) setError(e.response?.data?.error || 'ไม่สามารถโหลดรายชื่อห้องได้'); });
    gradeAPI.getAll()
      .then((r) => { if (alive) setGrades(asList(r.data)); })
      .catch(() => { /* ไม่มีรายชื่อชั้น: ใช้ตัวกรอง "ทุกชั้น" ต่อไป */ });
    return () => { alive = false; };
  }, []);

  const gradeOptions = useMemo(() => [{ id: ALL, gradeName: 'ทุกชั้น' }, ...grades], [grades]);
  const visibleClasses = useMemo(
    () => (gradeId === ALL ? classes : classes.filter((c) => String(c.gradeId) === String(gradeId))),
    [classes, gradeId],
  );
  // ค่าที่จำไว้เป็น string: แปลงกลับเป็น id จริงของห้อง
  const normalizedClassId = useMemo(() => {
    if (!classId) return null;
    const hit = classes.find((c) => String(c.id) === String(classId));
    return hit ? hit.id : null;
  }, [classes, classId]);

  // ห้องปัจจุบันไม่อยู่ในชั้นที่เลือก -> เลือกห้องแรกของชั้นนั้น (หรือล้าง)
  useEffect(() => {
    if (!classesLoaded) return;
    const inView = visibleClasses.some((c) => c.id === normalizedClassId);
    let next = normalizedClassId;
    if (!inView) next = gradeId !== ALL && visibleClasses.length > 0 ? visibleClasses[0].id : null;
    if (next !== classId) setClassId(next);
    writeStored(CLASS_KEY, next);
  }, [classesLoaded, visibleClasses, normalizedClassId, gradeId, classId]);

  const changeGrade = (g) => {
    const next = g || ALL;
    setGradeId(next);
    writeStored(GRADE_KEY, next === ALL ? '' : next);
  };
  const changeClass = (c) => { setClassId(c); writeStored(CLASS_KEY, c); };

  useEffect(() => {
    if (!classId) { setStudents([]); return undefined; }
    let alive = true;
    setLoading(true); setError('');
    classAPI.getStudents(classId)
      .then((r) => {
        if (!alive) return;
        const list = asList(r.data).filter((s) => !s.status || s.status === 'ACTIVE');
        setStudents(list);
      })
      .catch((e) => { if (alive) setError(e.response?.data?.error || 'ไม่สามารถโหลดรายชื่อนักเรียนได้'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [classId]);

  const toggleFullscreen = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen();
    } catch (e) { /* ไม่รองรับ */ }
  }, []);

  const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const cls = classes.find((c) => c.id === classId);
  const needsClass = tab !== 'timer';

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold text-ink-900">เครื่องมือห้องเรียน</h1>
        {canFullscreen && <button type="button" onClick={toggleFullscreen} className={btnSecondary}>เต็มจอ</button>}
      </div>

      <div ref={panelRef} className="space-y-4 bg-ink-50 [&:fullscreen]:p-6 [&:fullscreen]:overflow-auto">
        <div className="flex flex-wrap gap-3 items-end print:hidden">
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto md:flex">
            <div className="min-w-0 md:w-48">
              <label className="block text-sm text-ink-600 mb-1">ชั้นปี</label>
              <SmartComboBox
                options={gradeOptions} value={gradeId} onChange={changeGrade}
                labelKey="gradeName" valueKey="id" placeholder="ทุกชั้น" clearable={false}
              />
            </div>
            <div className="min-w-0 md:w-64">
              <label className="block text-sm text-ink-600 mb-1">ห้องเรียน</label>
              <SmartComboBox
                options={visibleClasses} value={classId} onChange={changeClass}
                labelKey="className" valueKey="id" placeholder="เลือกห้อง" clearable={false}
              />
            </div>
          </div>
          {classId && <p className="text-sm text-ink-500 pb-3">{loading ? 'กำลังโหลด...' : `นักเรียน ${students.length} คน`}</p>}
        </div>

        <div role="tablist" aria-label="เครื่องมือ" className="flex gap-1 border-b border-ink-200 print:hidden">
          {TABS.map((t) => (
            <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`min-h-[44px] flex-1 sm:flex-none px-6 font-semibold border-b-2 -mb-px ${tab === t.key ? 'border-brand text-brand-800' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="rounded-lg bg-red-50 text-red-700 px-4 py-3" role="alert">{error}</p>}

        <div role="tabpanel">
          {needsClass && !classId && <p className="text-ink-500 py-10 text-center">เลือกห้องเรียนก่อน เพื่อโหลดรายชื่อนักเรียน</p>}
          {needsClass && classId && !loading && students.length === 0 && !error && (
            <p className="text-ink-500 py-10 text-center">ห้องนี้ยังไม่มีนักเรียน</p>
          )}
          {tab === 'pick' && classId && students.length > 0 && <RandomPicker students={students} />}
          {tab === 'group' && classId && students.length > 0 && <GroupMaker students={students} className={cls?.className || ''} />}
          {tab === 'timer' && <ClassTimer />}
        </div>
      </div>
    </div>
  );
};

export default ClassroomTools;
