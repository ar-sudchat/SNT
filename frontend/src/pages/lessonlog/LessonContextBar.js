import { t } from '../../i18n';
// ชั้น → ห้อง → วิชา ที่แสดงตลอด เปลี่ยนแล้วใช้ทันที (ไม่ต้องกด "เปลี่ยน")
import React, { useMemo, useState } from 'react';
import { SmartComboBox } from '../../components/ui';

// roomIds + onRoomIdsChange = เลือกได้หลายห้องในชั้นเดียวกัน (ตอนสร้างบันทึก)
export default function LessonContextBar({ ctx, allSubjectsLabel = t('ทุกวิชา'), roomIds, onRoomIdsChange }) {
  const { classes, subjects, classId, subjectId, cls, setClassId, setSubjectId } = ctx;
  const [gradeId, setGradeId] = useState(null);

  const grades = useMemo(() => {
    const map = new Map();
    classes.forEach(c => { if (c.gradeId && !map.has(c.gradeId)) map.set(c.gradeId, c.grade?.gradeName || '-'); });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [classes]);

  // ชั้นที่เลือกเอง หรือชั้นของห้องปัจจุบัน
  const activeGrade = gradeId ?? cls?.gradeId ?? null;
  const gradeClasses = activeGrade ? classes.filter(c => c.gradeId === activeGrade) : classes;

  const pickGrade = (id) => {
    setGradeId(id);
    const first = classes.find(c => c.gradeId === id);
    if (first && first.id !== classId) { setClassId(first.id); setSubjectId(null); }
    if (first && onRoomIdsChange) onRoomIdsChange([first.id]);
  };

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg bg-white p-3 shadow sm:grid-cols-3 sm:p-4">
      {grades.length > 1 && (
        <div className="min-w-0">
          <span className="mb-1 block text-sm font-medium text-gray-700">{t('ชั้น')}</span>
          <SmartComboBox
            options={grades}
            value={activeGrade}
            onChange={(v) => v && pickGrade(Number(v))}
            labelKey="name"
            valueKey="id"
            placeholder={t("เลือกชั้น")}
            clearable={false}
            ariaLabel={t("ชั้น")}
          />
        </div>
      )}
      <div className={`min-w-0 ${grades.length > 1 ? '' : 'col-span-2 sm:col-span-1'}`}>
        <span className="mb-1 block text-sm font-medium text-gray-700">{t('ห้องเรียน')}</span>
        {onRoomIdsChange ? (
          <SmartComboBox
            multiple
            options={gradeClasses}
            value={roomIds}
            onChange={(vals) => {
              const ids = (vals || []).map(Number).filter(Boolean);
              onRoomIdsChange(ids);
              if (ids.length && !ids.includes(classId)) setClassId(ids[0]);
            }}
            labelKey="className"
            valueKey="id"
            placeholder={t("เลือกห้องเรียน (ได้หลายห้อง)")}
            ariaLabel={t("ห้องเรียน")}
          />
        ) : (
        <SmartComboBox
          options={gradeClasses}
          value={classId}
          onChange={(v) => { if (v == null) return; setClassId(Number(v) || null); setSubjectId(null); }}
          labelKey="className"
          valueKey="id"
          placeholder={t("เลือกห้องเรียน")}
          clearable={false}
          ariaLabel={t("ห้องเรียน")}
        />
        )}
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <span className="mb-1 block text-sm font-medium text-gray-700">{t('วิชา')}</span>
        <SmartComboBox
          options={[{ id: '', subjectName: allSubjectsLabel }, ...subjects]}
          value={subjectId || ''}
          onChange={(v) => setSubjectId(Number(v) || null)}
          labelKey="subjectName"
          valueKey="id"
          clearable={false}
          ariaLabel={t("วิชา")}
        />
      </div>
    </div>
  );
}
