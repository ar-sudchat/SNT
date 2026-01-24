import React, { useState, useEffect } from 'react';
import { qrcodeAPI, classAPI, subjectAPI } from '../../services/api';

const QRCodeGenerator = () => {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [generatedQRCodes, setGeneratedQRCodes] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
    } else {
      setStudents([]);
      setSelectedStudents([]);
    }
  }, [selectedClass]);

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

  const fetchStudents = async () => {
    try {
      const response = await classAPI.getStudents(selectedClass);
      setStudents(response.data);
    } catch (err) {
      setError('ไม่สามารถโหลดรายชื่อนักเรียนได้');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedStudents(students.map(s => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectStudent = (studentId) => {
    if (selectedStudents.includes(studentId)) {
      setSelectedStudents(selectedStudents.filter(id => id !== studentId));
    } else {
      setSelectedStudents([...selectedStudents, studentId]);
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

    try {
      const response = await qrcodeAPI.generateBulk({
        studentIds: selectedStudents,
        subjectId: parseInt(selectedSubject)
      });
      setSuccess(response.data.message);
      setGeneratedQRCodes(response.data.results.success);
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการสร้าง QR Code');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">สร้าง QR Code</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError('')} className="float-right">&times;</button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
          {success}
          <button onClick={() => setSuccess('')} className="float-right">&times;</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ห้องเรียน</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">เลือกห้องเรียน</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.className}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วิชา</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">เลือกวิชา</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.subjectName}</option>
              ))}
            </select>
          </div>
        </div>

        {students.length > 0 && (
          <>
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedStudents.length === students.length}
                        onChange={handleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">รหัส</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => handleSelectStudent(student.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">{student.studentCode}</td>
                      <td className="px-4 py-3 text-sm">{student.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                เลือก {selectedStudents.length} จาก {students.length} คน
              </span>
              <button
                onClick={handleGenerate}
                disabled={generating || selectedStudents.length === 0 || !selectedSubject}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'กำลังสร้าง...' : 'สร้าง QR Code'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Generated QR Codes */}
      {generatedQRCodes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4 print:hidden">
            <h2 className="text-lg font-semibold">QR Codes ที่สร้างแล้ว</h2>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              พิมพ์ QR Code
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
            {generatedQRCodes.map((qr) => (
              <div key={qr.id} className="border rounded-lg p-4 text-center">
                <img
                  src={qr.qrcodeImage}
                  alt="QR Code"
                  className="mx-auto mb-2"
                  style={{ width: 150, height: 150 }}
                />
                <p className="text-sm font-medium">{students.find(s => s.id === qr.studentId)?.name}</p>
                <p className="text-xs text-gray-500">{students.find(s => s.id === qr.studentId)?.studentCode}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCodeGenerator;
