import React, { useState, useMemo } from 'react';
import { shuffle, btnPrimary, btnSecondary } from './toolsUtils';

const GroupMaker = ({ students, className = '' }) => {
  const [mode, setMode] = useState('count'); // count | size
  const [n, setN] = useState(4);
  const [groups, setGroups] = useState([]);
  const [copied, setCopied] = useState('');

  const total = students.length;
  const groupCount = useMemo(() => {
    const v = Math.max(1, Number(n) || 1);
    return mode === 'count' ? Math.min(v, Math.max(total, 1)) : Math.max(1, Math.ceil(total / v));
  }, [mode, n, total]);

  const make = () => {
    if (total === 0) return;
    const list = shuffle(students);
    const out = Array.from({ length: groupCount }, () => []);
    list.forEach((s, i) => out[i % groupCount].push(s));
    setGroups(out);
    setCopied('');
  };

  const asText = () =>
    groups.map((g, i) => `กลุ่ม ${i + 1}\n${g.map((s) => `- ${s.name}`).join('\n')}`).join('\n\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      setCopied('คัดลอกแล้ว');
    } catch (e) {
      setCopied('คัดลอกไม่ได้ ลองเลือกข้อความเอง');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ink-200 bg-white p-4 flex flex-wrap items-end gap-3 print:hidden">
        <div role="group" aria-label="วิธีแบ่ง" className="flex rounded-lg border border-ink-200 overflow-hidden">
          {[['count', 'ตามจำนวนกลุ่ม'], ['size', 'ตามคนต่อกลุ่ม']].map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={mode === k}
              onClick={() => setMode(k)}
              className={`min-h-[44px] px-4 text-sm font-medium ${mode === k ? 'bg-brand-50 text-brand-800' : 'bg-white text-ink-600 hover:bg-ink-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex flex-col text-sm text-ink-600">
          {mode === 'count' ? 'จำนวนกลุ่ม' : 'คนต่อกลุ่ม'}
          <input
            type="number" min="1" max={Math.max(total, 1)} inputMode="numeric" value={n}
            onChange={(e) => setN(e.target.value)}
            className="mt-1 min-h-[44px] w-28 rounded-lg border border-ink-200 px-3 text-lg text-ink-900"
          />
        </label>
        <button type="button" onClick={make} disabled={total === 0} className={btnPrimary}>
          {groups.length ? 'สุ่มใหม่' : 'แบ่งกลุ่ม'}
        </button>
        <span className="text-sm text-ink-500">จะได้ {groupCount} กลุ่ม จาก {total} คน</span>
      </div>

      {groups.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={copy} className={btnSecondary}>คัดลอกเป็นข้อความ</button>
            <button type="button" onClick={() => window.print()} className={btnSecondary}>พิมพ์</button>
            {copied && <span className="self-center text-sm text-ink-600" role="status">{copied}</span>}
          </div>
          <h2 className="hidden print:block text-xl font-bold">แบ่งกลุ่ม {className}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {groups.map((g, i) => (
              <section key={i} className="rounded-xl border border-ink-200 bg-white p-4 break-inside-avoid">
                <h3 className="font-bold text-brand-800 mb-2 text-lg">กลุ่ม {i + 1} <span className="text-sm font-normal text-ink-500">({g.length} คน)</span></h3>
                <ul className="space-y-1 text-ink-800 text-base lg:text-lg">
                  {g.map((s) => <li key={s.id}>{s.name}</li>)}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default GroupMaker;
