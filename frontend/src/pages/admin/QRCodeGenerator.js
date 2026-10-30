import { t, dateLocale } from '../../i18n';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { qrcodeAPI, classAPI, subjectAPI, academicYearAPI } from '../../services/api';
import { SmartTable, SmartComboBox } from '../../components/ui';
import PageHeader from '../../components/ui/PageHeader';
import QRResultModal, { QRHistoryModal, readHistory, saveRun, clearHistory } from './QRResultModal';

const QRCodeGenerator = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  // แผ่นที่พร้อมพิมพ์ (จาก popup ผลการสร้าง หรือ "ดู QR Code ที่มีอยู่")
  const [sheet, setSheet] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [run, setRun] = useState(null);
  const [history, setHistory] = useState(() => readHistory());
  const [historyOpen, setHistoryOpen] = useState(false);

  // Load academic years on mount, default to the current year
  useEffect(() => {
    const init = async () => {
      try {
        const ayRes = await academicYearAPI.getAll();
        setAcademicYears(ayRes.data);
        const current = ayRes.data.find((y) => y.isCurrent) || ayRes.data[0];
        setSelectedAcademicYear(current ? current.id : null);
      } catch (err) {
        setError(t('ไม่สามารถโหลดปีการศึกษาได้'));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Reload classes + subjects (scoped to the selected academic year) whenever it changes
  useEffect(() => {
    setSelectedGrade(null);
    setSelectedClass(null);
    setSelectedSubject(null);
    setStudents([]);
    setSelectedStudents([]);
    setSheet(null);

    if (!selectedAcademicYear) {
      setClasses([]);
      setSubjects([]);
      return;
    }

    const loadForYear = async () => {
      try {
        const params = { academicYearId: selectedAcademicYear };
        const [classRes, subjectRes] = await Promise.all([
          classAPI.getAll(params),
          subjectAPI.getAll(params)
        ]);
        setClasses(classRes.data);
        setSubjects(subjectRes.data);
      } catch (err) {
        setError(t('ไม่สามารถโหลดข้อมูลห้องเรียน/วิชาได้'));
      }
    };
    loadForYear();
  }, [selectedAcademicYear]);

  const fetchStudents = useCallback(async () => {
    if (selectedClass) {
      try {
        const response = await classAPI.getStudents(selectedClass);
        setStudents(response.data);
      } catch (err) {
        setError(t('ไม่สามารถโหลดรายชื่อนักเรียนได้'));
      }
    } else {
      setStudents([]);
      setSelectedStudents([]);
    }
  }, [selectedClass]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleGenerate = async () => {
    if (!selectedSubject || selectedStudents.length === 0) {
      setError(t('กรุณาเลือกวิชาและนักเรียน'));
      return;
    }

    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const response = await qrcodeAPI.generateBulk({
        studentIds: selectedStudents,
        subjectId: parseInt(selectedSubject)
      });

      const { success, failed } = response.data.results;
      const person = (studentId) => {
        const st = students.find(s => s.id === studentId);
        return { studentId, studentCode: st?.studentCode || '-', studentNumber: st?.studentNumber || null, name: st?.name || '-' };
      };
      const newRun = {
        id: `${Date.now()}`,
        at: new Date().toISOString(),
        classId: selectedClass,
        className: classes.find(c => c.id === selectedClass)?.className || '-',
        subjectId: parseInt(selectedSubject),
        subjectName: subjects.find(s => s.id === parseInt(selectedSubject))?.subjectName || '-',
        success: success.map(q => ({ ...person(q.studentId), qrcodeImage: q.qrcodeImage })),
        failed: failed.map(f => ({ ...person(f.studentId), reason: f.reason }))
      };
      setHistory(saveRun(newRun));
      setRun(newRun);
    } catch (err) {
      setError(err.response?.data?.error || t('เกิดข้อผิดพลาดในการสร้าง QR Code'));
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const printSheet = (items, subjectName) => {
    setSheet({ title: t("QR Code พร้อมพิมพ์ ({value1} รายการ)", { value1: items.length }), subjectName, items });
    setTimeout(() => window.print(), 50);
  };

  const handleRunChange = useCallback((next, { save }) => {
    setRun(next);
    if (save) setHistory(saveRun(next));
  }, []);

  const handleLoadExisting = async () => {
    if (!selectedClass || !selectedSubject) {
      setError(t('กรุณาเลือกห้องเรียนและวิชา'));
      return;
    }

    setLoadingExisting(true);
    setError('');
    setSheet(null);

    try {
      const response = await qrcodeAPI.printForClass(selectedClass, selectedSubject);
      if (response.data.length > 0) {
        setSheet({
          title: t("QR Codes ที่มีอยู่ ({value1} รายการ)", { value1: response.data.length }),
          subjectName: response.data[0].subjectName,
          items: response.data.map(qr => ({ studentId: qr.id, name: qr.studentName, studentCode: qr.studentCode, qrcodeImage: qr.qrcodeImage }))
        });
      } else {
        setError(t('ไม่พบ QR Code สำหรับห้องและวิชานี้'));
      }
    } catch (err) {
      setError(err.response?.data?.error || t('ไม่สามารถโหลด QR Code ได้'));
    } finally {
      setLoadingExisting(false);
    }
  };

  // ชั้นจากห้องของปีที่เลือก · ห้องกรองตามชั้น
  const grades = useMemo(() => {
    const map = new Map();
    classes.forEach(c => { if (c.grade && !map.has(c.gradeId)) map.set(c.gradeId, { id: c.gradeId, gradeName: c.grade.gradeName }); });
    return [...map.values()].sort((a, b) => a.gradeName.localeCompare(b.gradeName, 'th'));
  }, [classes]);
  const gradeClasses = useMemo(
    () => (selectedGrade ? classes.filter(c => c.gradeId === selectedGrade) : classes),
    [classes, selectedGrade]
  );

  // วิชาที่ใช้ได้กับห้องที่เลือก: วิชาของระดับชั้นเดียวกัน หรือวิชาที่ไม่ได้ระบุระดับชั้น
  const classSubjects = useMemo(() => {
    if (!selectedClass) return subjects;
    const cls = classes.find((c) => c.id === selectedClass);
    if (!cls) return subjects;
    return subjects.filter((s) => s.gradeId == null || s.gradeId === cls.gradeId);
  }, [subjects, classes, selectedClass]);

  // ถ้าวิชาที่เลือกไว้ไม่อยู่ในห้องใหม่ ให้ล้าง เพื่อไม่ให้สร้างผิดวิชาแบบเงียบๆ
  useEffect(() => {
    if (selectedSubject && !classSubjects.some((s) => s.id === parseInt(selectedSubject))) {
      setSelectedSubject(null);
      setSheet(null);
    }
  }, [classSubjects, selectedSubject]);

  const noSubjectsForClass = !!selectedClass && classSubjects.length === 0;
  const generateDisabled = generating || selectedStudents.length === 0 || !selectedSubject;

  // Student table columns
  const studentColumns = useMemo(() => [
    {
      key: 'studentNumber',
      label: 'เลขที่',
      sortable: true,
      width: '60px',
      render: (value) => <span className="font-medium text-gray-900">{value || '-'}</span>
    },
    {
      key: 'studentCode',
      label: 'รหัสนักเรียน',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'name',
      label: 'ชื่อ-นามสกุล',
      sortable: true
    }
  ], []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("สร้าง QR Code")} className="print:hidden">
        <button
          type="button"
          onClick={() => { setHistory(readHistory()); setHistoryOpen(true); }}
          className="min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>{t("ประวัติการสร้าง")}{history.length > 0 ? ` (${history.length})` : ''}</button>
      </PageHeader>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center justify-between print:hidden">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg flex items-center justify-between print:hidden">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Selection Panel */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("ปีการศึกษา")}</label>
            <SmartComboBox
              options={academicYears}
              value={selectedAcademicYear}
              onChange={(val) => setSelectedAcademicYear(val)}
              labelKey="year"
              valueKey="id"
              placeholder={t("เลือกปีการศึกษา")}
              searchable
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชั้น")}</label>
            <SmartComboBox
              options={grades}
              value={selectedGrade}
              onChange={(val) => {
                setSelectedGrade(val);
                if (val && selectedClass && classes.find(c => c.id === selectedClass)?.gradeId !== val) {
                  setSelectedClass(null);
                  setSelectedStudents([]);
                }
              }}
              labelKey="gradeName"
              valueKey="id"
              placeholder={t("ทุกชั้น")}
              allLabel={t("ทุกชั้น")}
              searchable
              clearable
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("ห้องเรียน")}</label>
            <SmartComboBox
              options={gradeClasses}
              value={selectedClass}
              onChange={(val) => {
                setSelectedClass(val);
                setSelectedStudents([]);
              }}
              labelKey="className"
              valueKey="id"
              placeholder={t("เลือกห้องเรียน")}
              searchable
              clearable
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("วิชา")}</label>
            <SmartComboBox
              options={classSubjects}
              value={selectedSubject}
              onChange={(val) => {
                setSelectedSubject(val);
                setSheet(null);
              }}
              labelKey="subjectName"
              valueKey="id"
              placeholder={t("เลือกวิชา")}
              searchable
              clearable
            />
          </div>
        </div>

        {/* Quick Actions */}
        {selectedClass && selectedSubject && (
          <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b">
            <button
              onClick={handleLoadExisting}
              disabled={loadingExisting}
              className="px-4 py-2 min-h-[44px] bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {loadingExisting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-transparent"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
              {t("ดู QR Code ที่มีอยู่")}</button>
          </div>
        )}

        {students.length > 0 && (
          <>
            <SmartTable
              data={students}
              columns={studentColumns.map(column => ({ ...column, label: t(column.label) }))}
              title={t("เลือกนักเรียน")}
              selectable
              onSelectionChange={(selected) => setSelectedStudents(selected.map(s => s.id))}
              searchable
              pagination
              pageSize={10}
              emptyMessage={t("ไม่พบนักเรียนในห้องนี้")}
            />

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-4 pt-4 border-t">
              <span className="text-sm text-gray-500">{t("เลือก {value1} จาก {value2} คน", { value1: selectedStudents.length, value2: students.length })}</span>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                {!generating && generateDisabled && (
                  <p id="qr-generate-hint" className="text-sm text-amber-700" role="status">
                    {!selectedSubject ? (
                      noSubjectsForClass ? (
                        <>{t("ห้องนี้ยังไม่มีวิชา")}{' '}<Link to="/admin/subjects" className="inline-flex min-h-[44px] items-center font-medium text-brand-600 underline hover:text-brand-700">{t("ไปเพิ่มวิชา")}</Link>
                        </>
                      ) : (
                        t('เลือกวิชาก่อนสร้าง QR Code')
                      )
                    ) : (
                      t('เลือกนักเรียนอย่างน้อย 1 คน')
                    )}
                  </p>
                )}
              <button
                onClick={handleGenerate}
                disabled={generateDisabled}
                aria-describedby={generateDisabled && !generating ? 'qr-generate-hint' : undefined}
                className="px-6 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>{t("กำลังสร้าง...")}</>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>{t("สร้าง QR Code")}</>
                )}
              </button>
              </div>
            </div>
          </>
        )}

        {selectedClass && students.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>{t("ไม่พบนักเรียนในห้องนี้")}</div>
        )}
      </div>

      {/* แผ่นพร้อมพิมพ์ */}
      {sheet && sheet.items.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 print:hidden">
            <h2 className="text-lg font-semibold">{sheet.title}</h2>
            <button
              onClick={handlePrint}
              className="px-4 py-2 min-h-[44px] bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>{t("พิมพ์ QR Code")}</button>
          </div>

          {/* Print Header - Only visible when printing */}
          <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
            <h1 className="text-2xl font-bold">{t("KruScan — ครูสแกน")}</h1>
            <p className="text-lg mt-1">{t("QR Code สำหรับวิชา: {value1}", { value1: sheet.subjectName })}</p>
            <p className="text-sm text-gray-600 mt-1">{t("พิมพ์เมื่อ: {value1}", { value1: new Date().toLocaleDateString(dateLocale(), { year: 'numeric', month: 'long', day: 'numeric' }) })}</p>
          </div>

          {/* Screen view */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
            {sheet.items.map((qr) => (
              <div key={qr.studentId} className="border rounded-lg p-4 text-center">
                <img src={qr.qrcodeImage} alt="QR Code" className="mx-auto mb-2" style={{ width: 150, height: 150 }} />
                <p className="text-sm font-medium truncate">{qr.name}</p>
                <p className="text-xs text-gray-500">{qr.studentCode}</p>
                <p className="text-xs text-brand-600 mt-1">{sheet.subjectName}</p>
              </div>
            ))}
          </div>

          {/* Print view - Better layout for printing */}
          <div className="hidden print:grid print:grid-cols-3 print:gap-4">
            {sheet.items.map((qr) => (
              <div key={qr.studentId} className="border-2 border-gray-300 rounded-lg p-3 text-center" style={{ pageBreakInside: 'avoid' }}>
                <img src={qr.qrcodeImage} alt="QR Code" className="mx-auto" style={{ width: 120, height: 120 }} />
                <div className="mt-2 border-t pt-2">
                  <p className="text-base font-bold">{qr.name}</p>
                  <p className="text-sm">{qr.studentCode}</p>
                  <p className="text-xs text-gray-600 mt-1">{sheet.subjectName}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Print Footer */}
          <div className="hidden print:block mt-6 pt-4 border-t text-center text-xs text-gray-500">
            <p>{t("KruScan — สแกนสมุด รู้ทันทีใครส่งงานแล้ว")}</p>
          </div>
        </div>
      )}

      <QRResultModal run={run} onClose={() => setRun(null)} onPrint={printSheet} onChange={handleRunChange} />
      <QRHistoryModal
        open={historyOpen}
        runs={history}
        onClose={() => setHistoryOpen(false)}
        onOpenRun={(r) => { setHistoryOpen(false); setRun(r); }}
        onClear={() => { clearHistory(); setHistory([]); }}
      />
    </div>
  );
};

export default QRCodeGenerator;
