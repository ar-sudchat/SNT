import React, { useLayoutEffect, useRef, useState } from 'react';
import { answerText, maxPoints, outcomeSentence, responseOf, scoreOf } from '../../pages/lessonlog/lessonLogCore';

// หน้ากระดาษตัวอย่างของบันทึกหลังแผน — หน้าตาเหมือนไฟล์ Word ที่จะส่งออก (docs/LESSON-LOG.md "Word export layout")
// วาดที่ความกว้างคงที่ DESIGN_W แล้วย่อตามความกว้างของกล่องที่ใส่ (ไม่ล้นแนวนอน)
// สีเขียนเป็น inline เพื่อให้เป็นกระดาษขาว/หมึกเข้มทั้งธีมสว่างและธีมกลางคืน
const DESIGN_W = 640;
const PAPER = '#fffdf8';
const INK = '#1b1b1b';
const LINE = '#6b6b6b';
const FONT = '"TH SarabunPSK","Sarabun","Noto Serif Thai",serif';

const sheetStyle = {
  width: DESIGN_W, boxSizing: 'border-box', padding: '28px 32px', background: PAPER, color: INK,
  fontFamily: FONT, fontSize: 15, lineHeight: 1.4, boxShadow: '0 6px 18px -8px rgba(0,0,0,.45)', textAlign: 'left'
};
const titleStyle = { textAlign: 'center', fontWeight: 700, fontSize: 19, margin: '0 0 8px' };
const rowStyle = { display: 'flex', justifyContent: 'space-between', gap: 12 };
const headStyle = { fontWeight: 700, marginTop: 8 };
const cell = { border: `1px solid ${LINE}`, padding: '1px 2px', textAlign: 'center', fontSize: 11, lineHeight: 1.25, overflow: 'hidden' };

const dots = '.................';

function NoteSheet({ record, settings }) {
  const h = record.header || {};
  const note = record.note || {};
  const problems = (note.problems || []).filter(Boolean);
  const fixes = [...(note.fixes || []).filter(Boolean), ...(note.extra ? [note.extra] : [])];
  const signers = settings?.signers || [];
  return (
    <>
      <div style={titleStyle}>แบบบันทึกผลหลังการสอน</div>
      <div style={rowStyle}>
        <span>แผนการจัดการเรียนรู้ที่ {h.planNo} {record.name}</span>
        <span>วิชา {record.subject?.subjectName || ''}</span>
      </div>
      <div>หน่วยที่ {h.unitNo} ชื่อหน่วย {h.unitName}</div>
      <div style={rowStyle}>
        <span>ระดับชั้น {record.class?.className || ''}</span>
        <span>วัน/เดือน/ปีที่สอน {record.dateText || ''}</span>
      </div>

      <div style={headStyle}>ผลการเรียนรู้</div>
      <div style={{ textIndent: 24 }}>{outcomeSentence(record.name, note)}</div>

      <div style={headStyle}>ปัญหา / อุปสรรค</div>
      {problems.length ? problems.map((p, i) => <div key={i} style={{ textIndent: 24 }}>{p}</div>) : <div style={{ textIndent: 24 }}>-</div>}

      <div style={headStyle}>ข้อเสนอแนะ / แนวทางแก้ไข</div>
      {fixes.length ? fixes.map((p, i) => <div key={i} style={{ textIndent: 24 }}>{i + 1}. {p}</div>) : <div style={{ textIndent: 24 }}>-</div>}

      <div style={{ marginTop: 22, marginLeft: '50%', textAlign: 'center' }}>
        <div>ลงชื่อ{dots}ครูผู้สอน</div>
        <div>({settings?.teacherName || ' '})</div>
      </div>

      <div style={{ marginTop: 16, textIndent: 24 }}>บันทึกหลังการสอน ตามแผนการจัดการเรียนรู้ฉบับนี้ ได้รับการพิจารณาแล้ว</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 12px', marginTop: 12, textAlign: 'center' }}>
        {signers.map((s, i) => (
          <div key={i}>
            <div>ลงชื่อ{dots}</div>
            <div>({s.name || ' '})</div>
            <div>{s.role}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ช่วงคะแนนของแต่ละระดับ (ตามกฎเดียวกับ scoreOf) — ผ่าน/ไม่ผ่าน และเช็ก ✓ นับเป็นข้อละ 1 คะแนน
function levelRanges(record) {
  const n = (record.criteria || []).length;
  const max = responseOf(record) === 'SCORE' ? (record.maxScore || 0) : 1;
  const levels = [...(record.levels || [])].sort((a, b) => Number(b.min) - Number(a.min));
  const top = record.useAverage ? max : n * max;
  let prevLo = null;
  return levels.map((l) => {
    const raw = Number(l.min) * (record.useAverage ? max : n * max);
    const lo = record.useAverage ? Math.round(raw * 100) / 100 : Math.ceil(raw - 1e-9);
    let text;
    if (prevLo === null) text = `${lo} - ${top}`;
    else if (record.useAverage) text = `${lo} - ต่ำกว่า ${prevLo}`;
    else text = prevLo - 1 <= lo ? `${lo}` : `${lo} - ${prevLo - 1}`;
    prevLo = lo;
    return { text, label: l.label };
  });
}

// คำถามระดับห้อง: ชื่อคำถามตัวหนา แล้วคำตอบ (รายการตัวเลือกแสดง ☑/☐)
function ClassAnswers({ record }) {
  const fields = record.classFields || [];
  if (!fields.length) return null;
  const answers = record.classAnswers || {};
  return (
    <div style={{ marginBottom: 8 }}>
      {fields.map((f, i) => {
        const v = answers[f.key];
        let body;
        if (f.type === 'checklist') {
          const chosen = Array.isArray(v) ? v : [];
          const opts = f.options || [];
          body = opts.length
            ? opts.map((o, k) => <div key={k} style={{ textIndent: 24 }}>{chosen.includes(o) ? '☑' : '☐'} {o}</div>)
            : <div style={{ textIndent: 24 }}>-</div>;
        } else {
          const text = v == null ? '' : String(v).trim();
          body = <div style={{ textIndent: 24, whiteSpace: 'pre-wrap' }}>{text || '-'}</div>;
        }
        return (
          <div key={f.key || i} style={{ marginTop: i ? 6 : 0 }}>
            <div style={{ fontWeight: 700 }}>{f.label}</div>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function ClassSheet({ record, settings }) {
  return (
    <>
      <div style={titleStyle}>{record.templateName}</div>
      <div style={rowStyle}>
        <span>เรื่อง {record.name}</span>
        <span>วันที่ {record.dateText || ''}</span>
      </div>
      <div style={{ ...rowStyle, marginBottom: 8 }}>
        <span>ระดับชั้น {record.class?.className || ''}</span>
        <span>วิชา {record.subject?.subjectName || ''}</span>
      </div>
      <ClassAnswers record={record} />
      <div style={{ marginTop: 22, marginLeft: '50%', textAlign: 'center' }}>
        <div>ลงชื่อ{dots}ผู้บันทึก</div>
        <div>({settings?.teacherName || ' '})</div>
      </div>
    </>
  );
}

// คอลัมน์ย่อยของแต่ละข้อ ตามวิธีตอบ: SCORE max..1 · PASSFAIL ผ่าน|ไม่ผ่าน · CHECK/TEXT คอลัมน์เดียว (ไม่มีแถวย่อย)
function subColumns(record) {
  const t = responseOf(record);
  if (t === 'PASSFAIL') return [{ label: 'ผ่าน', v: 2 }, { label: 'ไม่ผ่าน', v: 1 }];
  if (t === 'SCORE') {
    const max = record.maxScore || 1;
    return Array.from({ length: max }, (_, k) => ({ label: String(max - k), v: max - k }));
  }
  return null;
}

function RubricSheet({ record, settings }) {
  const criteria = record.criteria || [];
  const t = responseOf(record);
  const subs = subColumns(record);
  const per = subs ? subs.length : 1;
  const students = record.students || [];
  const hasTotal = maxPoints(record) > 0;
  const hasLevels = (record.levels || []).length > 0;
  const ranges = hasTotal && hasLevels ? levelRanges(record) : [];
  const nameW = t === 'TEXT' ? 16 : 22;
  const subCols = Math.max(1, criteria.length * per);
  const subW = `${(100 - 4 - nameW - (hasTotal ? 7 : 0) - (hasLevels ? 11 : 0)) / subCols}%`;
  const colCount = 2 + criteria.length * per + (hasTotal ? 1 : 0) + (hasLevels ? 1 : 0);
  const textCell = { ...cell, whiteSpace: 'normal', overflowWrap: 'anywhere', padding: '1px 3px' };
  return (
    <>
      <div style={titleStyle}>{record.templateName}</div>
      <div style={rowStyle}>
        <span>ชื่อกิจกรรม {record.name}</span>
        <span>ประเมิน วันที่ {record.dateText || ''}</span>
      </div>
      <div style={{ ...rowStyle, marginBottom: 6 }}>
        <span>ระดับชั้น {record.class?.className || ''}</span>
        <span>วิชา {record.subject?.subjectName || ''}</span>
      </div>

      <ClassAnswers record={record} />

      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', fontVariantNumeric: 'tabular-nums' }}>
        <colgroup>
          <col style={{ width: '4%' }} />
          <col style={{ width: `${nameW}%` }} />
          {criteria.map((c, i) => Array.from({ length: per }, (_, k) => <col key={`${i}-${k}`} style={{ width: subW }} />))}
          {hasTotal && <col style={{ width: '7%' }} />}
          {hasLevels && <col style={{ width: '11%' }} />}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} style={cell}>ที่</th>
            <th rowSpan={2} style={cell}>ชื่อ-สกุล</th>
            {criteria.map((c, i) => (
              <th key={i} colSpan={per} rowSpan={subs ? 1 : 2} style={{ ...cell, fontWeight: 700 }}>{c.label}</th>
            ))}
            {hasTotal && <th rowSpan={2} style={cell}>{record.useAverage ? 'เฉลี่ย' : 'รวม'}</th>}
            {hasLevels && <th rowSpan={2} style={cell}>ระดับคุณภาพ</th>}
          </tr>
          <tr>
            {subs && criteria.map((c, i) => subs.map((sc) => <th key={`${i}-${sc.v}`} style={cell}>{sc.label}</th>))}
          </tr>
        </thead>
        <tbody>
          {students.map((s, idx) => {
            const sc = scoreOf(record, s.values);
            return (
              <tr key={s.id}>
                <td style={cell}>{s.studentNumber ?? idx + 1}</td>
                <td style={{ ...cell, textAlign: 'left', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '1px 3px' }}>{s.name}</td>
                {criteria.map((c, i) => {
                  const v = (s.values || [])[i];
                  if (subs) {
                    // SCORE: ✓ ในช่องคะแนนที่เลือก · PASSFAIL: ✓ ในผ่าน (2) หรือไม่ผ่าน (อย่างอื่น)
                    return subs.map((x) => {
                      const on = t === 'PASSFAIL' ? (v === 2) === (x.v === 2) : v === x.v;
                      return <td key={`${i}-${x.v}`} style={cell}>{on ? '✓' : ''}</td>;
                    });
                  }
                  if (t === 'CHECK') return <td key={i} style={cell}>{v === 1 ? '✓' : ''}</td>;
                  return <td key={i} style={textCell}>{v == null ? '' : answerText(record, v)}</td>;
                })}
                {hasTotal && <td style={cell}>{record.useAverage ? sc.average.toFixed(2) : sc.total}</td>}
                {hasLevels && <td style={cell}>{sc.level}</td>}
              </tr>
            );
          })}
          {!students.length && (
            <tr><td style={cell} colSpan={colCount}>ยังไม่มีรายชื่อนักเรียน</td></tr>
          )}
        </tbody>
      </table>

      {ranges.length > 0 && (
        <table style={{ borderCollapse: 'collapse', marginTop: 14, fontSize: 12 }}>
          <tbody>
            <tr>
              <td style={{ ...cell, fontSize: 12, padding: '1px 8px', textAlign: 'left' }}>ช่วงคะแนน</td>
              {ranges.map((r, i) => <td key={i} style={{ ...cell, fontSize: 12, padding: '1px 8px' }}>{r.text}</td>)}
            </tr>
            <tr>
              <td style={{ ...cell, fontSize: 12, padding: '1px 8px', textAlign: 'left' }}>ระดับคุณภาพ</td>
              {ranges.map((r, i) => <td key={i} style={{ ...cell, fontSize: 12, padding: '1px 8px' }}>{r.label}</td>)}
            </tr>
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 22, marginLeft: '50%', textAlign: 'center' }}>
        <div>ลงชื่อ{dots}ผู้ประเมิน</div>
        <div>({settings?.teacherName || ' '})</div>
      </div>
    </>
  );
}

export default function PaperPreview({ record, settings, scale }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [box, setBox] = useState({ w: DESIGN_W, h: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const o = outerRef.current;
      const i = innerRef.current;
      if (!o || !i) return;
      setBox((b) => (b.w === o.clientWidth && b.h === i.offsetHeight ? b : { w: o.clientWidth, h: i.offsetHeight }));
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(outerRef.current);
      ro.observe(innerRef.current);
    } else {
      window.addEventListener('resize', measure);
    }
    return () => (ro ? ro.disconnect() : window.removeEventListener('resize', measure));
  }, []);

  if (!record) return null;
  const k = Math.max(0.1, Math.min(scale || 1, (box.w || DESIGN_W) / DESIGN_W));
  const offset = Math.max(0, (box.w - DESIGN_W * k) / 2);

  return (
    <div
      ref={outerRef}
      role="group"
      aria-label="ตัวอย่างหน้ากระดาษ"
      style={{ width: '100%', height: box.h ? box.h * k : undefined, overflow: 'hidden', position: 'relative' }}
    >
      <div ref={innerRef} style={{ position: 'absolute', top: 0, left: 0, width: DESIGN_W, transformOrigin: '0 0', transform: `translateX(${offset}px) scale(${k})` }}>
        <div style={sheetStyle}>
          {record.kind === 'RUBRIC' && <RubricSheet record={record} settings={settings} />}
          {record.kind === 'CLASS' && <ClassSheet record={record} settings={settings} />}
          {record.kind !== 'RUBRIC' && record.kind !== 'CLASS' && <NoteSheet record={record} settings={settings} />}
        </div>
      </div>
    </div>
  );
}
