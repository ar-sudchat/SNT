// Plan definitions as data. null = unlimited. Values follow docs/SAAS-DESIGN.md section 5 (draft, owner to confirm).
const PLANS = {
  // เจ้าของสั่ง 24 ต.ค. 2026: ทุกกลุ่มใช้ฟรีไม่จำกัดตลอดไป
  free:   { id: 'free',   name: 'ใช้ฟรี ไม่จำกัด', priceTHB: 0, limits: { students: null, teachers: null, aiPerMonth: null } },
  // แพ็กเกจจำกัดโควตา เก็บไว้เผื่ออนาคต (ไม่มีกลุ่มไหนใช้ตอนนี้)
  starter: { id: 'starter', name: 'Starter',   priceTHB: 0,    limits: { students: 60,   teachers: 1,    aiPerMonth: 50 } },
  pro:    { id: 'pro',    name: 'Teacher Pro', priceTHB: 59,   limits: { students: null, teachers: 1,    aiPerMonth: 1500 } },
  school: { id: 'school', name: 'Group Plus', priceTHB: null, limits: { students: null, teachers: null, aiPerMonth: 10000 } }
};
const DEFAULT_PLAN = 'free';

// Unknown plan names fall back to free.
const getPlan = (id) => PLANS[String(id || '').toLowerCase()] || PLANS[DEFAULT_PLAN];

module.exports = { PLANS, DEFAULT_PLAN, getPlan };
