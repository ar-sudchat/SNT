// บันทึกหลังแผน: document settings (school name, signers) and the Word export. Contract: docs/LESSON-LOG.md
const prisma = require('../config/database');
const { DEFAULT_SETTINGS, clip } = require('../services/assessmentCore');
const { recordDetail } = require('../services/assessmentRecords');
const { buildDocx } = require('../services/assessmentDocx');

const MAX_IDS = 60;
const MAX_SIGNERS = 6;

function teacherNameOf(user) {
  return (user && ((user.teacher && user.teacher.name) || user.displayName)) || '';
}

// Defaults merged with what the group saved; always { schoolName, signers, teacherName }.
function settingsFrom(tenant, user) {
  const saved = (tenant && tenant.docSettings && typeof tenant.docSettings === 'object') ? tenant.docSettings : {};
  const signers = Array.isArray(saved.signers)
    ? saved.signers.slice(0, MAX_SIGNERS).map(s => ({ role: clip(s && s.role, 120), name: clip(s && s.name, 120) }))
    : DEFAULT_SETTINGS.signers.map(s => ({ ...s }));
  return {
    schoolName: typeof saved.schoolName === 'string' ? saved.schoolName : DEFAULT_SETTINGS.schoolName,
    signers,
    teacherName: teacherNameOf(user),
  };
}

const loadTenant = (req) => prisma.tenant.findUnique({ where: { id: req.user.tid }, select: { id: true, docSettings: true } });

exports.getSettings = async (req, res) => {
  try {
    const tenant = req.user.tid ? await loadTenant(req) : null;
    res.json(settingsFrom(tenant, req.user));
  } catch (error) {
    console.error('assessment getSettings error:', error);
    res.status(500).json({ error: 'โหลดการตั้งค่าเอกสารไม่สำเร็จ' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    if (!req.user.tid) return res.status(400).json({ error: 'ไม่พบกลุ่มที่ใช้งานอยู่' });
    const body = req.body || {};
    if (body.schoolName != null && typeof body.schoolName !== 'string') return res.status(400).json({ error: 'ชื่อโรงเรียนไม่ถูกต้อง' });
    if (body.signers != null && !Array.isArray(body.signers)) return res.status(400).json({ error: 'รายชื่อผู้ลงนามไม่ถูกต้อง' });
    if (String(body.schoolName || '').trim().length > 200) return res.status(400).json({ error: 'ชื่อโรงเรียนยาวเกิน 200 ตัวอักษร' });
    const list = body.signers || [];
    if (list.length > MAX_SIGNERS) return res.status(400).json({ error: `ผู้ลงนามได้ไม่เกิน ${MAX_SIGNERS} คน` });
    for (const s of list) {
      if (!s || typeof s !== 'object') return res.status(400).json({ error: 'รายชื่อผู้ลงนามไม่ถูกต้อง' });
      if (String(s.role || '').trim().length > 120 || String(s.name || '').trim().length > 120) {
        return res.status(400).json({ error: 'ตำแหน่งหรือชื่อผู้ลงนามยาวเกิน 120 ตัวอักษร' });
      }
    }
    const docSettings = {
      schoolName: clip(body.schoolName, 200),
      signers: list.map(s => ({ role: clip(s.role, 120), name: clip(s.name, 120) })),
    };
    const tenant = await prisma.tenant.update({ where: { id: req.user.tid }, data: { docSettings }, select: { id: true, docSettings: true } });
    res.json(settingsFrom(tenant, req.user));
  } catch (error) {
    console.error('assessment updateSettings error:', error);
    res.status(500).json({ error: 'บันทึกการตั้งค่าเอกสารไม่สำเร็จ' });
  }
};

function parseIds(raw) {
  const parts = String(raw == null ? '' : raw).split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length || parts.length > MAX_IDS) return null;
  const ids = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (!Number.isSafeInteger(n) || n < 1 || n > 2147483647) return null;
    if (!ids.includes(n)) ids.push(n);
  }
  return ids;
}

exports.exportDocx = async (req, res) => {
  try {
    const ids = parseIds(req.query.ids);
    if (!ids) return res.status(400).json({ error: `เลือกบันทึกที่จะส่งออก 1–${MAX_IDS} รายการ` });

    const records = [];
    for (const id of ids) {
      const rec = await recordDetail(id, req.user);
      if (!rec) return res.status(404).json({ error: 'ไม่พบบันทึกที่เลือก' });
      records.push(rec);
    }
    const time = (r) => (r.assessedOn ? new Date(r.assessedOn).getTime() : 0);
    records.sort((a, b) => time(a) - time(b) || a.id - b.id);

    const tenant = req.user.tid ? await loadTenant(req) : null;
    const settings = settingsFrom(tenant, req.user);
    const buffer = await buildDocx({ records, settings, teacherNameFor: (r) => r.teacherName || settings.teacherName });

    const className = (records[0].class && records[0].class.className) || '';
    const fileName = `บันทึกหลังแผน-${className}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="lesson-log.docx"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('assessment exportDocx error:', error);
    res.status(500).json({ error: 'ส่งออกไฟล์ Word ไม่สำเร็จ' });
  }
};
