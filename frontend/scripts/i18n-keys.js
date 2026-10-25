// รวบรวมข้อความไทยที่ต้องแปล แล้วบอกว่าแต่ละภาษายังขาดกี่ข้อความ
//   node scripts/i18n-keys.js            สรุปจำนวน
//   node scripts/i18n-keys.js --write    เขียน src/i18n/keys.json (รายการข้อความทั้งหมด)
//   node scripts/i18n-keys.js --missing en   พิมพ์ข้อความที่ภาษา en ยังไม่มีคำแปล (JSON)
// เก็บ: อาร์กิวเมนต์ t('...') + ข้อความไทยทุกตัวในไฟล์หน้าเว็บ (ค่าคงที่ที่เรียก t ตอนแสดงผล) + ข้อความ error จาก server
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');

const ROOT = path.join(__dirname, '..');
const THAI = /[฀-๿]/;
// เอกสารราชการ/ข้อความที่ส่งผู้ปกครอง/ปฏิทิน พ.ศ. คงภาษาไทย (ดู docs/I18N.md)
const SKIP_FE = /(PaperPreview|i18n[\\/])/;
const SKIP_BE = /(docx|Docx|export|Export|rosterImport|thaiDates|seed|prompt|Prompt|ai[A-Z]|tests?[\\/])/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); } else if (/\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

// ข้อความจาก server ที่แทรกค่า `ไม่พบนักเรียนรหัส ${studentCode}` → key "ไม่พบนักเรียนรหัส {studentCode}" (หน้าเว็บจับรูปแบบด้วย tMsg)
const varName = (e) => {
  if (e.type === 'Identifier') return e.name;
  if (e.type === 'MemberExpression' && !e.computed) {
    const obj = e.object.type === 'MemberExpression' && !e.object.computed ? e.object.property.name : '';
    return e.property.name === 'length' && obj ? obj : e.property.name;
  }
  return 'v';
};
function templateKey(n) {
  const used = {};
  return n.quasis.map((q, i) => {
    let s = q.value.cooked || '';
    if (i < n.expressions.length) {
      let name = varName(n.expressions[i]);
      used[name] = (used[name] || 0) + 1;
      if (used[name] > 1) name += used[name];
      s += `{${name}}`;
    }
    return s;
  }).join('');
}

function collect(file, keys, backend) {
  let ast;
  try { ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'], errorRecovery: true }); } catch (e) { console.error('parse', file, e.message); return; }
  const add = (s) => { const v = s.replace(/\s+/g, ' ').trim(); if (v && THAI.test(v)) keys.add(v); };
  const visit = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'StringLiteral') add(n.value);
    else if (n.type === 'JSXText') add(n.value);
    else if (n.type === 'TemplateLiteral' && n.expressions.length === 0) add(n.quasis[0].value.cooked || '');
    else if (n.type === 'TemplateLiteral' && backend && n.quasis.some(q => THAI.test(q.value.cooked || '')) && !n.expressions.some(e => e.type === 'TemplateLiteral' || e.type === 'ConditionalExpression')) add(templateKey(n));
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'comments') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(ast.program);
}

const keys = new Set();
walk(path.join(ROOT, 'src')).filter(f => !SKIP_FE.test(f)).forEach(f => collect(f, keys));
const BE = path.join(ROOT, '..', 'backend');
['controllers', 'middleware', 'routes', 'services'].forEach(d => {
  const dir = path.join(BE, d);
  if (fs.existsSync(dir)) walk(dir).filter(f => !SKIP_BE.test(path.relative(BE, f))).forEach(f => collect(f, keys, true));
});
const list = [...keys].sort();

const LANGS = ['en', 'zh', 'ja', 'ko', 'fr', 'de'];
const arg = process.argv;
if (arg.includes('--write')) fs.writeFileSync(path.join(ROOT, 'src/i18n/keys.json'), JSON.stringify(list, null, 1) + '\n');
const mi = arg.indexOf('--missing');
if (mi > -1) {
  const lang = arg[mi + 1];
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${lang}.json`), 'utf8'));
  process.stdout.write(JSON.stringify(list.filter(k => !dict[k]), null, 1) + '\n');
} else {
  console.log(`ข้อความทั้งหมด ${list.length}`);
  for (const l of LANGS) {
    const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${l}.json`), 'utf8'));
    const missing = list.filter(k => !dict[k]).length;
    const badVars = Object.entries(dict).filter(([k, v]) => {
      const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
      return vars(k) !== vars(v);
    }).length;
    console.log(`${l}: ขาด ${missing}${badVars ? ` · ตัวแปร {..} ไม่ตรง ${badVars}` : ''}`);
  }
}
