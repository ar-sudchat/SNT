// ตรวจการครอบข้อความ t() ทั้งหน้าเว็บ: ตัวแปรชื่อ t ทับฟังก์ชัน · ส่ง JSX เป็นตัวแปรแปล · ข้อความไทยที่ยังไม่ครอบ
//   node scripts/i18n-check.js [ไฟล์...]
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const THAI = /[฀-๿]/;
const SKIP = /(PaperPreview|reminderText|i18n[\\/]|lessonLogCore)/;
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, o); else if (/\.js$/.test(e.name)) o.push(p); } return o; };
const files = process.argv.length > 2 ? process.argv.slice(2) : walk(path.join(__dirname, '../src')).filter(f => !SKIP.test(f));

let total = { shadow: 0, jsx: 0, raw: 0, noImport: 0, dyn: 0 };
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  let ast;
  try { ast = parse(code, { sourceType: 'module', plugins: ['jsx'] }); } catch (e) { console.log(`${f}: PARSE ${e.message}`); continue; }
  const rel = path.relative(path.join(__dirname, '..'), f);
  const out = [];
  let usesT = false;
  const hasImport = ast.program.body.some(n => n.type === 'ImportDeclaration' && /i18n$/.test(n.source.value) && n.specifiers.some(s => s.local.name === 't'));
  traverse(ast, {
    CallExpression(p) {
      if (p.node.callee.type !== 'Identifier' || p.node.callee.name !== 't') return;
      usesT = true;
      const b = p.scope.getBinding('t');
      if (b && b.kind !== 'module') { out.push(`${p.node.loc.start.line}: SHADOW t ถูกตัวแปร ${b.kind} ทับ`); total.shadow++; }
      const [a0, a1] = p.node.arguments;
      if (a0 && !(a0.type === 'StringLiteral' || (a0.type === 'TemplateLiteral' && !a0.expressions.length))) {
        if (a0.type === 'TemplateLiteral') { out.push(`${p.node.loc.start.line}: DYN template literal มี \${} ใน t()`); total.dyn++; }
      }
      if (a1 && a1.type === 'ObjectExpression') {
        p.get('arguments.1').traverse({ JSXElement(q) { out.push(`${q.node.loc.start.line}: JSX ส่งเป็นตัวแปรใน t()`); total.jsx++; q.skip(); }, JSXFragment(q) { out.push(`${q.node.loc.start.line}: JSX ส่งเป็นตัวแปรใน t()`); total.jsx++; q.skip(); } });
      }
    },
    JSXText(p) {
      if (THAI.test(p.node.value)) { out.push(`${p.node.loc.start.line}: RAW "${p.node.value.trim().slice(0, 40)}"`); total.raw++; }
    },
    JSXAttribute(p) {
      const n = p.node.name.name;
      if (['placeholder', 'aria-label', 'title', 'alt', 'label'].includes(n) && p.node.value && p.node.value.type === 'StringLiteral' && THAI.test(p.node.value.value)) {
        out.push(`${p.node.loc.start.line}: RAW ${n}="${p.node.value.value.slice(0, 40)}"`); total.raw++;
      }
    },
  });
  if (usesT && !hasImport) { out.push('NOIMPORT ใช้ t แต่ไม่ได้ import'); total.noImport++; }
  if (out.length) console.log(`\n${rel}\n  ${out.join('\n  ')}`);
}
console.log('\nสรุป', JSON.stringify(total));
