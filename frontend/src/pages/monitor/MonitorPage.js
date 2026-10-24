import React from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import ClassMonitor from './ClassMonitor';
import SubjectMonitor from './SubjectMonitor';

const MODES = [
  { id: 'subject', label: 'รายวิชา' },
  { id: 'class', label: 'รายห้อง' }
];
const CARRY = ['ay', 'grade', 'class', 'subject'];

// หน้าเดียว "ติดตามงาน" สลับ รายวิชา | รายห้อง ด้วย ?mode=
const MonitorPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'class' ? 'class' : 'subject';

  const switchMode = (next) => {
    if (next === mode) return;
    const params = new URLSearchParams();
    params.set('mode', next);
    CARRY.forEach(k => { const v = searchParams.get(k); if (v) params.set(k, v); });
    setSearchParams(params);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ติดตามงาน</h1>
        <div role="tablist" aria-label="มุมมอง" className="inline-flex rounded-lg bg-gray-100 p-1">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => switchMode(m.id)}
              className={`min-h-[40px] min-w-[5.5rem] rounded-md px-4 text-sm font-medium transition ${
                mode === m.id ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'class' ? <ClassMonitor key="class" embedded /> : <SubjectMonitor key="subject" embedded />}
    </div>
  );
};

// /monitor/class/:id? และ /monitor/subject → /monitor?mode=…&พารามิเตอร์เดิม
export const MonitorRedirect = ({ mode }) => {
  const location = useLocation();
  const { id } = useParams();
  const params = new URLSearchParams(location.search);
  if (id && !params.get('class')) params.set('class', id);
  params.set('mode', mode);
  return <Navigate to={`/monitor?${params.toString()}`} replace />;
};

export default MonitorPage;
