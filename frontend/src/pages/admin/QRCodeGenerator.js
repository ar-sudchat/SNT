import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { qrcodeAPI, classAPI, subjectAPI } from '../../services/api';
import { SmartTable, SmartComboBox } from '../../components/ui';

const QRCodeGenerator = () => {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [generatedQRCodes, setGeneratedQRCodes] = useState([]);
  const [failedResults, setFailedResults] = useState([]);
  const [existingQRCodes, setExistingQRCodes] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchStudents = useCallback(async () => {
    if (selectedClass) {
      try {
        const response = await classAPI.getStudents(selectedClass);
        setStudents(response.data);
      } catch (err) {
        setError('ไม่สามารถโหลดรายชื่อนักเรียนได้');
      }
    } else {
      setStudents([]);
      setSelectedStudents([]);
    }
  }, [selectedClass]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const fetchData = async () => {
    try {
      const [classRes, subjectRes] = await Promise.all([
        classAPI.getAll(),
        subjectAPI.getAll()
      ]);
      setClasses(classRes.data);
      setSubjects(subjectRes.data);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedSubject || selectedStudents.length === 0) {
      setError('กรุณาเลือกวิชาและนักเรียน');
      return;
    }

    setGenerating(true);
    setError('');
    setSuccess('');
    setFailedResults([]);

    try {
      const response = await qrcodeAPI.generateBulk({
        studentIds: selectedStudents,
        subjectId: parseInt(selectedSubject)
      });

      const { success, failed } = response.data.results;

      if (success.length > 0) {
        setSuccess(`สร้าง QR Code สำเร็จ ${success.length} รายการ`);
        setGeneratedQRCodes(success);
      }

      if (failed.length > 0) {
        // Map failed results with student names
        const failedWithNames = failed.map(f => {
          const student = students.find(s => s.id === f.studentId);
          return {
            ...f,
            studentName: student?.name || '-',
            studentCode: student?.studentCode || '-'
          };
        });
        setFailedResults(failedWithNames);

        if (success.length === 0) {
          setError(`ไม่สามารถสร้างได้ทั้งหมด ${failed.length} รายการ (อาจมี QR Code อยู่แล้ว)`);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการสร้าง QR Code');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLoadExisting = async () => {
    if (!selectedClass || !selectedSubject) {
      setError('กรุณาเลือกห้องเรียนและวิชา');
      return;
    }

    setLoadingExisting(true);
    setError('');
    setExistingQRCodes([]);
    setGeneratedQRCodes([]);

    try {
      const response = await qrcodeAPI.printForClass(selectedClass, selectedSubject);
      if (response.data.length > 0) {
        setExistingQRCodes(response.data);
        setSuccess(`พบ QR Code ${response.data.length} รายการ`);
      } else {
        setError('ไม่พบ QR Code สำหรับห้องและวิชานี้');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'ไม่สามารถโหลด QR Code ได้');
    } finally {
      setLoadingExisting(false);
    }
  };

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 print:hidden">สร้าง QR Code</h1>

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
      <div className="bg-white rounded-lg shadow p-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ห้องเรียน</label>
            <SmartComboBox
              options={classes}
              value={selectedClass}
              onChange={(val) => {
                setSelectedClass(val);
                setSelectedStudents([]);
              }}
              labelKey="className"
              valueKey="id"
              placeholder="เลือกห้องเรียน"
              searchable
              clearable
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วิชา</label>
            <SmartComboBox
              options={subjects}
              value={selectedSubject}
              onChange={(val) => {
                setSelectedSubject(val);
                setExistingQRCodes([]);
                setGeneratedQRCodes([]);
              }}
              labelKey="subjectName"
              valueKey="id"
              placeholder="เลือกวิชา"
              searchable
              clearable
            />
          </div>
        </div>

        {/* Quick Actions */}
        {selectedClass && selectedSubject && (
          <div className="flex gap-3 mb-4 pb-4 border-b">
            <button
              onClick={handleLoadExisting}
              disabled={loadingExisting}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              {loadingExisting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-transparent"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
              ดู QR Code ที่มีอยู่
            </button>
          </div>
        )}

        {students.length > 0 && (
          <>
            <SmartTable
              data={students}
              columns={studentColumns}
              title="เลือกนักเรียน"
              selectable
              onSelectionChange={(selected) => setSelectedStudents(selected.map(s => s.id))}
              searchable
              pagination
              pageSize={10}
              emptyMessage="ไม่พบนักเรียนในห้องนี้"
            />

            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <span className="text-sm text-gray-500">
                เลือก {selectedStudents.length} จาก {students.length} คน
              </span>
              <button
                onClick={handleGenerate}
                disabled={generating || selectedStudents.length === 0 || !selectedSubject}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    กำลังสร้าง...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    สร้าง QR Code
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {selectedClass && students.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            ไม่พบนักเรียนในห้องนี้
          </div>
        )}
      </div>

      {/* Failed Results */}
      {failedResults.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 print:hidden">
          <h3 className="font-medium text-yellow-800 mb-2">
            รายการที่ไม่สามารถสร้างได้ ({failedResults.length} รายการ)
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {failedResults.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm bg-white p-2 rounded">
                <span className="text-gray-700">
                  {item.studentCode} - {item.studentName}
                </span>
                <span className="text-yellow-700">
                  {item.reason === 'QR code already exists' ? 'มี QR Code อยู่แล้ว' : item.reason}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-yellow-600 mt-2">
            หมายเหตุ: นักเรียนเหล่านี้มี QR Code สำหรับวิชานี้อยู่แล้ว ไม่จำเป็นต้องสร้างใหม่
          </p>
        </div>
      )}

      {/* Generated QR Codes */}
      {generatedQRCodes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4 print:hidden">
            <h2 className="text-lg font-semibold">QR Codes ที่สร้างแล้ว ({generatedQRCodes.length} รายการ)</h2>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              พิมพ์ QR Code
            </button>
          </div>

          {/* Print Header - Only visible when printing */}
          <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
            <h1 className="text-2xl font-bold">ระบบติดตามสมุดนักเรียน (SNT)</h1>
            <p className="text-lg mt-1">QR Code สำหรับวิชา: {subjects.find(s => s.id === parseInt(selectedSubject))?.subjectName}</p>
            <p className="text-sm text-gray-600 mt-1">
              พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Screen view */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
            {generatedQRCodes.map((qr) => {
              const student = students.find(s => s.id === qr.studentId);
              return (
                <div key={qr.id} className="border rounded-lg p-4 text-center">
                  <img
                    src={qr.qrcodeImage}
                    alt="QR Code"
                    className="mx-auto mb-2"
                    style={{ width: 150, height: 150 }}
                  />
                  <p className="text-sm font-medium truncate">{student?.name || '-'}</p>
                  <p className="text-xs text-gray-500">{student?.studentCode || '-'}</p>
                </div>
              );
            })}
          </div>

          {/* Print view - Better layout for printing */}
          <div className="hidden print:grid print:grid-cols-3 print:gap-4">
            {generatedQRCodes.map((qr) => {
              const student = students.find(s => s.id === qr.studentId);
              const subjectName = subjects.find(s => s.id === parseInt(selectedSubject))?.subjectName;
              return (
                <div
                  key={qr.id}
                  className="border-2 border-gray-300 rounded-lg p-3 text-center"
                  style={{ pageBreakInside: 'avoid' }}
                >
                  <img
                    src={qr.qrcodeImage}
                    alt="QR Code"
                    className="mx-auto"
                    style={{ width: 120, height: 120 }}
                  />
                  <div className="mt-2 border-t pt-2">
                    <p className="text-base font-bold">{student?.name || '-'}</p>
                    <p className="text-sm">{student?.studentCode || '-'}</p>
                    <p className="text-xs text-gray-600 mt-1">{subjectName}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Print Footer */}
          <div className="hidden print:block mt-6 pt-4 border-t text-center text-xs text-gray-500">
            <p>SNT System - ระบบติดตามสมุดนักเรียนผ่าน QR Code</p>
          </div>
        </div>
      )}

      {/* Existing QR Codes */}
      {existingQRCodes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4 print:hidden">
            <h2 className="text-lg font-semibold">QR Codes ที่มีอยู่ ({existingQRCodes.length} รายการ)</h2>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              พิมพ์ QR Code
            </button>
          </div>

          {/* Print Header - Only visible when printing */}
          <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
            <h1 className="text-2xl font-bold">ระบบติดตามสมุดนักเรียน (SNT)</h1>
            <p className="text-lg mt-1">QR Code สำหรับวิชา: {existingQRCodes[0]?.subjectName}</p>
            <p className="text-sm text-gray-600 mt-1">
              พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Screen view */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
            {existingQRCodes.map((qr, idx) => (
              <div key={idx} className="border rounded-lg p-4 text-center">
                <img
                  src={qr.qrcodeImage}
                  alt="QR Code"
                  className="mx-auto mb-2"
                  style={{ width: 150, height: 150 }}
                />
                <p className="text-sm font-medium truncate">{qr.studentName}</p>
                <p className="text-xs text-gray-500">{qr.studentCode}</p>
                <p className="text-xs text-blue-600 mt-1">{qr.subjectName}</p>
              </div>
            ))}
          </div>

          {/* Print view - Better layout for printing */}
          <div className="hidden print:grid print:grid-cols-3 print:gap-4">
            {existingQRCodes.map((qr, idx) => (
              <div
                key={idx}
                className="border-2 border-gray-300 rounded-lg p-3 text-center"
                style={{ pageBreakInside: 'avoid' }}
              >
                <img
                  src={qr.qrcodeImage}
                  alt="QR Code"
                  className="mx-auto"
                  style={{ width: 120, height: 120 }}
                />
                <div className="mt-2 border-t pt-2">
                  <p className="text-base font-bold">{qr.studentName}</p>
                  <p className="text-sm">{qr.studentCode}</p>
                  <p className="text-xs text-gray-600 mt-1">{qr.subjectName}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Print Footer */}
          <div className="hidden print:block mt-6 pt-4 border-t text-center text-xs text-gray-500">
            <p>SNT System - ระบบติดตามสมุดนักเรียนผ่าน QR Code</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCodeGenerator;
