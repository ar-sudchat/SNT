# KruScan e2e smoke test

ชุดทดสอบ smoke แบบ end-to-end ด้วย Playwright (`@playwright/test` 1.59.0) รันบน 2 โปรเจกต์: `phone` (390x844) และ `desktop` (1280x800)
ใช้เฉพาะการอ่านหรือการกระทำที่ไม่ทำลายข้อมูล (ไม่บันทึกข้อมูลใหม่) ถ้าจะเพิ่มเทสต์ที่สร้างข้อมูล ให้ตั้งชื่อ `E2E-…` และลบทิ้งท้ายเทสต์

## เตรียมระบบก่อนรัน

1. ฐานข้อมูลทดสอบ (local) ที่มีผู้ใช้ `admin/1234` และครู `T001/T001` — ห้ามชี้ไป production
2. รัน backend (พอร์ต 5001):
   ```bash
   cd backend && npm install && npx prisma generate && npm start
   ```
3. build frontend แล้ว serve (พอร์ต 4173) — build ต้องชี้ API มาที่ backend ข้างบน (ค่าเริ่มต้น `http://localhost:5001/api`):
   ```bash
   cd frontend && npm install && npm run build && npx serve -s build -l 4173
   ```
4. ติดตั้งเทสต์ครั้งแรก:
   ```bash
   cd e2e && npm install
   npx playwright install chromium   # ข้ามได้ ถ้ามี Chromium แคชอยู่แล้ว (ดูด้านล่าง)
   ```

## รัน

```bash
cd e2e
npx playwright test                    # ทั้งสอง project
npx playwright test --project=phone    # เฉพาะมือถือ
npx playwright test -g "ธีมสี"          # เฉพาะเทสต์ที่ชื่อตรง
npx playwright show-report             # ดูรายงาน HTML (มี screenshot/trace ของเทสต์ที่ล้ม)
```

## ตัวแปรสภาพแวดล้อม

| ตัวแปร | ค่าเริ่มต้น | ใช้ทำอะไร |
|---|---|---|
| `SNT_URL` | `http://localhost:4173` | URL ของหน้าเว็บ (frontend) |
| `SNT_API` | `http://localhost:5001/api` | URL ของ backend API (ใช้ในเทสต์ดาวน์โหลดเทมเพลต) |
| `SNT_CHROMIUM` | แคชที่ `~/Library/Caches/ms-playwright/chromium_headless_shell-1228/...` | path ของ Chromium ถ้าไม่ได้ติดตั้งเบราว์เซอร์ของ Playwright |

`playwright.config.js` จะใช้ Chromium ที่แคชไว้ผ่าน `launchOptions.executablePath` เมื่อไฟล์นั้นมีอยู่ ไม่งั้นใช้เบราว์เซอร์ที่ `playwright install` ลงไว้

## ข้อควรระวัง

- **ตัวจำกัดการล็อกอิน**: backend ล็อก 15 นาที เมื่อรหัสผิดเกิน 5 ครั้งต่อ (IP + username) — เทสต์รหัสผิดจึงใช้ username `E2E-no-such-user` ไม่แตะ `admin`/`T001` อย่าเอา `admin` ไปลองรหัสผิดซ้ำๆ ด้วย curl ระหว่างรัน
- เมนูนำทางกำลังออกแบบใหม่ เทสต์จึงใช้ URL ตรงและหัวข้อ (heading) เป็นหลัก ยกเว้นเทสต์ธีมสีบนมือถือที่ต้องเปิดแผ่น "เพิ่มเติม" ก่อน
- เทสต์ "รหัสผ่านผิด" ล้มอยู่ตอนเขียน เพราะ `frontend/src/services/api.js` มี interceptor ที่เจอ 401 แล้ว `window.location.href = '/login'` ทำให้หน้ารีโหลดและกล่องแจ้งเตือน "เข้าสู่ระบบไม่สำเร็จ" หายก่อนผู้ใช้เห็น (บั๊กจริงของแอป ไม่ใช่ของเทสต์)

## เทสต์กลุ่ม (`tests/groups.spec.js`)

สมัครผู้ใช้จริงผ่านหน้าเว็บ (อีเมล `e2e-grp-*@example.test`) ต่อ backend local แล้ว **ลบทิ้งผ่าน `psql`** ตอนจบ (`cleanupE2EData` ใน `helpers.js`) — ปฏิเสธรันถ้า URL ฐานข้อมูลไม่ใช่ `snt_local` (ค่าเริ่มต้น `postgresql://$USER@localhost:5432/snt_local?host=/tmp`, เปลี่ยนได้ด้วย `E2E_DATABASE_URL`) · backend ที่เทสต์ยิงต้องใช้ฐานเดียวกัน ห้ามชี้ production
เทสต์ทุกข้อล้มทันทีถ้าเกิด `alert/confirm/prompt` ของเบราว์เซอร์ (`page.on('dialog')`)

## รายการเทสต์

ล็อกอิน admin / ครู / รหัสผิด · หน้าแรกครู + "สแกนส่งงาน" · สแกนเนอร์พิมพ์รหัสผิดแล้วขึ้นข้อความไทย · รายชื่อนักเรียน + หน้าต่าง ย่อ/คืน/ปิด · สร้างงานว่างแล้วขึ้น "กรุณาเลือกวิชา" · API เทมเพลตนำเข้า 200 · หน้าติดตามงาน · ธีมสีสลับและคงอยู่หลังรีโหลด · ไม่มีหน้าล้นแนวนอนที่ 360px · ไม่มี console error

กลุ่ม: Landing มีปุ่มสมัคร · ปุ่ม Google บน /login และ /signup + ปุ่มสลับผู้ดูแลระบบ · สมัครแล้วเห็นกลุ่มส่วนตัวในตัวสลับ · รหัสเข้ากลุ่ม XXX-XXX · คนที่สองเข้าร่วมด้วยรหัส สลับกลุ่มได้ · รายชื่อสมาชิก · ออกจากกลุ่มแล้วกลับกลุ่มส่วนตัว · กล่อง "+ สร้างกลุ่มใหม่" แล้วยกเลิก
