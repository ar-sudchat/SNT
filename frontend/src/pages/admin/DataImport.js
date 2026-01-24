import React, { useState } from 'react';
import { importAPI } from '../../services/api';

const DataImport = () => {
  const [selectedType, setSelectedType] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const importTypes = [
    { value: 'grade', label: 'ชั้นปี (Grade)', description: 'นำเข้าข้อมูลชั้นปี เช่น ม.1, ม.2, ม.3' },
    { value: 'teacher', label: 'ครู (Teacher)', description: 'นำเข้าข้อมูลครู' },
    { value: 'class', label: 'ห้องเรียน (Class)', description: 'นำเข้าข้อมูลห้องเรียน (ต้องมีชั้นปีและครูก่อน)' },
    { value: 'student', label: 'นักเรียน (Student)', description: 'นำเข้าข้อมูลนักเรียน (ต้องมีห้องเรียนก่อน)' },
    { value: 'subject', label: 'วิชา (Subject)', description: 'นำเข้าข้อมูลวิชา (ต้องมีครูก่อน)' },
    { value: 'task', label: 'งาน (Task)', description: 'นำเข้าข้อมูลงาน (ต้องมีวิชาก่อน)' }
  ];

  const handleDownloadTemplate = async (type) => {
    try {
      const response = await importAPI.downloadTemplate(type);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_template.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('ไม่สามารถดาวน์โหลด template ได้');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedType || !file) {
      setError('กรุณาเลือกประเภทข้อมูลและไฟล์');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      let response;
      switch (selectedType) {
        case 'grade':
          response = await importAPI.importGrades(file);
          break;
        case 'class':
          response = await importAPI.importClasses(file);
          break;
        case 'student':
          response = await importAPI.importStudents(file);
          break;
        case 'teacher':
          response = await importAPI.importTeachers(file);
          break;
        case 'subject':
          response = await importAPI.importSubjects(file);
          break;
        case 'task':
          response = await importAPI.importTasks(file);
          break;
        default:
          throw new Error('Invalid type');
      }
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Import ข้อมูล</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError('')} className="float-right">&times;</button>
        </div>
      )}

      {/* Import Type Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">1. เลือกประเภทข้อมูล</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {importTypes.map((type) => (
            <div
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedType === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-800">{type.label}</h3>
                  <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadTemplate(type.value);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">2. อัพโหลดไฟล์</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer"
          >
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              <span className="text-blue-600 hover:text-blue-500">คลิกเพื่อเลือกไฟล์</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              รองรับ CSV, Excel (.xlsx), JSON
            </p>
          </label>
          {file && (
            <p className="mt-4 text-sm text-green-600">
              เลือกไฟล์: {file.name}
            </p>
          )}
        </div>
      </div>

      {/* Import Button */}
      <div className="flex justify-center">
        <button
          onClick={handleImport}
          disabled={loading || !selectedType || !file}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              กำลังนำเข้า...
            </span>
          ) : (
            'นำเข้าข้อมูล'
          )}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">ผลลัพธ์</h2>
          <p className="text-green-600 mb-4">{result.message}</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{result.results?.success?.length || 0}</div>
              <div className="text-sm text-gray-500">สำเร็จ</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{result.results?.failed?.length || 0}</div>
              <div className="text-sm text-gray-500">ล้มเหลว</div>
            </div>
          </div>

          {result.results?.failed?.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium text-red-600 mb-2">รายการที่ล้มเหลว:</h3>
              <div className="bg-red-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                {result.results.failed.map((item, index) => (
                  <div key={index} className="text-sm text-red-700 mb-1">
                    {JSON.stringify(item.row)} - {item.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">คำแนะนำ</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
          <li>ดาวน์โหลด Template ของประเภทข้อมูลที่ต้องการ</li>
          <li>กรอกข้อมูลในไฟล์ Template ตามรูปแบบที่กำหนด</li>
          <li>เลือกประเภทข้อมูลและอัพโหลดไฟล์</li>
          <li>กดปุ่ม "นำเข้าข้อมูล"</li>
          <li>ตรวจสอบผลลัพธ์และแก้ไขข้อผิดพลาด (ถ้ามี)</li>
        </ol>
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-700">
            <strong>หมายเหตุ:</strong> ควรนำเข้าข้อมูลตามลำดับ: ชั้นปี &rarr; ครู &rarr; ห้องเรียน &rarr; นักเรียน &rarr; วิชา &rarr; งาน
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataImport;
