// หานักเรียนจาก QR (หรือรหัสนักเรียน) สำหรับเช็คชื่อ · คืน { student, qr } หรือ { status, error }
const prisma = require('../config/database');
const { withoutTenant, getTenantId } = require('./tenantContext');
const { OTHER_SCHOOL_MSG, parsePayload, isForeign } = require('./qrPayload');

const currentSlug = async () => {
  const id = getTenantId();
  if (!id) return null;
  const t = await withoutTenant(() => prisma.tenant.findUnique({ where: { id }, select: { slug: true } }));
  return t && t.slug;
};

async function resolveStudent({ qrcodeData, studentCode }) {
  if (qrcodeData) {
    const parsed = parsePayload(qrcodeData);
    if (!parsed) return { status: 404, error: 'QR code ไม่ถูกต้อง' };
    if (parsed.kind === 'ks1' && isForeign(parsed, await currentSlug())) return { status: 403, error: OTHER_SCHOOL_MSG };
    const qr = await prisma.qRCode.findUnique({ where: { qrcodeData }, include: { student: { include: { class: true } } } });
    if (!qr) return { status: 404, error: 'QR code ไม่ถูกต้อง' };
    if (qr.status === 'INACTIVE') return { status: 400, error: 'QR code นี้ถูกปิดใช้งาน' };
    return { student: qr.student, qr };
  }
  if (studentCode) {
    const code = String(studentCode).trim();
    const student = await prisma.student.findUnique({ where: { studentCode: code }, include: { class: true } });
    if (!student) return { status: 404, error: `ไม่พบนักเรียนรหัส ${code}` };
    return { student, qr: null };
  }
  return { status: 400, error: 'กรุณาสแกน QR หรือระบุรหัสนักเรียน' };
}

module.exports = { resolveStudent };
