import React, { useState, useEffect, useCallback } from 'react';
import { classAPI, studentAPI, academicYearAPI, transferAPI } from '../../services/api';
import { SmartTable, SmartComboBox } from '../../components/ui';

const ClassTransfer = () => {
  const [activeTab, setActiveTab] = useState('individual'); // individual, bulk, promote
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Individual transfer
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [targetClass, setTargetClass] = useState(null);

  // Bulk transfer
  const [sourceClass, setSourceClass] = useState(null);
  const [bulkTargetClass, setBulkTargetClass] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [classStudents, setClassStudents] = useState([]);

  // Promotion
  const [fromAcademicYear, setFromAcademicYear] = useState(null);
  const [toAcademicYear, setToAcademicYear] = useState(null);
  const [promotionPreview, setPromotionPreview] = useState(null);
  const [promotionMappings, setPromotionMappings] = useState({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [classRes, studentRes, academicYearRes] = await Promise.all([
        classAPI.getAll(),
        studentAPI.getAll(),
        academicYearAPI.getAll()
      ]);
      setClasses(classRes.data);
      setStudents(studentRes.data);
      setAcademicYears(academicYearRes.data);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch students when source class changes (for bulk)
  useEffect(() => {
    const fetchClassStudents = async () => {
      if (sourceClass) {
        try {
          const response = await classAPI.getStudents(sourceClass);
          setClassStudents(response.data);
          setSelectedStudents([]);
        } catch (err) {
          setClassStudents([]);
        }
      } else {
        setClassStudents([]);
        setSelectedStudents([]);
      }
    };
    fetchClassStudents();
  }, [sourceClass]);

  // Fetch promotion preview
  useEffect(() => {
    const fetchPreview = async () => {
      if (fromAcademicYear && toAcademicYear) {
        try {
          const response = await transferAPI.getPromotionPreview(fromAcademicYear, toAcademicYear);
          setPromotionPreview(response.data);
          // Initialize mappings with suggestions
          const mappings = {};
          response.data.suggestions.forEach(s => {
            if (s.suggestedTargetClass) {
              mappings[s.sourceClass.id] = s.suggestedTargetClass.id;
            }
          });
          setPromotionMappings(mappings);
        } catch (err) {
          setPromotionPreview(null);
        }
      }
    };
    fetchPreview();
  }, [fromAcademicYear, toAcademicYear]);

  const handleIndividualTransfer = async () => {
    if (!selectedStudent || !targetClass) {
      setError('กรุณาเลือกนักเรียนและห้องเรียนปลายทาง');
      return;
    }
    try {
      const response = await transferAPI.transferStudent({
        studentId: selectedStudent,
        newClassId: targetClass
      });
      setSuccess(response.data.message);
      setSelectedStudent(null);
      setTargetClass(null);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'ไม่สามารถย้ายนักเรียนได้');
    }
  };

  const handleBulkTransfer = async () => {
    if (!sourceClass || !bulkTargetClass) {
      setError('กรุณาเลือกห้องต้นทางและห้องปลายทาง');
      return;
    }
    try {
      const response = await transferAPI.transferBulk({
        fromClassId: sourceClass,
        toClassId: bulkTargetClass,
        studentIds: selectedStudents.length > 0 ? selectedStudents : undefined
      });
      setSuccess(response.data.message);
      setSourceClass(null);
      setBulkTargetClass(null);
      setSelectedStudents([]);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'ไม่สามารถย้ายนักเรียนได้');
    }
  };

  const handlePromotion = async () => {
    const promotions = Object.entries(promotionMappings)
      .filter(([_, toClassId]) => toClassId)
      .map(([fromClassId, toClassId]) => ({
        fromClassId: parseInt(fromClassId),
        toClassId: parseInt(toClassId)
      }));

    if (promotions.length === 0) {
      setError('กรุณาเลือกห้องปลายทางอย่างน้อย 1 ห้อง');
      return;
    }

    if (!window.confirm(`ต้องการเลื่อนชั้นนักเรียนทั้ง ${promotions.length} ห้องเรียนหรือไม่?`)) {
      return;
    }

    try {
      const response = await transferAPI.promoteStudents({
        promotions,
        newAcademicYearId: toAcademicYear
      });
      setSuccess(response.data.message);
      setFromAcademicYear(null);
      setToAcademicYear(null);
      setPromotionPreview(null);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'ไม่สามารถเลื่อนชั้นได้');
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    if (selectedStudents.length === classStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(classStudents.map(s => s.id));
    }
  };

  // Student columns for individual transfer
  const studentColumns = [
    { key: 'studentCode', label: 'รหัสนักเรียน', sortable: true },
    { key: 'name', label: 'ชื่อ-นามสกุล', sortable: true },
    { key: 'class.className', label: 'ห้องเรียนปัจจุบัน', sortable: true }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">ย้ายชั้นเรียน</h1>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('individual')}
              className={`px-6 py-3 border-b-2 font-medium text-sm ${
                activeTab === 'individual'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ย้ายทีละคน
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`px-6 py-3 border-b-2 font-medium text-sm ${
                activeTab === 'bulk'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ย้ายทั้งห้อง
            </button>
            <button
              onClick={() => setActiveTab('promote')}
              className={`px-6 py-3 border-b-2 font-medium text-sm ${
                activeTab === 'promote'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              เลื่อนชั้นปีใหม่
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Individual Transfer Tab */}
          {activeTab === 'individual' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลือกนักเรียน
                  </label>
                  <SmartComboBox
                    options={students}
                    value={selectedStudent}
                    onChange={setSelectedStudent}
                    labelKey="name"
                    valueKey="id"
                    placeholder="ค้นหานักเรียน..."
                    searchable
                    renderOption={(student) => (
                      <div>
                        <div className="font-medium">{student.name}</div>
                        <div className="text-sm text-gray-500">
                          {student.studentCode} - {student.class?.className}
                        </div>
                      </div>
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ห้องเรียนปลายทาง
                  </label>
                  <SmartComboBox
                    options={classes.filter(c => {
                      const student = students.find(s => s.id === selectedStudent);
                      return student ? c.id !== student.classId : true;
                    })}
                    value={targetClass}
                    onChange={setTargetClass}
                    labelKey="className"
                    valueKey="id"
                    placeholder="เลือกห้องเรียน..."
                    searchable
                  />
                </div>
              </div>
              <button
                onClick={handleIndividualTransfer}
                disabled={!selectedStudent || !targetClass}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                ย้ายนักเรียน
              </button>
            </div>
          )}

          {/* Bulk Transfer Tab */}
          {activeTab === 'bulk' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ห้องต้นทาง
                  </label>
                  <SmartComboBox
                    options={classes}
                    value={sourceClass}
                    onChange={setSourceClass}
                    labelKey="className"
                    valueKey="id"
                    placeholder="เลือกห้องต้นทาง..."
                    searchable
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ห้องปลายทาง
                  </label>
                  <SmartComboBox
                    options={classes.filter(c => c.id !== sourceClass)}
                    value={bulkTargetClass}
                    onChange={setBulkTargetClass}
                    labelKey="className"
                    valueKey="id"
                    placeholder="เลือกห้องปลายทาง..."
                    searchable
                  />
                </div>
              </div>

              {sourceClass && classStudents.length > 0 && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">
                      นักเรียนในห้อง ({selectedStudents.length}/{classStudents.length} คน)
                    </h3>
                    <button
                      onClick={selectAllStudents}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {selectedStudents.length === classStudents.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {classStudents.map(student => (
                      <label
                        key={student.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span>{student.studentCode} - {student.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleBulkTransfer}
                disabled={!sourceClass || !bulkTargetClass}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                ย้ายนักเรียน {selectedStudents.length > 0 ? `(${selectedStudents.length} คน)` : '(ทั้งหมด)'}
              </button>
            </div>
          )}

          {/* Promotion Tab */}
          {activeTab === 'promote' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ปีการศึกษาต้นทาง
                  </label>
                  <SmartComboBox
                    options={academicYears}
                    value={fromAcademicYear}
                    onChange={setFromAcademicYear}
                    labelKey="year"
                    valueKey="id"
                    placeholder="เลือกปีการศึกษา..."
                    searchable
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ปีการศึกษาปลายทาง
                  </label>
                  <SmartComboBox
                    options={academicYears.filter(a => a.id !== fromAcademicYear)}
                    value={toAcademicYear}
                    onChange={setToAcademicYear}
                    labelKey="year"
                    valueKey="id"
                    placeholder="เลือกปีการศึกษา..."
                    searchable
                  />
                </div>
              </div>

              {promotionPreview && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          ห้องต้นทาง
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          จำนวนนักเรียน
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          ห้องปลายทาง
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {promotionPreview.suggestions.map(suggestion => (
                        <tr key={suggestion.sourceClass.id}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-medium">{suggestion.sourceClass.className}</div>
                            <div className="text-sm text-gray-500">{suggestion.sourceClass.gradeName}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {suggestion.sourceClass.studentCount} คน
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {suggestion.isGraduating ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                จบการศึกษา
                              </span>
                            ) : (
                              <SmartComboBox
                                options={promotionPreview.targetClasses}
                                value={promotionMappings[suggestion.sourceClass.id]}
                                onChange={(val) =>
                                  setPromotionMappings(prev => ({
                                    ...prev,
                                    [suggestion.sourceClass.id]: val
                                  }))
                                }
                                labelKey="className"
                                valueKey="id"
                                placeholder="เลือกห้อง..."
                                searchable
                                clearable
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                onClick={handlePromotion}
                disabled={!fromAcademicYear || !toAcademicYear || !promotionPreview}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                เลื่อนชั้นนักเรียน
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassTransfer;
