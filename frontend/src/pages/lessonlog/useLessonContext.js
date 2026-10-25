import { t } from '../../i18n';
// Which class + subject the teacher is working on in บันทึกหลังแผน.
// Remembers the last choice (DESIGN.md: don't ask what the system already knows).
import { useEffect, useState, useCallback } from 'react';
import { classAPI, subjectAPI } from '../../services/api';

const KEY = 'lessonlog.context';

function readSaved() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export default function useLessonContext() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classId, setClassIdState] = useState(() => readSaved().classId || null);
  const [subjectId, setSubjectIdState] = useState(() => readSaved().subjectId || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, s] = await Promise.all([classAPI.getAll(), subjectAPI.getAll()]);
        if (cancelled) return;
        const cl = c.data || [];
        setClasses(cl);
        setSubjects(s.data || []);
        // Saved class gone (new year, other group) -> first class.
        setClassIdState(prev => (cl.some(x => x.id === prev) ? prev : (cl[0] ? cl[0].id : null)));
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || t('โหลดห้องเรียนไม่สำเร็จ'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = (next) => {
    try { localStorage.setItem(KEY, JSON.stringify({ ...readSaved(), ...next })); } catch { /* private mode */ }
  };
  const setClassId = useCallback((id) => { setClassIdState(id); save({ classId: id }); }, []);
  const setSubjectId = useCallback((id) => { setSubjectIdState(id); save({ subjectId: id }); }, []);

  const cls = classes.find(c => c.id === classId) || null;
  // Subjects of this class's grade first; a subject without a grade fits every class.
  const classSubjects = subjects.filter(s => !cls || !s.gradeId || s.gradeId === cls.gradeId);
  const subject = classSubjects.find(s => s.id === subjectId) || null;

  return { classes, subjects: classSubjects, classId, subjectId: subject ? subject.id : null, cls, subject, setClassId, setSubjectId, loading, error };
}
