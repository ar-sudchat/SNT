# โครงการระบบติดตามสมุดนักเรียนผ่าน QR Code

## ข้อมูลโครงการ

**ชื่อโครงการ:** Student Notebook Tracking System via QR Code
**วัตถุประสงค์:** ระบบบันทึกและติดตามการส่งสมุด/ใบงานของนักเรียน
**สถานะ:** ระหว่างการพัฒนา
**วันที่สร้าง:** January 2026

---

## วัตถุประสงค์โครงการ

1. ติดตามการส่งสมุด/ใบงานของนักเรียนแต่ละวิชา
2. ให้ครูสามารถบันทึกสถานะการส่งงาน (ผ่าน/ไม่ผ่าน) ผ่านระบบ
3. แสดงสรุปการส่งงานให้กับครู นักเรียน และผู้บริหาร
4. เพิ่มความสะดวกและความเร็วในการตรวจสอบการส่งงาน

---

## ขอบเขตโครงการ (Project Scope)

### รวมอยู่ในโครงการ
- ระบบสแกน QR code ผ่านโทรศัพท์
- ระบบบันทึกสถานะงาน (ผ่าน/ไม่ผ่าน)
- Dashboard ครู (Teacher Dashboard)
- Dashboard นักเรียน (Student Portal)
- Dashboard ผู้บริหาร (Admin Dashboard)
- รายงานสรุป (Reports & Summary)
- ฐานข้อมูลบันทึก

### ไม่รวมในโครงการนี้
- ระบบให้ Upload ไฟล์งาน
- ระบบให้ Grade/คะแนน (เหลือไว้สำหรับ Phase ต่อไป)
- ระบบส่งงานออนไลน์
- Mobile App (ใช้ Web App ดำเนิน)

---

## Flow หลักของระบบ

```
ขั้นตอนการทำงาน:

1. Admin สร้าง QR Code
   └─> แปะบนสมุด/ใบงาน

2. ครูแสกน QR Code ผ่านโทรศัพท์
   └─> ระบบแสดง: ชื่อนักเรียน + วิชา + List งาน

3. นักเรียนส่งสมุด/ใบงานให้ครู (จริง ๆ)
   └─> ครูตรวจด้วยมือ

4. ครูบันทึกผลลัพธ์
   └─> ผ่าน / ไม่ผ่าน

5. ระบบบันทึกข้อมูล
   └─> อัปเดต Dashboard ต่าง ๆ

6. ครู นักเรียน ผู้บริหาร ดูรายงาน
   └─> ตรวจสอบสถานะการส่งงาน
```

---

## User Roles (บทบาทของผู้ใช้)

### 1. Teacher (ครู)
- แสกน QR code เพื่อดูรายละเอียดนักเรียนและงาน
- บันทึกสถานะงาน (ผ่าน/ไม่ผ่าน)
- เพิ่มหมายเหตุเมื่อตรวจงาน
- ดูรายงานสรุปการส่งงานต่อวิชา
- ดูรายงานสรุปการส่งงานต่อนักเรียน

### 2. Student (นักเรียน)
- ดูรายการงานของตนเอง
- ติดตามสถานะการส่งงาน (ผ่าน/ไม่ผ่าน)
- ดูหมายเหตุจากครู

### 3. Administrator (ผู้บริหาร)
- จัดการข้อมูลนักเรียน
- จัดการข้อมูลครู
- จัดการข้อมูลวิชา
- สร้าง QR code สำหรับสมุด
- ดูรายงานสรุปทั้งหมด
- ดูสถิติและผลการส่งงาน

---

## โครงสร้างโปรเจค

```
SNT/
├── backend/                    # Node.js/Express Backend
│   ├── config/                 # Configuration files
│   ├── controllers/            # Route controllers
│   ├── middleware/             # Custom middleware
│   ├── models/                 # Database models
│   ├── routes/                 # API routes
│   ├── services/               # Business logic
│   ├── utils/                  # Utility functions
│   ├── uploads/                # File uploads
│   ├── .env.example            # Environment example
│   ├── package.json
│   └── server.js               # Entry point
│
├── frontend/                   # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API services
│   │   ├── context/            # React context
│   │   ├── hooks/              # Custom hooks
│   │   └── utils/              # Utility functions
│   └── package.json
│
├── database/                   # Database scripts
│   ├── migrations/             # Database migrations
│   └── schema.sql              # Initial schema
│
├── templates/                  # Import templates
│   ├── Grade_Template.csv
│   ├── Class_Template.csv
│   ├── Student_Template.csv
│   ├── Teacher_Template.csv
│   ├── Subject_Template.csv
│   └── Task_Template.csv
│
└── docs/                       # Documentation
    └── API.md                  # API documentation
```

---

## การติดตั้ง (Installation)

### ความต้องการ
- Node.js v18 หรือสูงกว่า
- PostgreSQL หรือ MySQL
- npm หรือ yarn

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# แก้ไขค่าใน .env ตามความเหมาะสม
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Database Setup
```bash
# สร้างฐานข้อมูล
createdb snt_db

# รัน migrations
cd backend
npm run migrate
```

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - เข้าสู่ระบบ
- `POST /api/auth/logout` - ออกจากระบบ
- `GET /api/auth/me` - ข้อมูลผู้ใช้ปัจจุบัน

### Grades (ชั้นปี)
- `GET /api/grades` - รายการชั้นปี
- `POST /api/grades` - สร้างชั้นปี
- `PUT /api/grades/:id` - แก้ไขชั้นปี
- `DELETE /api/grades/:id` - ลบชั้นปี

### Classes (ห้องเรียน)
- `GET /api/classes` - รายการห้องเรียน
- `POST /api/classes` - สร้างห้องเรียน
- `PUT /api/classes/:id` - แก้ไขห้องเรียน
- `DELETE /api/classes/:id` - ลบห้องเรียน

### Students (นักเรียน)
- `GET /api/students` - รายการนักเรียน
- `POST /api/students` - สร้างนักเรียน
- `PUT /api/students/:id` - แก้ไขนักเรียน
- `DELETE /api/students/:id` - ลบนักเรียน

### Teachers (ครู)
- `GET /api/teachers` - รายการครู
- `POST /api/teachers` - ��ร้างครู
- `PUT /api/teachers/:id` - แก้ไขครู
- `DELETE /api/teachers/:id` - ลบครู

### Subjects (วิชา)
- `GET /api/subjects` - รายการวิชา
- `POST /api/subjects` - สร้างวิชา
- `PUT /api/subjects/:id` - แก้ไขวิชา
- `DELETE /api/subjects/:id` - ลบวิชา

### Tasks (งาน)
- `GET /api/tasks` - รายการงาน
- `POST /api/tasks` - สร้างงาน
- `PUT /api/tasks/:id` - แก้ไขงาน
- `DELETE /api/tasks/:id` - ลบงาน

### QR Codes
- `POST /api/qrcodes/generate` - สร้าง QR Code
- `GET /api/qrcodes/:id` - ข้อมูล QR Code
- `POST /api/qrcodes/scan` - สแกน QR Code

### Submissions (การส่งงาน)
- `GET /api/submissions` - รายการการส่งงาน
- `POST /api/submissions` - บันทึกการส่งงาน
- `PUT /api/submissions/:id` - แก้ไขสถานะการส่งงาน

### Data Import
- `POST /api/import/grades` - Import ชั้นปี
- `POST /api/import/classes` - Import ห้องเรียน
- `POST /api/import/students` - Import นักเรียน
- `POST /api/import/teachers` - Import ครู
- `POST /api/import/subjects` - Import วิชา
- `POST /api/import/tasks` - Import งาน

### Reports
- `GET /api/reports/teacher/:id` - รายงานสำหรับครู
- `GET /api/reports/student/:id` - รายงานสำหรับนักเรียน
- `GET /api/reports/admin` - รายงานสำหรับผู้บริหาร

---

## Technology Stack

### Backend
- **Framework:** Node.js + Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT
- **File Processing:** multer, csv-parser, xlsx
- **Validation:** Joi

### Frontend
- **Framework:** React.js
- **Styling:** Tailwind CSS
- **QR Code:** qrcode (generate), html5-qrcode (scan)
- **HTTP Client:** Axios
- **State Management:** React Context + useReducer

---

## Timeline/Roadmap

### Phase 1: MVP
- QR Code Generator
- QR Code Scanner
- Teacher Dashboard (Scan + บันทึก)
- Basic Database

### Phase 2: Enhancement
- Student Portal
- Admin Dashboard
- Reports & Analytics
- Data Import

### Phase 3: Advanced (อนาคต)
- Grade/Score System
- File Upload
- Mobile App
- Email Notification

---

## Security

- JWT Authentication
- Role-based Authorization
- Password Hashing (bcrypt)
- Input Validation
- SQL Injection Prevention (Prisma ORM)
- CORS Configuration

---

## License

MIT License

---

**Document Version:** 1.0
**Last Updated:** January 2026
