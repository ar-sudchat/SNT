# I18N-GLOSSARY.md: คู่มือแปลหน้าเว็บ KruScan

ทำด้วย skill `design:ux-copy` · ใช้คู่กับ `docs/I18N.md` (วิธีครอบข้อความ) และ `docs/THAI-COPY.md` (ต้นฉบับไทย)

## ผู้อ่านและน้ำเสียง

ผู้ใช้คือ **ครูต่างชาติที่สอนในโรงเรียนไทย** (ครูภาษาอังกฤษ จีน ญี่ปุ่น เกาหลี ฝรั่งเศส เยอรมัน) ใช้บนมือถือระหว่างคาบ ต้องอ่านแล้วกดได้ทันที
น้ำเสียง: เพื่อนร่วมงานที่ช่วยเหลือ สุภาพ สั้น ตรง ไม่ทางการแบบเอกสาร ไม่ขายของ

| ภาษา | กติกา |
|---|---|
| English | sentence case ("Save changes") · ปุ่ม = กริยา · ไม่ใช้ "!" · error = เกิดอะไร + ทำอะไรต่อ |
| 中文 | **简体中文** · 标点用全角（，。：？） · 少用"您"，界面文字尽量省略人称 · 按钮用动词（保存、删除） |
| 日本語 | メッセージは です・ます調 · ボタンは短く（保存、削除、追加） · カタカナ語は必要なものだけ |
| 한국어 | 메시지는 해요체 · 버튼은 짧은 명사형/동사형(저장, 삭제, 추가) · 띄어쓰기 표준 |
| Français | vouvoiement · boutons à l'infinitif (« Enregistrer ») · guillemets « » · espace avant : ; ? ! |
| Deutsch | Sie-Form · Buttons im Infinitiv („Speichern“) · geschlechtergerecht: „Lehrkraft“ · kurze Wörter bevorzugen (Handy) |

## กติกาที่ห้ามพลาด

1. **ตัวแปร `{name}` ต้องคงไว้ครบทุกตัว สะกดเหมือนเดิม** ย้ายตำแหน่งได้ตามไวยากรณ์ ห้ามแปลชื่อตัวแปร
2. คงสัญลักษณ์ต้นฉบับ: `…` `·` `/` `→` `✓` อีโมจิ ตัวเลข และช่องว่างหน้า/หลังที่มีความหมาย
3. **ไม่แปล**: KruScan, QR Code, Excel, Word, CSV, PDF, LINE, Google, AI, ชื่อคน, รหัสชั้นไทยที่เป็นข้อมูล (ป.4/1, ม.1) — ตัวอย่างในช่องกรอกเช่น "เช่น ป.4/1" ให้แปลคำว่า "เช่น" แต่คง "ป.4/1"
4. วันที่แบบ พ.ศ. ในข้อความ (เช่น "69", "2569") คงไว้
5. ความยาว: ปุ่มและหัวคอลัมน์ไม่ควรยาวเกิน ~1.5 เท่าของภาษาไทย (จอมือถือ) — เยอรมัน/ฝรั่งเศสเลือกคำสั้น
6. ข้อความที่เป็นท่อนของประโยค (ต้นฉบับถูกตัดเป็นชิ้น) แปลให้อ่านได้เมื่อต่อกัน อย่าใส่จุดเอง
7. คำเดียวกันใช้คำแปลเดียวกันทุกที่ ตามตารางด้านล่าง

## ตารางศัพท์

| ไทย | English | 中文 | 日本語 | 한국어 | Français | Deutsch |
|---|---|---|---|---|---|---|
| ห้องเรียน / ห้อง (ป.4/1) | Class | 班级 | クラス | 반 | Classe | Klasse |
| ชั้น (ป.4, ม.1) | Grade | 年级 | 学年 | 학년 | Niveau | Klassenstufe |
| ปีการศึกษา | Academic year | 学年度 | 年度 | 학년도 | Année scolaire | Schuljahr |
| ภาคเรียน / เทอม | Semester | 学期 | 学期 | 학기 | Semestre | Halbjahr |
| วิชา | Subject | 科目 | 教科 | 과목 | Matière | Fach |
| งาน (ที่ครูสั่ง) | Assignment | 作业 | 課題 | 과제 | Devoir | Aufgabe |
| สมุด | Notebook | 作业本 | ノート | 공책 | Cahier | Heft |
| ส่งงาน | Submit | 交作业 | 提出 | 제출 | Rendre | Abgeben |
| ยังไม่ส่ง | Not submitted | 未交 | 未提出 | 미제출 | Non rendu | Nicht abgegeben |
| รอตรวจ | To check | 待批改 | 確認待ち | 확인 대기 | À vérifier | Zu prüfen |
| ผ่าน | Passed | 通过 | 合格 | 통과 | Validé | Bestanden |
| ไม่ผ่าน | Not passed | 未通过 | 不合格 | 미통과 | Non validé | Nicht bestanden |
| ไม่ได้รับงาน | Not assigned | 未布置 | 対象外 | 미배정 | Non attribué | Nicht zugewiesen |
| ส่ง/ไม่ส่ง · ผ่าน/ไม่ผ่าน · ให้คะแนน | Submitted/Not · Pass/Fail · Score | 交/未交 · 通过/未通过 · 打分 | 提出/未提出 · 合否 · 点数 | 제출/미제출 · 통과/미통과 · 점수 | Rendu/Non rendu · Validé/Non validé · Note | Abgegeben/Nicht · Bestanden/Nicht · Punkte |
| สแกน | Scan | 扫描 | スキャン | 스캔 | Scanner | Scannen |
| ติดตามงาน | Progress | 作业进度 | 進捗 | 과제 현황 | Suivi | Fortschritt |
| ทวงงาน | Send reminder | 催交 | 催促する | 독촉하기 | Relancer | Erinnern |
| นักเรียน | Student | 学生 | 生徒 | 학생 | Élève | Schüler |
| ผู้ปกครอง | Parent | 家长 | 保護者 | 학부모 | Parent | Eltern |
| ครู | Teacher | 教师 | 教員 | 교사 | Enseignant | Lehrkraft |
| ครูผู้สอน | Subject teacher | 任课教师 | 教科担当 | 교과 담당 교사 | Enseignant de la matière | Fachlehrkraft |
| ครูประจำชั้น | Homeroom teacher | 班主任 | 担任 | 담임 교사 | Professeur principal | Klassenlehrkraft |
| กลุ่ม (พื้นที่ทำงานของโรงเรียน/ทีม) | Group | 群组 | グループ | 그룹 | Groupe | Gruppe |
| ผู้ดูแลกลุ่ม | Group admin | 群组管理员 | グループ管理者 | 그룹 관리자 | Admin du groupe | Gruppen-Admin |
| ผู้ดูแลระบบ | Admin | 管理员 | 管理者 | 관리자 | Administrateur | Administrator |
| รหัสเชิญ / รหัสเข้ากลุ่ม | Invite code | 邀请码 | 招待コード | 초대 코드 | Code d'invitation | Einladungscode |
| บันทึกหลังแผน | Post-lesson notes | 课后记录 | 授業後記録 | 수업 후 기록 | Bilan de séance | Unterrichtsprotokoll |
| แผนการจัดการเรียนรู้ / แผนที่ | Lesson plan / Plan no. | 教案 / 教案编号 | 指導案 / 指導案番号 | 수업 계획 / 계획 번호 | Fiche de séance / N° de fiche | Unterrichtsplan / Plan-Nr. |
| หน่วยการเรียนรู้ / หน่วยที่ | Unit / Unit no. | 单元 / 单元编号 | 単元 / 単元番号 | 단원 / 단원 번호 | Unité / N° d'unité | Einheit / Einheit-Nr. |
| แบบประเมิน | Assessment form | 评价表 | 評価表 | 평가표 | Grille d'évaluation | Bewertungsbogen |
| เทมเพลต / แม่แบบ | Template | 模板 | テンプレート | 템플릿 | Modèle | Vorlage |
| ระดับคุณภาพ | Quality level | 等级 | 評価段階 | 등급 | Niveau de qualité | Qualitätsstufe |
| คุณลักษณะอันพึงประสงค์ | Desirable characteristics | 理想品质 | 望ましい資質 | 바람직한 특성 | Qualités attendues | Erwünschte Eigenschaften |
| สมรรถนะสำคัญของผู้เรียน | Key competencies | 核心素养 | 主要コンピテンシー | 핵심 역량 | Compétences clés | Schlüsselkompetenzen |
| ร่าง / ยังไม่เสร็จ | Draft | 草稿 | 下書き | 임시 저장 | Brouillon | Entwurf |
| เสร็จแล้ว | Done | 已完成 | 完了 | 완료 | Terminé | Fertig |
| นำเข้า / ส่งออก / ดาวน์โหลด | Import / Export / Download | 导入 / 导出 / 下载 | インポート / エクスポート / ダウンロード | 가져오기 / 내보내기 / 다운로드 | Importer / Exporter / Télécharger | Importieren / Exportieren / Herunterladen |
| บันทึก (ปุ่ม) | Save | 保存 | 保存 | 저장 | Enregistrer | Speichern |
| ยกเลิก | Cancel | 取消 | キャンセル | 취소 | Annuler | Abbrechen |
| ลบ | Delete | 删除 | 削除 | 삭제 | Supprimer | Löschen |
| แก้ไข | Edit | 编辑 | 編集 | 편집 | Modifier | Bearbeiten |
| เพิ่ม | Add | 添加 | 追加 | 추가 | Ajouter | Hinzufügen |
| ค้นหา | Search | 搜索 | 検索 | 검색 | Rechercher | Suchen |
| กำลังโหลด… | Loading… | 加载中… | 読み込み中… | 불러오는 중… | Chargement… | Wird geladen… |
| ลองใหม่อีกครั้ง | Try again | 请重试 | もう一度お試しください | 다시 시도해 주세요 | Réessayez | Bitte erneut versuchen |
| ไม่สำเร็จ (…ไม่สำเร็จ) | Couldn't … | …失败 | …できませんでした | …하지 못했어요 | Impossible de … | … fehlgeschlagen |

## ตัวอย่างรูปแบบ (ไทย → English)

- ปุ่ม: "เพิ่มนักเรียน" → "Add student" · "ลบ 3 รายการ" → "Delete 3 items"
- error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" → "Couldn't save. Try again."
- ยืนยันลบ: "ลบงาน \"{name}\" ใช่ไหม? ลบแล้วกู้คืนไม่ได้" → "Delete assignment \"{name}\"? This can't be undone."
- ว่าง: "ยังไม่มีงาน กด เพิ่มงาน เพื่อเริ่ม" → "No assignments yet. Tap Add assignment to start."
- สำเร็จ: "บันทึกแล้ว" → "Saved"
