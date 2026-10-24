# DESIGN.md — แนวทางออกแบบ UI (สำหรับ AI/dev ที่จะแก้หน้าจอ)

ผู้ใช้หลักคือครูที่ใช้มือถือระหว่างวัน ไม่ใช่ผู้ดูแลระบบ ทุกการตัดสินใจ UI ให้ยึด 6 ข้อนี้ก่อน

## 6 หลักการ

1. **หนึ่งหน้า หนึ่งปุ่มหลัก** — มีปุ่มสีน้ำเงินทึบ (primary) ได้ปุ่มเดียวต่อหน้า/ต่อ modal ที่เหลือเป็น secondary (ขอบเทา) หรือลิงก์
2. **ไม่ถามสิ่งที่ระบบรู้อยู่แล้ว** — ปีการศึกษาปัจจุบัน ห้อง/วิชาที่เลือกล่าสุด ต้องเติมให้เอง ห้ามบังคับเลือกซ้ำ
3. **ตอบก่อน ตัวกรองทีหลัง** — เปิดหน้ามาเห็นผลลัพธ์เลย (เช่น ใครค้างงาน) ตัวกรองซ่อนไว้ใต้ปุ่ม "เปลี่ยน" หรือ `ตัวเลือกเพิ่มเติม`
4. **ปุ่มทำลายข้อมูลลึกหนึ่งชั้น + ต้องยืนยัน** — ลบ/ย้าย/รีเซ็ตห้ามอยู่เป็นปุ่มเด่นในแถว ใช้ `ConfirmDialog type="danger"` เสมอ
5. **ใช้ภาษาครู ไม่ใช่ภาษาระบบ** — ห้ามโชว์ enum/ศัพท์โค้ดให้ผู้ใช้เห็น

   | ในโค้ด/เดิม | แสดงเป็น |
   |---|---|
   | NOT_SUBMITTED | ยังไม่ส่ง |
   | PENDING | รอตรวจ |
   | APPROVED | ผ่าน |
   | REJECTED | ไม่ผ่าน |
   | Export | ส่งออก |
   | SUBMISSION_ONLY / PASS_FAIL / SCORED | ส่งงานอย่างเดียว / ผ่าน-ไม่ผ่าน / ให้คะแนน |

6. **มือถือก่อน** — จุดแตะสูง/กว้าง ≥ 44px (`min-h-[44px]`) ปุ่มสำคัญอยู่โซนนิ้วโป้ง (ล่าง/ขวาล่าง) ห้ามเลื่อนแนวนอนที่ 360px (ตารางต้องมีการ์ดมือถือ) input ต้องฟอนต์ ≥ 16px (มี rule ใน index.css แล้ว)

## การนำทาง (IA, ต.ค. 2026)
- เมนูหลักครู 4 รายการ: หน้าแรก · ติดตามงาน (`/monitor`) · งาน (`/admin/tasks`) · ผู้ช่วย AI (`/ai`) — แอดมินเพิ่ม "ตั้งค่าระบบ" (`/admin/settings`) อีก 1 รายการ ไม่มีเมนูพับ/เมนูย่อยแล้ว
- "สแกนส่งงาน" (`/teacher/scan`) เป็น action หลัก ไม่ใช่เมนู: ปุ่มใหญ่บนหน้าแรก, ปุ่ม CTA สี accent บนสุดของ sidebar (lg+), ปุ่มกลมยกกลางแถบล่าง (< lg)
- จอ < lg: ไม่มี hamburger — แถบล่างคงที่ (เคารพ safe-area) `หน้าแรก · ติดตามงาน · [สแกน] · งาน · เพิ่มเติม`; "เพิ่มเติม" เป็น bottom sheet: ผู้ช่วย AI, ตั้งค่าระบบ (แอดมิน), ธีมสี, ออกจากระบบ · `main` เว้นล่าง `pb-[calc(6rem+safe-area)]` · AddFab ยกขึ้นพ้นแถบล่าง
- จอ lg+: sidebar แคบ `w-60` · header มีโลโก้ ชื่อ บทบาท ธีม ออกจากระบบ
- `/monitor?mode=subject|class` หน้าเดียว มี segmented toggle [รายวิชา | รายห้อง] (ค่าเริ่มต้นรายวิชา) render `SubjectMonitor`/`ClassMonitor` ด้วย prop `embedded` (ซ่อนหัวเดิม) · สลับโหมดพา ay/grade/class/subject ไปด้วย · URL เก่า `/monitor/class[/:id]`, `/monitor/subject` redirect มาที่นี่พร้อมพารามิเตอร์เดิม (`MonitorRedirect`) · `/monitor/student/:id` คงเดิม
- `/admin/settings` = การ์ด 9 ใบ (ไอคอน + คำอธิบาย 1 บรรทัด) จาก `SETTINGS_ITEMS` ใน `src/components/navConfig.js` (แหล่งเดียวของเมนู/ไอคอน) · หน้าย่อยแสดง breadcrumb "‹ ตั้งค่าระบบ › ชื่อหน้า" อัตโนมัติจาก Layout (เฉพาะแอดมิน)
- ลิงก์ใหม่ในแอปให้ชี้ `/monitor` เสมอ ห้ามใช้ `/monitor/class` หรือ `/monitor/subject`
- นักเรียน: หน้าเดียว ไม่มีแถบล่าง

## รูปแบบที่ใช้ซ้ำได้ (มีอยู่ในโค้ดจริง)

### `.modal-backdrop` / `.modal-panel` (`src/index.css`, `@layer components`)
- `.modal-backdrop` = `fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4` → บนมือถือเป็น bottom sheet, จอใหญ่อยู่กลาง
- `.modal-panel` = `w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white`
- ใช้คู่กัน: backdrop onClick ปิดเมื่อ `e.target === e.currentTarget` ใส่ปุ่มปิด ≥ 44px ในหัว panel ถ้าจะให้ติดขอบล่างบนมือถือใช้ `rounded-b-none sm:rounded-lg`

### SmartTable (`src/components/ui/SmartTable.js`)
ตารางที่มีค้นหา เรียง แบ่งหน้า ส่งออก (`exportable`, ปิดรายคอลัมน์ด้วย `exportable: false`) props ของ column:
- `key`, `label`, `sortable`, `render(value, row, index)`
- `mobilePrimary: true` — คอลัมน์เป็นบรรทัดแรก (หัวการ์ด) บนมือถือ ถ้าไม่ระบุใช้คอลัมน์แรกที่แสดงได้
- `mobileSecondary: true` — คอลัมน์ที่โชว์บรรทัดสองของการ์ด (สูงสุด 3 ค่า) ถ้าไม่มีใครระบุ ใช้คอลัมน์ที่เหลือ 3 ตัวแรก
- `hideOnMobile: true` — ซ่อนจากการ์ดมือถือ (ยังอยู่ในตารางจอ ≥ md)
- คอลัมน์ปุ่ม (`isAction: true` หรือ key เป็น `actions`/`action`) ไม่แสดงในการ์ดบนมือถือ — ใช้ `onRowClick` เปิดรายละเอียด/เมนูแทน
- มือถือ (< md) เป็นการ์ด (`md:hidden print:hidden`), จอ ≥ md เป็น `<table>`; **ตอนพิมพ์** แสดงเฉพาะตาราง (`print:table`) ซ่อนการ์ด ใช้ `print:hidden` / `print:block` กับของที่ไม่ควรพิมพ์

### AddFab (export จาก `SmartTable.js`)
`<AddFab onClick label="เพิ่มห้องเรียน" />` — ปุ่มกลมลอยมุมขวาล่าง เฉพาะ < sm (`sm:hidden print:hidden`) เคารพ safe-area หน้าที่ใช้ต้องเว้นท้ายหน้า (`pb-24 sm:pb-0`) ส่วนจอใหญ่ใช้ปุ่ม "เพิ่ม…" ในหัวหน้าตามปกติ (ตัวอย่าง: ManageClasses.js)

### ConfirmDialog (`src/components/ui/ConfirmDialog.js`)
props: `isOpen, onClose, onConfirm, title, message, confirmText, cancelText, type ('danger'|'warning'|'info'|'success'), mode ('confirm'|'alert')` — `onConfirm` ถูกเรียกแล้ว `onClose` ตามทันที ใช้ `type="danger"` + `confirmText` เป็นคำกริยาจริง ("ลบห้อง") ไม่ใช่ "ตกลง"; `mode="alert"` ใช้แทน `window.alert`

### ErrorBoundary (`src/components/ErrorBoundary.js`)
class component กันจอขาวเมื่อหน้าพัง แสดงข้อความ + ปุ่ม "โหลดใหม่" ห่อเนื้อหาหน้าใน route (ดู App.js/Layout) ไม่ต้องห่อซ้ำในแต่ละหน้า

### Context bar + ตัวกรองแบบ bottom sheet (หน้า `src/pages/monitor/*`)
- แถบ "กำลังดู" (`text-xs` ป้ายเล็ก + ชื่อ `contextLabel` เช่น `ม.2/1 · ทุกวิชา`) พร้อมปุ่ม "เปลี่ยน" (≥ 44px) — แสดงผลลัพธ์ก่อน
- กด "เปลี่ยน" → ตัวกรองเปิดเป็น `.modal-backdrop` + `.modal-panel` (bottom sheet บนมือถือ, inline panel บน lg+ ด้วย `lg:static lg:bg-transparent …`)
- ใต้แถบมี filter chips `[ยังไม่ส่ง N] [ทั้งหมด N]` (ค่าเริ่มต้น = ยังไม่ส่ง) และ pill สีเหลืองอำพัน `รอตรวจ N งาน` เมื่อมีงานรอตรวจ
- chips (ปุ่มกลม `rounded-full` ≥ 44px) ใช้สำหรับตัวกรอง/ทางลัดที่แตะแล้วทำทันที เช่น ตัวกรองด้านบน และคำถามตัวอย่างใน `pages/ai/AIAssistant.js`; badge สถานะเล็กในการ์ด (`ค้าง N` แดง / `ครบ` เขียว) เป็นข้อความอย่างเดียว ไม่ต้องแตะได้

### `<details>` "ข้อมูลเพิ่มเติม (ไม่บังคับ)"
ฟิลด์ที่ไม่จำเป็นในฟอร์ม (เบอร์โทร รายละเอียด ฯลฯ) ซ่อนใต้ `<details><summary className="cursor-pointer text-sm text-gray-600 select-none">ข้อมูลเพิ่มเติม (ไม่บังคับ)</summary>…` ฟอร์มจึงสั้น เห็นเฉพาะช่องที่ต้องกรอก (ตัวอย่าง: ManageClasses, ManageAcademicYears, ManageTeachers) ถ้ามีค่าอยู่แล้วให้ `open`

## เนื้อหา (ตัด/เพิ่ม)

**ตัด**
- หัวข้อรอง/คำอธิบายใต้หัวหน้าที่ซ้ำชื่อเมนู (เช่น "รายงานรายชื่อครูทั้งหมดในระบบ")
- คำแนะนำที่ไอคอนบอกอยู่แล้ว ("คลิกที่แถวเพื่อดูรายละเอียด" เมื่อมีลูกศร `›`)
- ตัวเลขซ้ำ ไอคอน/ภาพประดับ ข้อความภาษาอังกฤษที่หลงเหลือ คำอธิบายยาว
- เลขเวอร์ชัน/build — อย่างมากเป็น `v1.1.0` จางๆ ท้าย sidebar
- ข้อความสถานะที่เหมือนเดิมทุกครั้ง

**เพิ่ม (เมื่อจำเป็นจริง)**
- empty state ที่บอกว่าทำอะไรต่อ + ปุ่ม/ลิงก์ (ไม่มีนักเรียน → `นำเข้าข้อมูล`; ไม่มีวิชา → แจ้งผู้ดูแลระบบ)
- บริบทเมื่อตัวเลขอาจอ่านผิด (นับอะไร ช่วงไหน)
- ข้อความสำเร็จ/ผิดพลาดที่บอกทางแก้
- hint สั้นๆ จุดที่ครูมือใหม่ติด (สแกน: QR อยู่บนปกสมุด; นำเข้า: หัวคอลัมน์ต้องตรงไฟล์ตัวอย่าง)
- คำแนะนำตั้งค่าระบบ (เช่น AI key) แสดงเฉพาะผู้ดูแลระบบ ครูเห็นแค่ "แจ้งผู้ดูแลระบบ"

ภาษา: สั้น ง่าย คำที่ครูใช้ ไม่ใส่ "กรุณา" ถ้าไม่จำเป็น

## ก่อนส่งงาน (checklist)

- [ ] `cd frontend && CI=false npm run build` ผ่าน และไม่มี eslint warning ใหม่
- [ ] ถ่าย screenshot ที่ 390 / 768 / 1280 px ทุกหน้าที่แตะ — ไม่มี scroll แนวนอน ปุ่ม ≥ 44px (ตรวจที่ 360px ด้วย)
- [ ] ผ่านการตรวจ UX อิสระ (คนละ agent กับผู้เขียน) ได้ผล **PASS**
- [ ] ไม่มี enum/ศัพท์ระบบหลุดถึงผู้ใช้ ปุ่มทำลายข้อมูลมี ConfirmDialog

### WindowModal (`src/components/ui/WindowModal.js`)
popup แบบหน้าต่าง OS — ย่อ / ขยาย-คืนขนาด / ลากด้วยแถบหัว / ปิด ใช้แทน `.modal-backdrop > .modal-panel` + หัว panel
```jsx
<WindowModal open={show} title="แก้ไขนักเรียน" onClose={() => setShow(false)} id="edit-student"
  initialWidth="max-w-2xl" footer={<button className="...">บันทึก</button>}>
  <div className="p-4">...ฟอร์ม...</div>
</WindowModal>
```
- คลิก backdrop **ไม่ปิด** (กันข้อมูลหาย) · Esc ปิดเมื่อไม่ได้ย่อ · ดับเบิลคลิกหัว = ขยาย/คืนขนาด
- ย่อ = เนื้อหายัง mount (state ฟอร์มอยู่ครบ) แสดงเป็นชิปล่างซ้าย หน้าเบื้องหลังใช้ได้ปกติ
- มือถือ (< sm) = เต็มจอ มีแค่ ย่อ + ปิด · `id` ใช้จำตำแหน่ง/ขยาย ใน sessionStorage
- เนื้อหาเลื่อนในตัว ใส่ padding เอง (`p-4`) · ใส่ `data-autofocus` ที่ช่องแรกเพื่อให้โฟกัสตรงนั้น
