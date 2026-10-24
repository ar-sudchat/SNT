# KruScan SaaS — Multi-Tenant Design (ร่าง v1)

> วันที่ 2026-10-24 · สถานะ: **ร่างออกแบบ ยังไม่แตะโค้ด** · ผู้เขียน: lead architect (Claude)
> อินพุต: คำขอเจ้าของ "ทำเป็น SaaS ให้ทุกคนสมัครได้ เข้าผ่าน Google แยก tenant", ไฟล์แนวคิด `Multi-Tenant .txt` (นำร่อง PostgreSQL RLS ที่ Beside), งานวิจัยคู่แข่งคุณไก่ทวง (khunkai-research.md)

---

## การเปลี่ยนแนวคิด: กลุ่มแทนโรงเรียน (2026-10-24)

เจ้าของสั่งเปลี่ยนแนวคิด: **ไม่มีโรงเรียนเป็นหน่วยสมัคร** tenant = **กลุ่ม** เอกสารด้านล่างเขียนด้วยแนวคิดเดิม (โรงเรียน = tenant) ให้อ่านคำว่า "โรงเรียน/tenant" เป็น "กลุ่ม" และถือส่วนที่ระบุว่า **[superseded]** เป็นล้าสมัย

**สิ่งที่เปลี่ยน**
- ใครก็สมัครได้ (อีเมลหรือ Google) และ **ได้กลุ่มส่วนตัวทันที** ไม่ต้องกรอกข้อมูลโรงเรียน
- ครูในโรงเรียนเดียวกัน **เข้ากลุ่มของกันและกันด้วยรหัสเข้ากลุ่ม (XXX-XXX) หรือลิงก์เชิญ** โรงเรียนหนึ่งมีหลายกลุ่มหรือกลุ่มเดียวก็ได้
- **ล็อกอินไม่ต้องใช้รหัสโรงเรียน/slug** (หนึ่งบัญชีอยู่ได้หลายกลุ่ม สลับกลุ่มได้)
- **นักเรียนไม่ล็อกอิน** นักเรียนและผู้ปกครองดูผลผ่านลิงก์/QR ที่ครูให้
- แพ็กเกจยังผูกต่อกลุ่ม (free / pro / school เป็นข้อมูลใน `backend/config/plans.js` ขีดจำกัดไม่เปลี่ยน แสดงชื่อ school เป็น "Group Plus")
- RLS, `tenantId`, การแยกข้อมูลสองชั้น และขั้นตอน migration **ไม่เปลี่ยน** (กลุ่ม = แถวใน tenant)

**ส่วนที่ถูกแทนที่ [superseded]**
- ล็อกอินด้วย slug/รหัสโรงเรียน และเส้นทาง `/s/:slug` (section 2 และ 4)
- onboarding แบบสมัครโรงเรียน (ตั้งชื่อโรงเรียน/slug) (section 5) ใช้กลุ่มส่วนตัวอัตโนมัติ + join code แทน
- ครู/นักเรียนล็อกอินด้วยรหัสต่อ tenant (section 1 และ 4) นักเรียนเข้าผ่านลิงก์/QR เท่านั้น

---

## 1. เป้าหมาย / สิ่งที่ไม่ทำ / เทียบกับไฟล์แนวคิด

**Goals**
- โรงเรียน (หรือครูเดี่ยว) สมัครเองได้ใน < 3 นาที ด้วย Google หรือ email/password
- 1 โรงเรียน = 1 **tenant** ข้อมูลมองไม่เห็นข้ามกันเด็ดขาด (ป้องกัน 2 ชั้น: แอป + ฐาน)
- 1 บัญชี Google อยู่ได้หลายโรงเรียน สลับ tenant ได้
- ครู/นักเรียนยังล็อกอินด้วยรหัส (code) ได้ แต่ผูกกับ tenant
- มี free tier + แพ็กเกจจ่ายเงิน, นับการใช้ AI ต่อ tenant
- ผ่าน PDPA: export/delete ต่อ tenant, audit log, consent

**Non-goals (รอบนี้)**
- ไม่ทำ DB-per-tenant / custom domain / subdomain ต่อโรงเรียน (ทุก tenant ใช้ `kruscan.duckdns.org`)
- ไม่ทำ LINE OA integration (ไว้เฟสหลัง — คู่แข่งแข็งตรงนี้)
- ไม่ทำ billing จริงจนกว่าจะมีผู้ใช้จ่ายเงินกลุ่มแรก (ออกแบบไว้ก่อน)
- ไม่ย้ายออกจาก Express/Prisma/Coolify

**ไฟล์แนวคิด → KruScan**

| แนวคิดในไฟล์ | KruScan | เห็นด้วย? |
|---|---|---|
| RLS + `current_setting('app.tenantid')` ใส่ policy ที่ตาราง | ใช้ — เป็นชั้น defense-in-depth | ✅ เห็นด้วย |
| `DEFAULT current_setting(...)` เติม tenantId อัตโนมัติ | ใช้ได้ แต่ Prisma ส่งค่า column เองอยู่แล้ว → ตั้ง DEFAULT ไว้กันลืม + Prisma extension ใส่ค่าชัดเจน | ✅ บางส่วน |
| `FORCE ROW LEVEL SECURITY` เพราะ app role เป็น owner | **จำเป็น** — Prisma migrate ใช้ role เดียวกัน; ควรแยก role `kruscan_migrator` (owner) กับ `kruscan_app` (ไม่ใช่ owner, ไม่มี BYPASSRLS) | ✅ + ปรับ |
| ตั้ง GUC ที่ "จุดเปิด connection" (`set_config(..., false)` ระดับ session) | ❌ **ไม่ปลอดภัยกับ Prisma connection pool** — connection ถูกใช้ซ้ำข้าม request, ค่าค้างไปหา tenant อื่นได้ ต้องใช้ `set_config(..., true)` (transaction-local) ภายใน `$transaction` ต่อ request แทน | ❌ ปรับ |
| tenant มาจาก header `X-Tenant-Id` | ❌ ห้าม production (ไฟล์เองก็เตือน) — tenantId ต้องมาจาก JWT ที่ตรวจ membership แล้วเท่านั้น | ❌ |
| ค่า `'*'` = admin เห็นทุก tenant | ❌ ไม่ใช้ใน request path ของแอป — superadmin ใช้ DB role แยก (`kruscan_ops` มี BYPASSRLS) ผ่านเครื่องมือ ops เท่านั้น ลด blast radius | ❌ ปรับ |
| fail-safe: ไม่ตั้งตัวตน = เห็น 0 แถว | ✅ คงไว้ (`current_setting(..., true)` คืน NULL → policy false) | ✅ |
| นำร่องตารางเดียวก่อนแล้วขยาย | ✅ ใช้: นำร่องที่ `Student` ก่อน แล้วไล่ทั้งระบบ | ✅ |

## 2. Tenancy model

| ตัวเลือก | ข้อดี | ข้อเสียกับ KruScan |
|---|---|---|
| **A. Shared DB + `tenantId` + Prisma extension + RLS** | 1 schema, migration ครั้งเดียว, ถูกที่สุดบน VPS เล็ก, รองรับหลักหมื่น tenant | ต้องวินัย: ทุกตาราง+ทุก query มี tenantId; RLS กับ pool ต้องทำแบบ transaction-local |
| B. Schema-per-tenant | แยกชัด, ลบ tenant ง่าย | Prisma ไม่รองรับดีนัก (ต้องสลับ `search_path`), migrate หลักพัน schema ช้า/พังบางส่วน, catalog บวม |
| C. DB-per-tenant | แยกสูงสุด | connection/ค่าใช้จ่ายระเบิดที่หลักพันโรงเรียน, ops หนักเกินทีมเล็ก |

**ข้อเสนอ: A** — สเกล "หลักพันโรงเรียน, แต่ละโรงเรียนข้อมูลเล็ก" คือกรณีตรงของ shared schema. เปิดทางไว้: tenant ใหญ่พิเศษ (เขตพื้นที่/เครือ) ย้ายไป DB แยกภายหลังได้เพราะ tenantId อยู่ทุกแถว

**กลไก 2 ชั้น**
1. **ชั้นแอป** — `prisma.$extends` คืน client ต่อ request: ทุก `findMany/update/delete/count` เติม `where.tenantId`, ทุก `create` เติม `data.tenantId`; ห้ามใช้ `$queryRawUnsafe` นอก helper ที่ใส่ tenant
2. **ชั้นฐาน (RLS)** — ทุก request ห่อด้วย `prisma.$transaction(async tx => { await tx.$executeRaw\`SELECT set_config('app.tenant_id', ${tid}, true)\`; ... })` (ทำใน middleware/extension กลาง ไม่กระจาย). Policy:
   ```sql
   ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "Student" FORCE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON "Student"
     USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
     WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
   ```
   ค่าใช้จ่าย: ทุก request เป็น transaction (latency +~1ms) — รับได้. งาน background (cron, AI job) ต้องตั้ง tenant เองต่อ job
3. App connect ด้วย role `kruscan_app` (ไม่ใช่ owner); migration ด้วย `kruscan_migrator`

## 3. Data model

**ตารางใหม่ (global, ไม่มี RLS)**
```prisma
model Tenant {            // = 1 โรงเรียน
  id        String   @id @default(uuid())
  slug      String   @unique          // a-z0-9- , 3–40 ตัว, reserved list (www, api, admin, s ...)
  name      String
  plan      Plan     @default(FREE)
  status    TenantStatus @default(ACTIVE) // ACTIVE|SUSPENDED|PENDING_DELETE
  settings  Json     // aiEnabled, aiDataRetentionDays, locale, logo
  createdAt DateTime @default(now())
}
model Account {           // ตัวตนบุคคล ข้าม tenant (ปัจจุบันคือ User)
  id            String  @id @default(uuid())
  email         String? @unique
  emailVerified Boolean @default(false)
  passwordHash  String?
  name String?; avatarUrl String?
  isPlatformAdmin Boolean @default(false)
}
model AuthIdentity { provider String; providerSubject String; accountId String
  @@unique([provider, providerSubject]) }   // google sub (ไม่ใช้ email เป็น key)
model Membership {        // สิทธิ์ต่อ tenant
  tenantId String; accountId String
  role     TenantRole     // OWNER | ADMIN | TEACHER | STUDENT | PARENT
  teacherId Int?; studentId Int?          // ผูกกับ record ใน tenant
  status   MemberStatus   // INVITED | ACTIVE | REMOVED
  @@unique([tenantId, accountId])
}
model Invite { id; tenantId; role; email?; tokenHash @unique; expiresAt; usedAt? }
```

**ตารางเดิม (tenant-scoped + RLS)**: AcademicYear, Grade, Class, Student, Teacher, Subject, Task, QRCode, Submission, AiConversation, AiMessage, ParentLink, profile/assets — เพิ่ม `tenantId String` + index `(tenantId, ...)` ทุกตาราง (ลูกก็ใส่ แม้ได้จาก parent — RLS ต้องตรวจได้ในแถวตัวเอง ไม่ join)

**unique → composite**

| เดิม | ใหม่ |
|---|---|
| `AcademicYear.year` | `@@unique([tenantId, year])` |
| `Grade.gradeName`, `Class.className` | `@@unique([tenantId, gradeName])`, `([tenantId, className])` |
| `Student.studentCode`, `Teacher.teacherCode`, `Subject.subjectCode` | `([tenantId, studentCode])` ฯลฯ |
| `User.email @unique` | ย้ายไป `Account.email` (global) |
| `User.teacherId/studentId @unique` | ย้ายไป `Membership` |
| `Task([subjectId, taskNumber])`, `Submission([studentId, taskId])` | คงเดิม (id global อยู่แล้ว) + เพิ่ม tenantId |

**FK ข้าม tenant**: เพิ่ม composite FK `(tenantId, classId) → Class(tenantId, id)` ในตารางสำคัญ (Student→Class, Submission→Task) กันกรณีบั๊กผูกข้ามโรงเรียน

**Routing (เจ้าของตัดสินแล้ว 2026-10-24)**: **ไม่มีโดเมนเฉพาะ ไม่มี subdomain** — ทุก tenant ใช้ `https://kruscan.duckdns.org` ร่วมกัน. หลังล็อกอิน tenant ที่ใช้งาน = `tid` ใน JWT (มาจาก Membership) + ตัวสลับ tenant ใน UI; หน้าภายในแอปไม่ต้องมี slug ใน URL. slug `/s/:slug` ใช้เฉพาะหน้า public (หน้าล็อกอินด้วยรหัสครู/นักเรียน, ลิงก์ผู้ปกครอง, ลิงก์ invite) เพื่อบอกว่าเป็นโรงเรียนไหน — สิทธิ์จริงตัดสินจาก JWT เสมอ

**QR payload**: เดิม `SNT-{studentId}-{subjectId}-{rand}` → ใหม่ `KS1.{tenantSlug}.{opaqueToken}` (token สุ่ม 128-bit, lookup `(tenantId, qrcodeData)`). เวลาสแกน: tenant ใน QR ต้อง == tenant ของ session ผู้สแกน มิฉะนั้นปฏิเสธ (ไม่ข้ามโรงเรียน). QR เก่ายัง resolve ได้ช่วง transition โดยถือเป็น tenant แรก

**Parent links**: `ParentLink { tenantId, studentId, tokenHash, expiresAt, accountId? }` — ลิงก์อ่านได้เฉพาะนักเรียนใน tenant นั้น; ผู้ปกครองที่ล็อกอิน Google ได้ Membership role PARENT ต่อ tenant (ลูกต่างโรงเรียน = หลาย membership)

## 4. Auth

- **Google OIDC** — redirect URI เดียว `https://kruscan.duckdns.org/api/auth/google/callback` (Authorization Code + PKCE ฝั่ง backend ด้วย `openid-client`): ตรวจ `iss/aud/exp/nonce`, ใช้ `sub` เป็น key, เชื่อ email เฉพาะ `email_verified=true`; ถ้า email ตรงกับ Account ที่มีรหัสผ่านแต่ยังไม่ผูก Google → ให้ล็อกอินรหัสผ่านก่อนแล้วค่อยผูก (กัน account takeover)
- **Email/password**: bcrypt (มีแล้ว), verify email ก่อนสร้างโรงเรียน, reset password ผ่านลิงก์ (ต้องมี SMTP เช่น Resend/SES)
- **Signup flow**: สมัคร → verify → wizard "สร้างโรงเรียน" (ชื่อ, slug, ปีการศึกษา) → เป็น OWNER → เชิญครู (ลิงก์ invite หรือ email, role TEACHER/ADMIN, หมดอายุ 7 วัน) → นำเข้านักเรียน (CSV/Excel ที่มีอยู่แล้ว)
- **Code login (ครู/นักเรียน)**: หน้า `/s/<slug>/login` → lookup `(tenantId, studentCode)` + PIN/รหัส; rate limit ต่อ `(tenant, code, IP)` (ขยาย loginRateLimit.js). นักเรียนไม่จำเป็นต้องมี Google
- **JWT claims** (access 15 นาที + refresh httpOnly cookie, rotate):
  `{ sub: accountId|studentPrincipal, tid: tenantId, role, mid: membershipId, ver }` — middleware `auth.js` ตรวจ membership ACTIVE + tenant ACTIVE (cache 60s) แล้วตั้ง `req.tenant`
- **Tenant switching**: `POST /auth/switch-tenant {tenantId}` → ตรวจ membership → ออก token ใหม่; UI dropdown ใน Layout. หนึ่ง token = หนึ่ง tenant เสมอ
- **ยกเลิก env admin** (`ADMIN_USERNAME/ADMIN_PASSWORD_HASH/legacy 1234`): admin โรงเรียน = Membership OWNER/ADMIN. **Platform superadmin** = `Account.isPlatformAdmin` + 2FA (TOTP) ใช้หน้า `/ops` แยก (ดู/ระงับ tenant, ไม่แก้ข้อมูลโรงเรียนผ่าน UI ปกติ) ทุกการกระทำลง audit log

## 5. Onboarding, แพ็กเกจ, metering, billing

อ้างอิงคู่แข่ง: คุณไก่ทวง ไม่มี free ถาวร (ทดลอง 5 ภารกิจ / 30 วัน), LITE ฿37/เดือน, PRO ฿75/เดือน (AI 1,600 ครั้ง), School Package เหมาจ่าย — ขายรายครู ผ่าน LINE

**ข้อเสนอแพ็กเกจ (ตัวเลขรอเจ้าของตัดสิน)**

| | Free | Teacher Pro | School |
|---|---|---|---|
| ราคา (ร่าง) | ฿0 ถาวร | ~฿59/เดือน หรือ ~฿590/ปี | ต่อหัวนักเรียน/ปี หรือเหมา |
| ครู / นักเรียน | 1 ครู, 60 นักเรียน | 1 ครู, ไม่จำกัดห้อง | ไม่จำกัด + admin dashboard |
| AI | 50 ครั้ง/เดือน | 1,500 ครั้ง/เดือน | pool ต่อโรงเรียน |
| อื่น ๆ | QR สแกน, งาน, รายงานพื้นฐาน | export, parent link | SSO Google Workspace, audit export, DPA |

จุดต่าง: **free ถาวร** (คู่แข่งไม่มี) ใช้เป็นช่องทางโต; ขายทั้งรายครูและรายโรงเรียน

- **Limits**: `PlanLimit` ตรวจที่ service layer (สร้างนักเรียน/ครู/AI call) → error `402 PLAN_LIMIT` พร้อมข้อความชวนอัปเกรด
- **Usage metering**: `UsageEvent { tenantId, kind: AI_CALL|AI_TOKENS|STORAGE, qty, at }` + ตารางสรุป `UsageMonthly(tenantId, period, kind)` (upsert ตอนเรียก AI) — ใช้ทั้งตัดโควตาและเก็บต้นทุนจริงต่อ tenant
- **Billing ไทย (design only)**:
  - **Omise (Opn)** — บัตร + PromptPay QR + recurring, บริษัทไทย, เอกสารไทย → **แนะนำเป็นตัวแรก**
  - Stripe Thailand — subscription/portal ดีที่สุด รองรับ PromptPay แต่ PromptPay ไม่ใช่ recurring อัตโนมัติ
  - PromptPay ตรง (QR + ตรวจสลิป) — ถูกสุด แต่ต่ออายุมือ, เหมาะ School Package ที่ออกใบแจ้งหนี้
  - โมเดล: `Subscription { tenantId, provider, externalId, plan, status, currentPeriodEnd }` อัปเดตจาก webhook (ตรวจ signature, idempotent); ใบกำกับภาษี/ใบเสร็จต้องมีถ้าจดบริษัท/VAT

## 6. Security & PDPA

- **Isolation tests (บังคับใน CI)**: fixture 2 tenant; ทุก endpoint ยิงด้วย token tenant A ไปที่ id ของ tenant B → ต้อง 404; เทส RLS ตรงด้วย SQL (ไม่ตั้ง GUC = 0 แถว, insert tenant อื่น = error) แบบฉากในไฟล์แนวคิด; lint/grep ห้าม `prisma.` ดิบนอก tenant client
- **RLS policies**: ทุกตาราง tenant-scoped, ENABLE+FORCE, ตรวจด้วย query `pg_class.relrowsecurity` ใน test ว่าไม่มีตารางไหนหลุด
- **Export/delete ต่อ tenant**: OWNER กด export (ZIP JSON/CSV + ไฟล์) แบบ async; ลบโรงเรียน = `PENDING_DELETE` 30 วัน → hard delete ทุกตาราง `WHERE tenant_id` + ไฟล์ + backup หมดอายุตามรอบ; ลบรายนักเรียนได้ (right to erasure)
- **Audit log**: `AuditLog { tenantId?, actorAccountId, action, target, ip, at, meta }` append-only (app role ไม่มี UPDATE/DELETE) — login, เปลี่ยนสิทธิ์, export, ลบ, การกระทำของ superadmin
- **Consent**: `ConsentRecord { tenantId, subject (account/student/parent), purpose, version, grantedAt, revokedAt }`; โรงเรียนเป็น data controller, KruScan เป็น processor → ToS + DPA ตอน signup; นักเรียนอายุ < 20 → โรงเรียนรับรองความยินยอมผู้ปกครอง
- **AI ต่อ tenant**: `settings.aiEnabled`, `aiDataRetentionDays`, ห้ามส่งชื่อ-รหัสนักเรียนให้ LLM (pseudonymize), ไม่ใช้ข้อมูลข้าม tenant ใน prompt/context, ลบ AiConversation ตาม retention
- **Rate limits ต่อ tenant**: token bucket key `tenantId` (API ทั่วไป) + `tenantId+route` (AI, login, import) + quota แผน; signup จำกัดต่อ IP + captcha (Turnstile) กันสร้าง tenant ขยะ
- อื่น ๆ: secret ต่อ env เท่านั้น, backup เข้ารหัส, ห้าม log PII

## 7. Migration ข้อมูลเดิม

แนวทาง **expand → backfill → contract** (Prisma migrate หลายรอบ, ไม่ downtime):
1. Backup เต็ม (`pg_dump`) + ซ้อมบน staging ด้วยสำเนาจริง
2. **Expand**: สร้าง Tenant/Account/Membership/...; เพิ่ม `tenantId` แบบ nullable ทุกตาราง (deploy โค้ดที่เขียน tenantId ด้วยค่า tenant แรกเสมอ)
3. **Backfill**: สร้าง Tenant แรก (slug เช่น `snt`), `UPDATE ... SET tenant_id = <first>`; แปลง User → Account + Membership (ADMIN เดิม → OWNER โดยผูก email เจ้าของ)
4. **Contract**: `NOT NULL`, composite unique (สร้าง index `CONCURRENTLY` ก่อน), ลบ unique เดี่ยว
5. เปิด RLS ทีละกลุ่มตาราง (เริ่ม Student) — สลับ connection เป็น `kruscan_app`
6. หน้า login เดิมยังใช้ได้ (ถือเป็น tenant แรก); เพิ่มหน้า public `/s/<slug>/login` (QR เก่ายัง resolve)
7. ปิด env-admin หลัง OWNER ล็อกอินได้แล้ว

Coolify: แต่ละขั้น = 1 deploy, migration รันเป็น pre-deploy command; health check ผ่านก่อนสลับ container (rolling). **Rollback**: ขั้น 2–3 ถอยได้ด้วยโค้ดเดิม (คอลัมน์ nullable ไม่กระทบ); ขั้น 4–5 มี down-migration (`DISABLE ROW LEVEL SECURITY`, คืน unique เดิม) + restore `pg_dump` เป็นทางสุดท้าย; feature flag `MULTI_TENANT_ROUTING` ปิด routing ใหม่ได้ทันที

## 8. แผนส่งมอบ

| Phase | งาน | Effort | ขึ้นกับ |
|---|---|---|---|
| 0 | ตัดสินใจข้อด้านล่าง, ซื้อโดเมน, Google Cloud OAuth client + consent screen, staging บน Coolify | S | เจ้าของ |
| 1 | Data model expand + backfill tenant แรก + Prisma tenant extension + isolation tests | L | 0 |
| 2 | Auth ใหม่: Account/Membership, JWT tid, Google OIDC, email verify/reset (SMTP), tenant switch, ยกเลิก env admin | L | 1, OAuth client |
| 3 | RLS ทุกตาราง + DB roles แยก + contract migration | M | 1 |
| 4 | Self-service: signup wizard, invite, import, tenant switcher + `/s/<slug>` หน้า public, QR v2, parent link scoped | M | 2 |
| 5 | Plan/limits + usage metering AI + หน้า billing (Omise) | M | 4, บัญชี Omise/นิติบุคคล |
| 6 | PDPA: export/delete, audit log, consent, ToS/Privacy/DPA, หน้า `/ops` superadmin + 2FA | M | 2 |
| 7 | Landing page, monitoring/alert ต่อ tenant | S | — |

**Dependencies สำคัญ**
- **Google OAuth**: เจ้าของต้องสร้าง OAuth client ใน Google Cloud; consent screen แบบ External + publish (scope แค่ `openid email profile` ไม่ต้อง verification ยาว แต่ต้องมีหน้า privacy/ToS บนโดเมนที่ verify ได้)
- **โดเมน (ตัดสินแล้ว)**: ใช้ `kruscan.duckdns.org` ต่อ ไม่ซื้อโดเมน ไม่ทำ subdomain. ข้อควรรู้: OAuth consent screen ใส่ authorized domain `kruscan.duckdns.org` ได้ แต่ duckdns.org เป็น public suffix ที่เราไม่ได้เป็นเจ้าของ → อาจ verify app/branding ยาก (scope `openid email profile` ใช้ได้โดยไม่ต้อง verify แต่หน้าจอยินยอมอาจขึ้นชื่อโดเมนแทนโลโก้) และความน่าเชื่อถือต่อโรงเรียนต่ำกว่า; หน้า privacy/ToS ต้องอยู่บนโดเมนนี้
- VPS: เพิ่ม RAM/backup offsite เมื่อเกิน ~200 tenant active; Postgres แยกจาก app container

**ความเสี่ยง**
- ลืมใส่ tenantId ใน query ใหม่ → RLS + isolation test เป็นตาข่าย
- RLS + pool ตั้งค่าผิด (session-level GUC) → ข้อมูลรั่วข้าม tenant (นี่คือจุดที่ไฟล์แนวคิดต้องปรับ)
- Performance: index `(tenantId, ...)` ครบ; ตรวจ `EXPLAIN` หลังเปิด RLS
- Account takeover ผ่าน email ซ้ำ Google/password → กติกา link ด้านบน
- ต้นทุน AI บน free tier → โควตาแข็ง + metering ตั้งแต่วันแรก
- PDPA ข้อมูลผู้เยาว์ → DPA + consent + ไม่ส่ง PII ให้ LLM
- คู่แข่งมี LINE + ฐานผู้ใช้ 12,000 ครู → ต้องชนะที่ free ถาวร + QR สแกนเร็ว + ระดับโรงเรียน

**คำถามที่เจ้าของต้องตัดสิน**
1. ~~โดเมน~~ — ตัดสินแล้ว: ใช้ `kruscan.duckdns.org` ร่วมกันทุก tenant
2. ~~routing~~ — ตัดสินแล้ว: tenant จาก JWT + switcher, `/s/:slug` เฉพาะหน้า public, ไม่มี subdomain
3. ขายรายครู (แบบคู่แข่ง) รายโรงเรียน หรือทั้งสอง? tenant ของครูเดี่ยว = "โรงเรียนส่วนตัว" ได้ไหม?
4. ให้มี free ถาวรไหม และเพดาน (ครู/นักเรียน/AI ต่อเดือน) เท่าไร? ราคา Pro/School?
5. Billing ตัวแรก: Omise, Stripe หรือ PromptPay+ใบแจ้งหนี้? มีนิติบุคคล/จด VAT แล้วหรือยัง?
6. ใครสร้าง Google Cloud OAuth client และเป็นเจ้าของ project (บัญชีไหน)?
7. นักเรียนล็อกอินด้วย code+PIN ต่อไป หรือบังคับ Google ในโรงเรียนที่มี Workspace?
8. ผู้ปกครองต้องมีบัญชี (Google) หรือใช้ลิงก์อย่างเดียวพอ?
9. ข้อมูลโรงเรียนปัจจุบันเป็น tenant แรก slug อะไร และใครเป็น OWNER (email)?
10. AI ส่งเนื้องานนักเรียนให้ผู้ให้บริการ LLM ได้ไหม — default เปิดหรือปิดต่อโรงเรียน?
11. ระยะเก็บข้อมูลหลังโรงเรียนยกเลิก (ร่าง 30 วัน) และนโยบาย backup?
12. ใครเป็น DPO/ผู้ติดต่อ PDPA และจะใช้ ToS/DPA จากทนายหรือร่างเอง?
