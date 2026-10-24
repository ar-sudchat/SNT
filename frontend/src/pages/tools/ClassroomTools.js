import React, { useState, useEffect, useRef, useCallback } from 'react';
import { classAPI } from '../../services/api';
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

const asList = (d) => (Array.isArray(d) ? d : d?.data || d?.classes || []);

const ClassroomTools = () => {
  const [tab, setTab] = useState('pick');
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    let alive = true;
    classAPI.getAll()
      .then((r) => { if (alive) setClasses(asList(r.data)); })
      .catch((e) => { if (alive) setError(e.response?.data?.error || 'ไม่สามารถโหลดรายชื่อห้องได้'); });
    return () => { alive = false; };
  }, []);

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
          <div className="w-full sm:w-72">
            <label className="block text-sm text-ink-600 mb-1">ห้องเรียน</label>
            <SmartComboBox
              options={classes} value={classId} onChange={setClassId}
              labelKey="className" valueKey="id" placeholder="เลือกห้อง" clearable={false}
            />
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
