// บันทึกหลังแผน: build the Word file (A4, TH SarabunPSK 16pt). Layout: docs/LESSON-LOG.md "Word export layout".
// Pure: takes RecordDetail-like objects, returns a Buffer. No database access.
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, VerticalAlign, PageOrientation, TableLayoutType,
} = require('docx');

const { responseOf } = require('./assessmentCore');

const FONT = 'TH SarabunPSK';
const SYMBOL_FONT = 'Segoe UI Symbol';
const BODY = 32;   // half-points = 16pt
const TITLE = 36;  // 18pt
const CELL = 28;   // 14pt (table text)

const CM = 567; // twips per cm
const MARGIN = Math.round(2 * CM);
const A4 = { w: 11906, h: 16838 };

const fontOf = (name) => ({ ascii: name, hAnsi: name, cs: name, eastAsia: name });
const run = (text, o = {}) => new TextRun({
  text: String(text == null ? '' : text), font: fontOf(FONT), size: BODY, sizeComplexScript: BODY,
  bold: !!o.bold, boldComplexScript: !!o.bold, ...o.extra,
});

const para = (children, o = {}) => new Paragraph({
  alignment: o.align || AlignmentType.LEFT,
  spacing: { before: o.before || 0, after: o.after == null ? 60 : o.after },
  indent: o.indent,
  keepNext: !!o.keepNext,
  children: Array.isArray(children) ? children : [children],
});

const text = (t, o = {}) => para(run(t, o), o);
const DOTS = '.................';

// ---------- level ranges ----------

const fmt2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

// Rows [{ range, label }] from the record's levels. Points mode: integer total ranges over criteria x maxScore;
// average mode: per-criterion average ranges with 2 decimals. The top level is lo..max, the last is "ต่ำกว่า lo".
function levelRanges({ levels, criteriaCount, maxScore, useAverage }) {
  const n = Number(criteriaCount) || 0;
  const m = Number(maxScore) || 0;
  const points = n * m;
  const sorted = [...(levels || [])].sort((a, b) => Number(b.min) - Number(a.min));
  if (!sorted.length || !points) return [];
  // total >= ratio*points  <=>  total >= ceil(ratio*points)  (same 1e-9 slack as scoreOf)
  const lows = sorted.map(l => Math.min(points, Math.max(0, Math.ceil(Number(l.min) * points - 1e-9))));
  const show = (v) => (useAverage ? fmt2(v / n) : String(v));
  return sorted.map((l, i) => {
    const lo = lows[i];
    const hi = i === 0 ? points : lows[i - 1] - 1;
    let range;
    if (lo === 0 && i > 0) range = `ต่ำกว่า ${show(lows[i - 1])}`;
    else if (hi < lo) range = '-';
    else if (hi === lo) range = show(lo);
    else range = `${show(lo)} – ${show(hi)}`;
    return { range, label: l.label };
  });
}

// ---------- tables ----------

const THIN = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };

function cell(content, width, o = {}) {
  const t = content == null ? '' : String(content);
  const size = o.size || CELL;
  const runs = o.runs || [new TextRun({
    text: t, font: fontOf(FONT), size, sizeComplexScript: size, bold: !!o.bold, boldComplexScript: !!o.bold,
  })];
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: o.span,
    rowSpan: o.rowSpan,
    shading: o.fill ? { fill: o.fill, type: 'clear', color: 'auto' } : undefined,
    margins: { top: 20, bottom: 20, left: 60, right: 60 },
    children: [new Paragraph({
      alignment: o.align || AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: runs,
    })],
  });
}

const checkRun = () => new TextRun({
  text: '✓', font: fontOf(SYMBOL_FONT), size: CELL, sizeComplexScript: CELL, bold: true,
});

const HEAD_FILL = 'EDEDED';

// Student table. Columns by response type:
//   SCORE    per criterion a merged header with maxScore sub-columns (max..1), ✓ in the chosen one
//   PASSFAIL per criterion a merged header with two sub-columns ผ่าน | ไม่ผ่าน (value 2 / 1)
//   CHECK    one column per criterion, ✓ when 1
//   TEXT     one column per criterion with the typed text
// รวม/เฉลี่ย only when the type has points (not TEXT); ระดับคุณภาพ only when levels exist.
function rubricTable(rec, contentWidth) {
  const t = responseOf(rec);
  const crit = rec.criteria || [];
  const n = crit.length;
  const m = Number(rec.maxScore) || 1;
  const per = t === 'SCORE' ? m : t === 'PASSFAIL' ? 2 : 1; // data columns per criterion
  const hasPoints = t !== 'TEXT';
  const hasLevel = hasPoints && (rec.levels || []).length > 0;
  const grouped = per > 1; // two header rows with merged criterion cells
  const wNo = 520, wTotal = hasPoints ? 760 : 0, wLevel = hasLevel ? (t === 'SCORE' ? 1100 : 1300) : 0;
  const wName = Math.min(2900, Math.max(2200, Math.round(contentWidth * 0.26)));
  const avail = contentWidth - wNo - wName - wTotal - wLevel;
  let sub; // width of one data column
  if (t === 'SCORE') sub = Math.max(150, Math.min(440, Math.floor(avail / Math.max(1, n * m))));
  else if (t === 'PASSFAIL') sub = Math.max(400, Math.min(800, Math.floor(avail / Math.max(1, n * 2))));
  else if (t === 'CHECK') sub = Math.max(500, Math.min(1400, Math.floor(avail / Math.max(1, n))));
  else sub = Math.max(900, Math.min(3000, Math.floor(avail / Math.max(1, n))));
  const span = sub * per;
  const rest = contentWidth - wNo - wTotal - sub * n * per; // name column + level column
  const wLevelCol = hasLevel ? Math.max(wLevel, rest - wName) : 0;
  const wNameCol = rest - wLevelCol;
  const longHeader = span >= 1500;
  const columnWidths = [wNo, wNameCol, ...Array(n * per).fill(sub), ...(hasPoints ? [wTotal] : []), ...(hasLevel ? [wLevelCol] : [])];
  const rowSpan = grouped ? 2 : undefined;
  const headSize = span < 700 ? 24 : CELL;

  const head1 = new TableRow({
    tableHeader: true, cantSplit: true,
    children: [
      cell('ที่', wNo, { rowSpan, bold: true, fill: HEAD_FILL }),
      cell('ชื่อ-สกุล', wNameCol, { rowSpan, bold: true, fill: HEAD_FILL }),
      ...crit.map(c => cell(longHeader ? c.label : (c.short || c.label), span, { span: grouped ? per : undefined, bold: true, fill: HEAD_FILL, size: headSize })),
      ...(hasPoints ? [cell(t === 'SCORE' && rec.useAverage ? 'เฉลี่ย' : 'รวม', wTotal, { rowSpan, bold: true, fill: HEAD_FILL })] : []),
      ...(hasLevel ? [cell('ระดับคุณภาพ', wLevelCol, { rowSpan, bold: true, fill: HEAD_FILL })] : []),
    ],
  });
  const headRows = [head1];
  if (grouped) {
    headRows.push(new TableRow({
      tableHeader: true, cantSplit: true,
      children: crit.flatMap(() => (t === 'PASSFAIL'
        ? [cell('ผ่าน', sub, { size: 20, fill: HEAD_FILL }), cell('ไม่ผ่าน', sub, { size: 20, fill: HEAD_FILL })]
        : Array.from({ length: m }, (_, k) => cell(m - k, sub, { size: 24, fill: HEAD_FILL })))),
    }));
  }

  const dataCells = (vals) => crit.flatMap((_, ci) => {
    const v = vals[ci];
    if (t === 'SCORE') return Array.from({ length: m }, (__, k) => (v === m - k ? cell('', sub, { runs: [checkRun()] }) : cell('', sub)));
    if (t === 'PASSFAIL') return [v === 2, v === 1].map(on => (on ? cell('', sub, { runs: [checkRun()] }) : cell('', sub)));
    if (t === 'CHECK') return [Number(v) === 1 ? cell('', sub, { runs: [checkRun()] }) : cell('', sub)];
    return [cell(v == null ? '' : v, sub, { align: AlignmentType.LEFT, size: 24 })];
  });

  const rows = (rec.students || []).map((s, idx) => new TableRow({
    cantSplit: true,
    children: [
      cell(s.studentNumber != null ? s.studentNumber : idx + 1, wNo),
      cell(s.name, wNameCol, { align: AlignmentType.LEFT }),
      ...dataCells(s.values || []),
      ...(hasPoints ? [cell(t === 'SCORE' && rec.useAverage ? fmt2(s.average) : s.total, wTotal)] : []),
      ...(hasLevel ? [cell(s.level, wLevelCol)] : []),
    ],
  }));

  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    rows: [...headRows, ...rows],
  });
}

function levelTable(rec) {
  const t = responseOf(rec);
  if (t === 'TEXT') return [];
  // PASSFAIL/CHECK score 1 point per ผ่าน / ✓, so the ranges run over criteria x 1.
  const ranges = levelRanges({
    levels: rec.levels, criteriaCount: (rec.criteria || []).length, maxScore: t === 'SCORE' ? rec.maxScore : 1,
    useAverage: t === 'SCORE' && rec.useAverage,
  });
  if (!ranges.length) return [];
  const w1 = 2400, w2 = 2400;
  const table = new Table({
    width: { size: w1 + w2, type: WidthType.DXA },
    columnWidths: [w1, w2],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ cantSplit: true, children: [
        cell(t === 'SCORE' && rec.useAverage ? 'ช่วงคะแนนเฉลี่ย' : 'ช่วงคะแนน', w1, { bold: true, fill: HEAD_FILL }),
        cell('ระดับคุณภาพ', w2, { bold: true, fill: HEAD_FILL }),
      ] }),
      ...ranges.map(r => new TableRow({ cantSplit: true, children: [cell(r.range, w1), cell(r.label, w2)] })),
    ],
  });
  return [text('เกณฑ์การให้ระดับคุณภาพ', { bold: true, before: 200, after: 60, keepNext: true }), table];
}

// ---------- signature blocks ----------

const SIG_INDENT = { left: 4300 };
const nameLine = (name) => `(${name ? name : '..........................................'})`;

function signatureParagraphs(roleLabel, name, { before = 360, centerIndent = SIG_INDENT } = {}) {
  return [
    para(run(`ลงชื่อ${DOTS}${roleLabel}`), { before, after: 0, indent: centerIndent, keepNext: true }),
    para(run(nameLine(name)), { after: 60, indent: { left: centerIndent.left + 700 } }),
  ];
}

// ---------- record bodies ----------

const subjectName = (rec) => (rec.subject && rec.subject.subjectName) || '';
const className = (rec) => (rec.class && rec.class.className) || '';

function noteBody(rec, { settings, teacherName }) {
  const h = rec.header || {};
  const note = rec.note || {};
  const out = [];
  out.push(para(new TextRun({
    text: 'แบบบันทึกผลหลังการสอน', font: fontOf(FONT), size: TITLE, sizeComplexScript: TITLE, bold: true, boldComplexScript: true,
  }), { align: AlignmentType.CENTER, after: 120 }));
  out.push(text(`แผนการจัดการเรียนรู้ที่ ${h.planNo || DOTS} ${rec.name || ''}   วิชา ${subjectName(rec) || DOTS}`));
  out.push(text(`หน่วยที่ ${h.unitNo || DOTS} ชื่อหน่วย ${h.unitName || DOTS}`));
  out.push(text(`ระดับชั้น ${className(rec) || DOTS}   วัน/เดือน/ปีที่สอน ${rec.dateText || DOTS}`, { after: 160 }));

  out.push(text('ผลการเรียนรู้', { bold: true, keepNext: true }));
  const outcome = `นักเรียนได้เรียนรู้เกี่ยวกับ${rec.name || ''} โดยนักเรียนร้อยละ ${note.pct != null ? note.pct : 0} สามารถ${note.outcome || ''}`;
  out.push(text(outcome, { indent: { left: 567 }, after: 140 }));

  out.push(text('ปัญหา อุปสรรค', { bold: true, keepNext: true }));
  const problems = (note.problems || []).filter(Boolean);
  if (problems.length) problems.forEach(p => out.push(text(p, { indent: { left: 567 } })));
  else out.push(text('-', { indent: { left: 567 } }));

  out.push(text('ข้อเสนอแนะ แนวทางแก้ไข', { bold: true, keepNext: true, before: 140 }));
  const fixes = (note.fixes || []).filter(Boolean);
  fixes.forEach((f, i) => out.push(text(`${i + 1}. ${f}`, { indent: { left: 567 } })));
  if (note.extra) out.push(text(note.extra, { indent: { left: 567 } }));
  if (!fixes.length && !note.extra) out.push(text('-', { indent: { left: 567 } }));

  out.push(...signatureParagraphs('ครูผู้สอน', teacherName, { before: 320 }));

  out.push(text('บันทึกหลังการสอน ตามแผนการจัดการเรียนรู้ฉบับนี้ ได้รับการพิจารณาแล้ว', { before: 200, after: 0, keepNext: true }));
  (settings.signers || []).forEach(s => {
    const lines = [`ลงชื่อ${DOTS}`, nameLine(s.name), s.role || ''].filter((l, i) => i < 2 || l);
    out.push(new Paragraph({
      keepLines: true, spacing: { before: 220, after: 0 }, indent: SIG_INDENT,
      children: lines.map((l, i) => new TextRun({
        text: l, font: fontOf(FONT), size: BODY, sizeComplexScript: BODY, break: i ? 1 : 0,
      })),
    }));
  });
  return out;
}

const SYMBOL_RUN = (t, o = {}) => new TextRun({
  text: t, font: fontOf(SYMBOL_FONT), size: BODY, sizeComplexScript: BODY, ...o,
});

// One class question: bold label line, then the answer indented ("-" when empty).
function classAnswerParagraphs(f, answers) {
  const v = answers ? answers[f.key] : undefined;
  const indent = { left: 567 };
  const out = [text(f.label, { bold: true, keepNext: true, after: 20 })];
  if (f.type === 'checklist') {
    const picked = Array.isArray(v) ? v : [];
    const opts = f.options || [];
    if (!picked.length || !opts.length) { out.push(text('-', { indent, after: 100 })); return out; }
    const runs = [];
    opts.forEach((o, i) => {
      runs.push(SYMBOL_RUN(picked.includes(o) ? '☑' : '☐'));
      runs.push(run(` ${o}${i < opts.length - 1 ? '    ' : ''}`));
    });
    out.push(para(runs, { indent, after: 100 }));
    return out;
  }
  const str = v === undefined || v === null ? '' : String(v);
  if (!str.trim()) { out.push(text('-', { indent, after: 100 })); return out; }
  if (f.type === 'longtext') {
    const lines = str.split(/\r?\n/);
    out.push(para(lines.map((l, i) => new TextRun({
      text: l, font: fontOf(FONT), size: BODY, sizeComplexScript: BODY, break: i ? 1 : 0,
    })), { indent, after: 100 }));
  } else out.push(text(str, { indent, after: 100 }));
  return out;
}

function classSection(rec) {
  const fields = rec.classFields || [];
  if (!fields.length) return [];
  return fields.flatMap(f => classAnswerParagraphs(f, rec.classAnswers));
}

const titleP = (t) => para(new TextRun({
  text: t || '', font: fontOf(FONT), size: TITLE, sizeComplexScript: TITLE, bold: true, boldComplexScript: true,
}), { align: AlignmentType.CENTER, after: 120 });

function classBody(rec, { teacherName }) {
  const out = [titleP(rec.templateName)];
  out.push(text(`เรื่อง ${rec.name || ''}   วันที่ ${rec.dateText || DOTS}`));
  out.push(text(`ระดับชั้น ${className(rec) || DOTS}   วิชา ${subjectName(rec) || DOTS}`, { after: 140 }));
  out.push(...classSection(rec));
  out.push(...signatureParagraphs('ผู้บันทึก', teacherName, { before: 400 }));
  return out;
}

function rubricBody(rec, { teacherName, contentWidth }) {
  const out = [titleP(rec.templateName)];
  out.push(text(`ชื่อกิจกรรม ${rec.name || ''}   ประเมิน วันที่ ${rec.dateText || DOTS}`));
  out.push(text(`ระดับชั้น ${className(rec) || DOTS}   วิชา ${subjectName(rec) || DOTS}`, { after: 140 }));
  const cls = classSection(rec);
  out.push(...cls);
  if (cls.length) out.push(text('', { after: 60 }));
  out.push(rubricTable(rec, contentWidth));
  out.push(...levelTable(rec));
  out.push(...signatureParagraphs('ผู้ประเมิน', teacherName, { before: 400 }));
  return out;
}

// A student table is landscape when it would be cramped on portrait. Decided by the number of data columns:
// SCORE > 20 sub-columns, PASSFAIL > 8, CHECK > 8 criteria, TEXT > 3 criteria. CLASS records are always portrait.
function needsLandscape(rec) {
  if (rec.kind !== 'RUBRIC') return false;
  const t = responseOf(rec);
  const n = (rec.criteria || []).length;
  if (t === 'SCORE') return n * (Number(rec.maxScore) || 1) > 20;
  if (t === 'PASSFAIL') return n * 2 > 8;
  if (t === 'CHECK') return n > 8;
  return n > 3;
}

/**
 * buildDocx({ records, settings, teacherNameFor }) -> Promise<Buffer>
 * records: RecordDetail[] (already sorted); settings: { schoolName, signers };
 * teacherNameFor(record) -> printed teacher name (optional, falls back to settings.teacherName).
 */
async function buildDocx({ records, settings = {}, teacherNameFor }) {
  const cfg = { schoolName: settings.schoolName || '', signers: Array.isArray(settings.signers) ? settings.signers : [] };
  const sections = (records || []).map((rec) => {
    const landscape = needsLandscape(rec);
    const pageW = landscape ? A4.h : A4.w;
    const contentWidth = pageW - 2 * MARGIN;
    const teacherName = (teacherNameFor ? teacherNameFor(rec) : rec.teacherName) || settings.teacherName || '';
    const children = rec.kind === 'NOTE' ? noteBody(rec, { settings: cfg, teacherName })
      : rec.kind === 'CLASS' ? classBody(rec, { teacherName })
      : rubricBody(rec, { teacherName, contentWidth });
    return {
      properties: {
        page: {
          size: { width: A4.w, height: A4.h, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      children,
    };
  });
  if (!sections.length) sections.push({ children: [new Paragraph({ children: [run('ไม่มีข้อมูล')] })] });

  const doc = new Document({
    creator: 'KruScan',
    title: 'บันทึกหลังแผน',
    styles: {
      default: {
        document: {
          run: { font: fontOf(FONT), size: BODY, sizeComplexScript: BODY, language: { value: 'th-TH', bidirectional: 'th-TH' } },
        },
      },
    },
    sections,
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildDocx, levelRanges, FONT };
