# ย้าย KruScan ขึ้น VPS ของตัวเองด้วย Coolify

เว็บ + PostgreSQL อยู่บนเครื่องเดียว · ย้ายข้อมูลจริงทั้งหมดจาก Neon · ยังไม่มีโดเมน ใช้ sslip.io ไปก่อน

ไฟล์ในโฟลเดอร์นี้
| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `docker-compose.coolify.yml` | stack 3 ตัว: postgres (ภายใน) · backend (ภายใน) · frontend (สาธารณะ port 80) |
| `frontend.Dockerfile` + `nginx.coolify.conf` | build หน้าเว็บ และให้ nginx ส่ง `/api` ไปที่ service `backend` ภายใน (ไม่แตะ `frontend/nginx.conf` เดิม) |
| `.env.coolify.example` | รายชื่อตัวแปรทั้งหมดพร้อมคำอธิบาย |
| `migrate-from-neon.sh` | ดึงข้อมูลจาก Neon (อ่านอย่างเดียว) → restore → เทียบจำนวนแถวทุกตาราง |

## 1. ทำไมต้อง HTTPS
กล้องสแกน QR ในเบราว์เซอร์ใช้ได้บน HTTPS เท่านั้น ใช้ `http://<IP>` เปล่าๆ ไม่ได้
ไม่มีโดเมน → ใช้ `https://kruscan.<IP-ใช้ขีด>.sslip.io` เช่น `https://kruscan.203-0-113-10.sslip.io`
(sslip.io ชี้ชื่อนี้กลับไปที่ IP ให้เอง ฟรี · Traefik ใน Coolify ขอใบรับรอง Let's Encrypt ให้อัตโนมัติ) · ต้องเปิด port 80 และ 443 ที่ firewall

## 2. ตั้งค่าใน Coolify
1. **Projects → New Project** ชื่อ `kruscan` → environment `production`
2. **+ New Resource → Public/Private Repository (GitHub App)** → repo นี้ → branch **`responsive-ui`**
3. Build Pack = **Docker Compose** · Base Directory = `/` · Docker Compose Location = `/deploy/docker-compose.coolify.yml`
   - ถ้า build ฟ้องว่าหา `../backend` ไม่เจอ แสดงว่า Coolify รุ่นนั้นอ่าน path จาก Base Directory → แก้ `context: ../backend` เป็น `./backend` และ `context: ..` เป็น `.`
4. ที่ service **frontend → Domains** ใส่ `https://kruscan.<IP-ใช้ขีด>.sslip.io` (ขึ้นต้น `https`) · postgres กับ backend **ไม่ต้องใส่โดเมน**
5. **Environment Variables** — ดู `.env.coolify.example`
   - `SERVICE_PASSWORD_POSTGRES`, `SERVICE_BASE64_64_JWT`, `SERVICE_BASE64_64_PARENTLINK` Coolify สร้างให้เอง (JWT ใหม่ = หมุน secret แล้วในตัว)
   - **`ADMIN_PASSWORD_HASH`** ต้องตั้งเอง (ไม่ตั้ง compose จะไม่ยอม deploy):
     ```bash
     cd backend && node -e "console.log(require('bcryptjs').hashSync(process.argv[1],12))" 'รหัสใหม่ที่ยาวพอ'
     ```
     ค่าที่ได้ขึ้นต้น `$2b$12$…` — **ติ๊ก "Is Literal?"** ใน Coolify (หรือเขียน `$` ทุกตัวเป็น `$$`) ไม่งั้น `$` ถูกตีความเป็นตัวแปรแล้ว hash พัง ล็อกอินไม่ได้
   - AI: `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY` (หรือ OPENAI/GEMINI) — เว้นว่าง = ปิด AI
   - ลิงก์ผู้ปกครองเดิม: ถ้าอยากให้ลิงก์ที่ส่งไปแล้วใช้ต่อได้ ให้ใส่ `PARENT_LINK_SECRET` ค่าเดิมแทน (แก้บรรทัดใน compose) · ถ้าใช้ค่าใหม่ ลิงก์เก่าจะใช้ไม่ได้ ต้องส่งใหม่

## 2.1 ตัวแปรของระบบกลุ่ม (multi-tenant) + ล็อกอินด้วย Google

รุ่นกลุ่ม (tenant = กลุ่ม) เพิ่มตัวแปรต่อไปนี้ใน Coolify (ตัวอย่างอยู่ใน `.env.coolify.example`)

| ตัวแปร | จำเป็น | ใช้ทำอะไร |
|---|---|---|
| `PUBLIC_URL` | ใช่ (ถ้าเปิด Google) | URL สาธารณะของเว็บ เช่น `https://kruscan.duckdns.org` · ใช้สร้าง redirect URI และลิงก์กลับหลังล็อกอิน Google (ไม่ใส่ = `http://localhost:3000`) |
| `FRONTEND_URL` | อัตโนมัติ | compose ตั้งเป็น `SERVICE_FQDN_FRONTEND` ให้แล้ว · ใช้ทำ CORS และลิงก์เชิญ |
| `GOOGLE_CLIENT_ID` | ไม่ | OAuth client จาก Google Cloud Console · เว้นว่าง = ปุ่ม Google แสดง "เปิดใช้เร็วๆ นี้" และ `/api/auth/google` ตอบ 503 |
| `GOOGLE_CLIENT_SECRET` | ไม่ | คู่กับ client id (เก็บเป็น secret ใน Coolify ห้ามใส่ใน git) |
| `GOOGLE_REDIRECT_URI` | ไม่ | ปกติไม่ต้องตั้ง (ใช้ `${PUBLIC_URL}/api/auth/google/callback`) · ตั้งเมื่อ API อยู่คนละโฮสต์กับ `PUBLIC_URL` เช่น dev ในเครื่อง · ค่านี้ต้องตรงกับ Authorized redirect URI ใน Google Cloud Console ทุกตัวอักษร |
| `PLATFORM_ADMIN_EMAILS` | ไม่ | อีเมลผู้ดูแลแพลตฟอร์ม คั่นด้วย `,` ที่เข้าหน้า `/ops` (ระงับ/คืนกลุ่ม) ได้ · ต้องเข้าสู่ระบบด้วย Google (อีเมลที่ Google ยืนยันแล้ว) · เว้นว่าง = ไม่มีใครเข้าได้ |
| `RLS_ENABLED` | ไม่ | `1` = เปิดการแยกข้อมูลระดับฐานข้อมูล (Row Level Security) · ค่าเริ่มต้นปิด · ต้องทำตามขั้นตอนใน `docs/SAAS-MIGRATION.md` Step 4 ก่อน (apply policies + role ที่ไม่ใช่ superuser) ไม่งั้นยังไม่ถูกบังคับจริง |

หลังตั้ง Google: เปิด `https://…/login` ต้องเห็นปุ่ม "เข้าสู่ระบบด้วย Google" กดได้ (ไม่ใช่สีจาง) · ผู้ดูแลเดิมยังเข้าได้ที่ปุ่ม "เข้าสู่ระบบผู้ดูแลระบบ" (ใช้ username เดิม)

**ฐานข้อมูลเดิมที่มีข้อมูลอยู่แล้ว** ห้าม deploy รุ่นนี้ตรงๆ — คอลัมน์ `tenantId` บังคับกรอก ต้องทำ expand → backfill → contract ตามคู่มือ **`docs/SAAS-MIGRATION.md`** ก่อน (ข้อมูลเดิมทั้งหมดจะกลายเป็นกลุ่มแรก) · ออกแบบรวมอยู่ใน `docs/SAAS-DESIGN.md`

## 3. ลำดับ deploy + ย้ายข้อมูล (สำคัญ)
1. Deploy ครั้งแรก แล้ว **Stop service `backend` ทันที** (หรือ deploy เฉพาะ postgres) — ให้ฐานใหม่ว่าง
2. SSH เข้า VPS แล้วรันสคริปต์ (แบบ docker exec เพราะ DB ไม่เปิดออกนอก):
   ```bash
   docker ps --format '{{.Names}}' | grep postgres          # หาชื่อ container
   export NEON_URL='postgresql://...neon.tech/...?sslmode=require'   # คัดลอกจาก Neon console เอง
   PG_CONTAINER=<ชื่อ container> ./deploy/migrate-from-neon.sh
   ```
   - ต้องมี `pg_dump`/`psql` รุ่น ≥ รุ่นของ Neon (`apt install postgresql-client-16` หรือ 17) สคริปต์เช็กให้
   - พิมพ์ `restore` เพื่อยืนยันปลายทาง → สคริปต์พิมพ์ตารางเทียบจำนวนแถว Neon vs ใหม่ ต้อง `OK` ทุกบรรทัด
   - รันซ้ำได้ (ใช้ `--clean --if-exists` ในทรานแซกชันเดียว)
3. **Start backend** → `prisma db push` เห็นตารางเดิมตรงแล้ว จะ **เพิ่ม** แค่ 2 ตารางใหม่ (`AiConversation`, `AiMessage`) ไม่ลบข้อมูล
   - ห้ามให้ backend รันบนฐานว่างก่อน restore แล้วลืม — ถ้าเผลอก็ไม่เสียหาย แค่รันสคริปต์ซ้ำแล้ว restart backend
4. ลบไฟล์ `kruscan-neon-*.dump` หรือเก็บแบบเข้ารหัส (มีข้อมูลนักเรียน)

## 4. ตรวจก่อนประกาศใช้
- [ ] เปิด `https://kruscan.<IP>.sslip.io` ได้ กุญแจล็อกขึ้น (ใบรับรองจริง)
- [ ] `https://…/api/health` ตอบ 200
- [ ] ล็อกอิน admin ด้วย **รหัสใหม่** ได้ · รหัสเก่าใช้ไม่ได้
- [ ] ล็อกอินครูตัวอย่าง 1 คน เห็นข้อมูลห้อง/งานครบ
- [ ] หน้าสแกนบนมือถือ เปิดกล้องได้ สแกน QR แล้วบันทึกได้
- [ ] สร้างลิงก์ผู้ปกครอง → ลิงก์ขึ้นต้นด้วยโดเมน sslip.io ใหม่ และเปิดได้
- [ ] สถานะ AI ขึ้นว่าพร้อม (ถ้าตั้ง key) · ลองถาม 1 ข้อ แล้วมีแถวใน `AiConversation`
- [ ] ตรวจ admin แปลกปลอม (ข้อ 7)
- [ ] ใช้งานจริงได้แล้วค่อยปิด/ลบ Neon (เก็บไว้สัก 1–2 สัปดาห์เผื่อ rollback)

## 5. สำรองข้อมูล
- **ง่ายสุด:** Coolify → Servers/Settings → S3 Storages (เพิ่ม bucket เช่น Backblaze B2 / Cloudflare R2) แล้วตั้ง scheduled backup ของ postgres รายวัน
  (หมายเหตุ: ปุ่ม Backups ใน Coolify ใช้กับ "Database resource" แยก — ถ้าฐานอยู่ใน compose ให้ใช้ Scheduled Task ด้านล่าง)
- **Scheduled Task** (resource นี้ → Scheduled Tasks → container `postgres`, cron `0 2 * * *`):
  ```sh
  sh -c 'mkdir -p /var/lib/postgresql/data/backups && pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /var/lib/postgresql/data/backups/kruscan-$(date +%F).dump && find /var/lib/postgresql/data/backups -name "*.dump" -mtime +14 -delete'
  ```
  แล้วคัดลอกออกนอกเครื่องเป็นระยะ (backup ที่อยู่ดิสก์เดียวกับฐาน = ไม่ใช่ backup ถ้าเครื่องพัง)
- ทดลอง restore จาก backup จริงอย่างน้อยเดือนละครั้ง

## 6. Rollback
- ระหว่างย้าย: Neon ไม่ถูกแตะ (อ่านอย่างเดียว) → ถ้ามีปัญหาแค่กลับไปใช้ระบบเดิม
- หลังใช้งานไปแล้ว: ข้อมูลใหม่อยู่บน VPS ถ้าจะกลับ Neon ให้ `pg_dump` จาก VPS แล้วรันสคริปต์กลับทิศ (NEON เป็นปลายทาง)
- โค้ดพัง: Coolify → Deployments → เลือก deployment ก่อนหน้า → Redeploy (volume `kruscan-pgdata` ไม่หาย)
- ฐานพัง: `pg_restore --clean --if-exists` จาก backup ล่าสุด เข้า container postgres

## 7. ความปลอดภัย
- `JWT_SECRET` ใหม่ (Coolify สร้าง) → token เก่าทั้งหมดใช้ไม่ได้ ทุกคนต้องล็อกอินใหม่ — ตั้งใจ
- ตั้ง `ADMIN_PASSWORD_HASH` เสมอ อย่าใช้รหัส admin เดิม
- `/register` เดิมเคยเปิดให้ใครก็สมัครได้ (ตอนนี้ต้องเป็น ADMIN) → ตรวจหา ADMIN ที่ไม่รู้จัก:
  ```sql
  -- docker exec -it <postgres> psql -U kruscan -d kruscan
  SELECT id, email, role, "teacherId", "studentId", "createdAt"
  FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt";

  -- บัญชีที่ไม่ผูกครู/นักเรียน (น่าสงสัย ทุก role)
  SELECT id, email, role, "createdAt" FROM "User"
  WHERE "teacherId" IS NULL AND "studentId" IS NULL ORDER BY "createdAt";

  -- ถ้าเจอบัญชีแปลก: ลดสิทธิ์ก่อน (ปลอดภัยกว่าลบ) แล้วค่อยลบเมื่อแน่ใจ
  -- UPDATE "User" SET role = 'TEACHER', password = 'disabled' WHERE id = <id>;
  ```
- Postgres และ backend ไม่มี `ports:` → เข้าจากอินเทอร์เน็ตไม่ได้ อย่าเพิ่ม port 5432 เปิดออก
- เปิด firewall แค่ 22, 80, 443 (และ 8000 ของ Coolify เฉพาะ IP ตัวเอง) · ใช้ SSH key ปิด password login
- ห้าม commit ไฟล์ `.env` จริง หรือไฟล์ dump เข้า git

## 8. PDPA
ข้อมูลนักเรียน/ผู้ปกครองเป็นข้อมูลส่วนบุคคลของผู้เยาว์ เมื่อย้ายมาเก็บเอง โรงเรียน/เจ้าของระบบคือผู้ควบคุมข้อมูลเต็มตัว:
- ระบุว่าเก็บข้อมูลที่ไหน (ประเทศของ VPS) และแจ้งในประกาศความเป็นส่วนตัว
- จำกัดคนเข้าถึง VPS/Coolify/backup และเข้ารหัส backup ที่เก็บนอกเครื่อง
- ลบ dump ชั่วคราวหลังย้าย และลบข้อมูลบน Neon เมื่อเลิกใช้ (ไม่ทิ้งสำเนาค้าง)
- มีแผนแจ้งเหตุข้อมูลรั่วภายใน 72 ชม. ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล
