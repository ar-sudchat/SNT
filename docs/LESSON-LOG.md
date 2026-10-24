# บันทึกหลังแผน (Lesson log) — design and API contract

Teachers record the post-lesson paperwork their school requires after each lesson plan: the text form
**แบบบันทึกผลหลังการสอน**, and per-student rubrics (behaviour, activity, work, desirable traits,
key competencies). They pick an assessment type, name it themselves, fill it on a phone or computer,
and export Word files laid out like the school's originals. The clickable design reference is the demo
artifact (https://claude.ai/artifact/5hfqv1cY3A7FMGKR6QBAys).

## Concepts

- **Template** (`AssessmentTemplate`): `kind` `NOTE` (text form, per class) or `RUBRIC` (per student).
  A rubric is `criteria` × scale `1..maxScore` → total → quality `level`. Six built-ins are seeded per
  group on first use (`services/assessmentCore.js` `BUILTINS`, `ensureBuiltins`). Teachers can add custom
  templates (`key` = `c-<timestamp>`); managers may edit built-in names/criteria.
- **Record** (`AssessmentRecord`): one filled-in form for one class (+ optional subject). Criteria,
  `maxScore`, `useAverage`, `levels`, `kind` and `templateName` are **snapshotted** at creation so later
  template edits never change old records. `status` `DRAFT` until the teacher presses บันทึก → `DONE`.
- **Score** (`AssessmentScore`): one row per (record, student), `values` = int per criterion.
  Students default to full marks (teacher taps down the exceptions). Students added to the class after
  the record was created appear with full marks when the record is read.
- **Level rule**: `ratio = total / (criteria.length × maxScore)`; first level (sorted by `min` desc) with
  `ratio >= min`. `useAverage` only changes how the total is shown (average per criterion, 2 decimals).
  Implemented once in `backend/services/assessmentCore.js` (`scoreOf`) and mirrored in
  `frontend/src/pages/lessonlog/lessonLogCore.js`.
- **Doc settings** (`Tenant.docSettings` JSON): `{ schoolName, signers: [{ role, name }] }`, defaults in
  `assessmentCore.DEFAULT_SETTINGS`. Used for the signature block of exported Word files.

## Permissions

All routes: `authenticate, authorize('ADMIN','TEACHER')`, data scoped to the current group automatically by
the Prisma extension (never pass tenantId yourself; use `findFirst` rather than `findUnique` on the new models).
- View: any staff member of the group can list/read records and templates.
- Edit/delete a record: its creator (`teacherId === req.user.teacherId`) or a manager
  (`req.user.role === 'ADMIN' || req.user.canManage`). `canEdit` in responses tells the UI.
- Templates: anyone creates custom templates; edit/delete custom = creator or manager; built-ins = managers only;
  built-ins cannot be deleted. A template with records is deactivated (`status: 'INACTIVE'`) instead of deleted.
- `PUT /settings`: managers only (route uses `isAdmin`).
- `req.user.teacherId` is null for the global ADMIN account; store `teacherId: null` then.

## API (`/api/assessments`)

Errors: `{ error: '<Thai message>' }` with 400 (validation), 403 (not allowed), 404 (not found in this group).

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/templates` | — | `Template[]` active only, built-ins first in BUILTINS order, then custom by name |
| POST | `/templates` | `{ name, kind, maxScore, useAverage, criteria, levels }` | `Template` (201) |
| PUT | `/templates/:id` | partial of the above | `Template` |
| DELETE | `/templates/:id` | — | `{ ok: true, deactivated: boolean }` |
| GET | `/settings` | — | `{ schoolName, signers, teacherName }` (`teacherName` = current user's Teacher.name or display name) |
| PUT | `/settings` | `{ schoolName, signers }` | same as GET |
| GET | `/records` | `classId` (required), `subjectId?`, `templateId?`, `status?` | `RecordListItem[]` newest first (`assessedOn` desc, id desc) |
| POST | `/records` | `{ templateId, classId, subjectId?, name, dateText?, header? }` | `RecordDetail` (201) |
| GET | `/records/:id` | — | `RecordDetail` |
| PUT | `/records/:id` | `{ name?, dateText?, header?, note?, status? }` | `RecordDetail` |
| PUT | `/records/:id/scores` | `{ scores: [{ studentId, values }] }` (only changed students) | `RecordDetail` |
| DELETE | `/records/:id` | — | `{ ok: true }` |
| POST | `/records/:id/fill-from-task` | `{ taskId, criterionIndex }` | `RecordDetail & { filled }` |
| GET | `/summary` | `classId` (required), `subjectId?` | `{ records: [{ id, name, templateName, dateText, maxScore, criteriaCount }], students: [{ id, studentNumber, name, results: { [recordId]: { total, average, level } } }] }` — RUBRIC records only |
| GET | `/export` | `ids=1,2,3` (max 60) | `.docx` file (`Content-Disposition: attachment; filename*=UTF-8''<name>.docx`) |

Shapes:
```
Template        { id, key, name, kind, maxScore, useAverage, criteria: [{ label, short, source? }],
                  levels: [{ min, label }], isBuiltIn, createdById, canEdit }
RecordListItem  { id, name, dateText, assessedOn, kind, templateId, templateKey, templateName, status,
                  classId, subjectId, teacherId, teacherName, updatedAt, canEdit }
RecordDetail    RecordListItem & { header, note, criteria, maxScore, useAverage, levels,
                  class: { id, className }, subject: { id, subjectName } | null,
                  students: [{ id, studentNumber, name, studentCode, values, total, average, level }],
                  levelCounts: { [label]: n } }
```
- `header` (NOTE): `{ planNo, unitNo, unitName }` strings. `note` (NOTE): `{ pct (0–100 int), outcome,
  problems: string[], fixes: string[], extra }`. Validate and clip (strings ≤ 500 chars, ≤ 20 list items).
- Students in `RecordDetail`: active students of the record's class, ordered by `studentNumber` then name.
  RUBRIC only (NOTE records return `students: []`).
- `fill-from-task`: criterion `criterionIndex` per student from the task's submissions:
  APPROVED/PENDING with `submitDate <= deadline` (or no deadline) → `maxScore`; submitted late → `maxScore - 1`
  (min 1); NOT_SUBMITTED / REJECTED / no row → 1. The task must belong to this group.

## Word export layout (A4, font "TH SarabunPSK", 16pt body)

- One section per record, page break between records, sorted by `assessedOn` then id.
- NOTE: centered bold title "แบบบันทึกผลหลังการสอน"; lines "แผนการจัดการเรียนรู้ที่ {planNo} {name}   วิชา {subject}",
  "หน่วยที่ {unitNo} ชื่อหน่วย {unitName}", "ระดับชั้น {className}   วัน/เดือน/ปีที่สอน {dateText}"; bold headings
  ผลการเรียนรู้ / ปัญหา / อุปสรรค / ข้อเสนอแนะ / แนวทางแก้ไข with the outcome sentence, problems (one per line),
  fixes numbered (+ extra). Signature block: "ลงชื่อ.................ครูผู้สอน" with "({teacherName})", then the sentence
  "บันทึกหลังการสอน ตามแผนการจัดการเรียนรู้ฉบับนี้ ได้รับการพิจารณาแล้ว" and one "ลงชื่อ......" + "({name})" + role per signer.
- RUBRIC: centered bold title = templateName; line "ชื่อกิจกรรม {name}   ประเมิน วันที่ {dateText}"; line "ระดับชั้น {className}
  วิชา {subject}"; table: ที่ | ชื่อ-สกุล | per criterion a merged header cell with `maxScore` sub-columns (max..1) and ✓ in
  the chosen one | รวม (or เฉลี่ย when useAverage) | ระดับคุณภาพ. Under it a small table ช่วงคะแนน → ระดับคุณภาพ built from
  levels, then "ลงชื่อ.................ผู้ประเมิน ({teacherName})".
- Names "ด.ช."/"ด.ญ." printed as stored.

## Frontend

Routes (all `ProtectedRoute roles={['ADMIN','TEACHER']}`, inside Layout):

| Path | File | Owner |
|---|---|---|
| `/lesson-log` | `pages/lessonlog/LessonLogHome.js` | list + filters + class picker |
| `/lesson-log/new` | `pages/lessonlog/CreateRecord.js` | pick type, name it |
| `/lesson-log/:id` | `pages/lessonlog/RecordPage.js` | loads record, renders NoteEditor or RubricEditor |
| `/lesson-log/export` | `pages/lessonlog/ExportPage.js` | choose records, preview, download .docx |
| `/lesson-log/summary` | `pages/lessonlog/SummaryPage.js` | per-student results for the term |
| `/lesson-log/templates` | `pages/lessonlog/TemplatesPage.js` | manage templates + doc settings |

Shared (already written — import, don't fork): `services/api.js` `assessmentAPI`, `pages/lessonlog/lessonLogCore.js`,
`pages/lessonlog/useLessonContext.js`. Components: `components/lessonlog/RubricEditor.js`,
`components/lessonlog/NoteEditor.js`, `components/lessonlog/PaperPreview.js`.
Follow `DESIGN.md`: Thai teacher language, one primary button per screen, ≥44px targets, mobile cards instead of wide
tables (except the rubric grid on md+, which may scroll inside its own container), `useDialog()` instead of
alert/confirm/prompt, brand tokens (`brand-*`, `accent`), Bai Jamjuree already global.

## v2 — custom response formats and how a form is done (owner request 2026-10-24)

Teachers build their own forms and choose how they are done, like the school's paper forms: some are
answered once for the class, some per student, some both.

- `kind`: `NOTE` (built-in post-lesson text form, unchanged) · `RUBRIC` (per-student section, optional class
  questions) · `CLASS` (class questions only). Scope shown to teachers: CLASS → "ระดับห้อง", RUBRIC without class
  questions → "รายนักเรียน", RUBRIC with class questions → "ระดับห้อง + รายนักเรียน" (`scopeOf` in lessonLogCore).
- `classFields` (template + record snapshot): `[{ key, label, type, options? }]`, ≤20; `type` ∈ `text` (≤500),
  `longtext` (≤3000), `number`, `choice` (one of options), `checklist` (subset of options); options ≤20 × ≤60 chars.
  Cleaned by `assessmentCore.cleanClassFields`. Answers live in `AssessmentRecord.classAnswers` `{ [key]: value }`,
  cleaned by `cleanClassAnswers(record, answers)` (unknown keys dropped).
- `responseType` (template + record snapshot), per-student answer for every criterion:
  `SCORE` 1..maxScore (unchanged) · `PASSFAIL` 2 = ผ่าน, 1 = ไม่ผ่าน (maxScore stored 2) · `CHECK` 1 = ✓, 0 = blank
  (maxScore 1) · `TEXT` string ≤200 (maxScore 0, no total/level). Defaults: full marks / ผ่าน / ✓ / ''.
  `scoreOf`: PASSFAIL/CHECK total = number of ผ่าน/✓, ratio = total / criteria; levels optional for them
  (level '' when none); TEXT → `{ total: 0, average: 0, level: '' }`. `validValues`, `fullValues` handle all types.
- API changes:
  - Template shape adds `responseType, classFields`. POST/PUT accept them (validated by `cleanTemplateInput`).
  - Record create snapshots `responseType, classFields`; RecordListItem/RecordDetail add `responseType, classFields,
    classAnswers`. `PUT /records/:id` accepts `classAnswers` (RUBRIC with classFields, or CLASS). CLASS records return
    `students: []` like NOTE.
  - `saveScores` validates by responseType. `fill-from-task`: SCORE as before; PASSFAIL on time/late → 2, missing → 1;
    CHECK on time/late → 1, missing → 0; TEXT → 400.
  - `/summary` includes RUBRIC records except TEXT; cells show level when present, else "ผ่าน n/N" / "✓ n/N".
- Word export: class questions section (label in bold, answer below; checklist printed as ☑/☐ per option) for CLASS
  records and above the student table for RUBRIC with class questions. Student table by type: SCORE as before;
  PASSFAIL two sub-columns ผ่าน | ไม่ผ่าน with ✓; CHECK one column per criterion with ✓; TEXT one column per criterion
  with the text. รวม/ระดับ columns and the level-range table only when the type has points and levels exist.
