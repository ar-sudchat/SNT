# Changelog

รูปแบบอิงจาก [Keep a Changelog](https://keepachangelog.com/) · บันทึกเป็นภาษาไทยและอังกฤษ
Format follows Keep a Changelog · entries are in Thai and English.

## [Unreleased] - 2026-10-24 — กลุ่ม (multi-tenant "group") release

### เพิ่ม / Added
- **กลุ่มแทนโรงเรียน** — tenant = กลุ่ม · สมัครแล้วได้กลุ่มส่วนตัวทันที เข้ากลุ่มของเพื่อนครูด้วยรหัส `XXX-XXX` หรือลิงก์เชิญ (`/join`, `/invite/:token`) ล็อกอินไม่ต้องใช้รหัสโรงเรียน
  *Group = tenant. Signing up creates a personal group; join a colleague's group with a `XXX-XXX` code or invite link; no school code at login.*
- **สมัคร/ล็อกอินด้วยอีเมลและ Google** (`/signup`, `/login`, `/auth/callback`) · ผู้ดูแลระบบเดิมใช้ username ผ่านปุ่ม "เข้าสู่ระบบผู้ดูแลระบบ" · นักเรียนไม่ล็อกอิน
  *Email + Google sign-in; legacy admin username login behind the "เข้าสู่ระบบผู้ดูแลระบบ" toggle; students do not log in.*
- **ตัวสลับกลุ่มและหน้าตั้งค่ากลุ่ม** (`/group`) — สลับ/สร้าง/ออกจากกลุ่ม, รหัสเข้ากลุ่ม (หมุนรหัสใหม่ได้), รายชื่อสมาชิก, ลิงก์เชิญ · กล่องโต้ตอบของ KruScan แทน alert/prompt ของเบราว์เซอร์
  *Group switcher and settings: switch/create/leave, join code (rotatable), members, invites; themed dialogs instead of native ones.*
- **หน้า Landing** สำหรับผู้เยี่ยมชม พร้อมปุ่มสมัครและส่วนลองสแกน
  *Public landing page with signup CTA and a try-scan demo.*
- **แพ็กเกจต่อกลุ่ม** (free / pro / school, `backend/config/plans.js`) และตัวจำกัดตามแพ็กเกจ
  *Per-group plans and plan limits.*
- **เครื่องมือแพลตฟอร์ม** — `/ops` (ระงับ/คืนกลุ่ม, ต้องอยู่ใน `PLATFORM_ADMIN_EMAILS`), audit log, ส่งออก/ขอลบข้อมูลกลุ่ม (PDPA)
  *Platform tooling: `/ops` suspend/unsuspend, audit log, group data export and delete request.*
- **การแยกข้อมูล** — `tenantId` บนทุกตารางข้อมูล + Row Level Security เลือกเปิดด้วย `RLS_ENABLED=1` (`backend/prisma/rls.sql`)
  *Data isolation via `tenantId` on every data table, plus opt-in Postgres RLS.*
- **e2e** ชุดใหม่ `e2e/tests/groups.spec.js` (Landing, ปุ่ม Google, สมัคร, รหัสเข้ากลุ่ม, เข้าร่วม, สลับกลุ่ม, สมาชิก, ออกจากกลุ่ม, กล่องโต้ตอบ) พร้อมตัวล้างข้อมูลทดสอบบนฐาน local
  *New e2e suite covering the group flows, with a local-DB-only cleanup helper.*

### เปลี่ยน / Changed
- ค่า unique ของรหัสนักเรียน/ชื่อห้อง ฯลฯ เปลี่ยนเป็นต่อกลุ่ม (`@@unique([tenantId, …])`)
  *Student codes, class names, etc. are now unique per group.*
- เอกสาร deploy: ตัวแปรใหม่ `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `PUBLIC_URL`, `FRONTEND_URL`, `PLATFORM_ADMIN_EMAILS`, `RLS_ENABLED` (ดู `deploy/README-DEPLOY.md` ข้อ 2.1)
  *New env vars documented in the deploy guide, section 2.1.*

### ต้องทำก่อนอัปเกรดฐานข้อมูลเดิม / Upgrade notes
- ฐานข้อมูลที่มีข้อมูลอยู่แล้วต้องทำ expand → backfill → contract ตาม `docs/SAAS-MIGRATION.md` ก่อน deploy (ข้อมูลเดิมกลายเป็นกลุ่มแรก)
  *Existing databases must follow the 3-step migration in `docs/SAAS-MIGRATION.md` before deploying; existing data becomes the first group.*
- RLS ยังไม่ถูกบังคับจนกว่าจะใช้ role ฐานข้อมูลที่ไม่ใช่ superuser (Step 4 ในเอกสารเดียวกัน)
  *RLS is not enforced until the app connects as a non-superuser role (Step 4).*

## [1.2.0] - ก่อนหน้า / earlier
- โปรไฟล์ผู้ใช้ + เปลี่ยนรหัสผ่าน, คู่มือแบบเคลื่อนไหวในแอป, ชุด deploy สำหรับ Coolify, e2e smoke test
  *Profile page with password change, built-in animated guide, Coolify deploy kit, e2e smoke tests.*
