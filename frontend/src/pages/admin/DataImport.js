import React, { useState } from 'react';
import { importAPI, aiAPI } from '../../services/api';
import { ConfirmDialog } from '../../components/ui';
import SmartImport from '../ai/SmartImport';
import { ImportFile } from '../../components/illustrations';

// อ่านหัวคอลัมน์และตัวอย่างแถวจากไฟล์ในเครื่อง (ไม่ส่งไฟล์ทั้งไฟล์ให้ AI)
const parseFileSample = async (file, maxRows = 5) => {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  let rows;
  if (name.endsWith('.json')) {
    const parsed = JSON.parse(new TextDecoder('utf-8').decode(buffer));
    const list = Array.isArray(parsed) ? parsed : (parsed && Object.values(parsed).find(Array.isArray)) || [];
    const headers = list[0] && typeof list[0] === 'object' ? Object.keys(list[0]) : [];
    return { headers, sampleRows: list.slice(0, maxRows) };
  }
  // โหลด xlsx เฉพาะตอนใช้ ไม่ให้ bundle หลักโต
  const XLSX = await import('xlsx');
  let workbook;
  if (name.endsWith('.csv')) {
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch (e) {
      // ไฟล์ CSV จาก Excel ภาษาไทยมักเป็น Windows-874
      text = new TextDecoder('windows-874').decode(buffer);
    }
    workbook = XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string' });
  } else {
    workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const headers = (rows[0] || []).map(h => String(h));
  const sampleRows = rows.slice(1, 1 + maxRows).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h || `col${i + 1}`] = r[i] ?? ''; });
    return obj;
  });
  return { headers, sampleRows };
};

const DataImport = () => {
  const [selectedType, setSelectedType] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: 'info', title: '', message: '' });
  const [result, setResult] = useState(null);
  const [aiAdvice, setAiAdvice] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const showAlert = (type, title, message) => {
    setAlert({ show: true, type, title, message });
  };

  const importTypes = [
    { value: 'academicYear', label: 'ปีการศึกษา (Academic Year)', description: 'นำเข้าข้อมูลปีการศึกษา เช่น 2567, 2568' },
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
      showAlert('danger', 'ดาวน์โหลดไม่สำเร็จ', err?.response?.status === 403 ? 'เฉพาะผู้ดูแลระบบ' : 'โหลดไฟล์ตัวอย่างไม่ได้ ลองใหม่อีกครั้ง');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setAiAdvice('');
      setAiError('');
    }
  };

  const handleImport = async () => {
    if (!selectedType || !file) {
      showAlert('warning', 'ข้อมูลไม่ครบ', 'กรุณาเลือกประเภทข้อมูลและไฟล์');
      return;
    }

    setLoading(true);
    setResult(null);
    setAiAdvice('');
    setAiError('');

    try {
      let response;
      switch (selectedType) {
        case 'academicYear':
          response = await importAPI.importAcademicYears(file);
          break;
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

      // Show success/partial success message
      const successCount = response.data.results?.success?.length || 0;
      const failedCount = response.data.results?.failed?.length || 0;

      if (failedCount === 0 && successCount > 0) {
        showAlert('success', 'นำเข้าสำเร็จ', response.data.message);
      } else if (successCount > 0 && failedCount > 0) {
        showAlert('warning', 'นำเข้าบางส่วน', response.data.message);
      } else if (successCount === 0) {
        showAlert('danger', 'นำเข้าไม่สำเร็จ', 'ไม่สามารถนำเข้าข้อมูลได้ กรุณาตรวจสอบไฟล์');
      }
    } catch (err) {
      showAlert('danger', 'เกิดข้อผิดพลาด', err.response?.data?.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleAskAI = async () => {
    const failed = result?.results?.failed || [];
    if (failed.length === 0) return;
    setAiLoading(true);
    setAiAdvice('');
    setAiError('');
    try {
      let sample = {};
      if (file) {
        try {
          sample = await parseFileSample(file);
        } catch (e) {
          // อ่านไฟล์ไม่ได้ก็ยังขอคำแนะนำจากรายการข้อผิดพลาดได้
          sample = {};
        }
      }
      const errors = failed.slice(0, 30).map(item => item.reason || JSON.stringify(item.row)).map(String);
      const response = await aiAPI.importHelp({
        type: selectedType,
        errors,
        ...(sample.headers?.length ? { headers: sample.headers, sampleRows: sample.sampleRows } : {})
      });
      setAiAdvice(response.data.advice || '');
    } catch (err) {
      setAiError(err.response?.data?.error || 'ไม่สามารถขอคำแนะนำจาก AI ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">นำเข้าข้อมูล</h1>

      <section className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold">นำเข้ารายชื่อนักเรียน (แนะนำ)</h2>
        <SmartImport />
      </section>

      <h2 className="text-lg font-semibold pt-2">นำเข้าแบบแม่แบบ (ขั้นสูง)</h2>
      {/* ขั้น 1: เลือกประเภท */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-1">1. เลือกประเภทข้อมูล</h2>
        <p className="text-xs text-gray-500 mb-4">ลำดับที่แนะนำ: ปีการศึกษา → ชั้นปี → ครู → ห้องเรียน → นักเรียน → วิชา → งาน</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {importTypes.map((type) => (
            <button
              type="button"
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              title={type.description}
              className={`border rounded-lg px-3 py-2 min-h-[44px] text-sm transition-colors ${
                selectedType === type.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                  : 'border-gray-200 text-gray-700 hover:border-brand-300'
              }`}
            >
              {type.label.replace(/\s*\(.*\)$/, '')}
            </button>
          ))}
        </div>
        {selectedType && (
          <p className="mt-3 text-sm text-gray-500">{importTypes.find(t => t.value === selectedType)?.description}</p>
        )}
      </div>

      {/* ขั้น 2: ตัวอย่าง + เลือกไฟล์ */}
      <div className={`bg-white rounded-lg shadow p-4 sm:p-6 ${selectedType ? '' : 'opacity-50 pointer-events-none'}`}>
        <h2 className="text-lg font-semibold mb-1">2. โหลดไฟล์ตัวอย่าง แล้วเลือกไฟล์</h2>
        <p className="text-xs text-gray-500 mb-4">หัวคอลัมน์ต้องตรงกับไฟล์ตัวอย่าง ไม่ต้องลบหรือเปลี่ยนชื่อหัวคอลัมน์</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => handleDownloadTemplate(selectedType)}
            disabled={!selectedType}
            className="px-4 py-2 min-h-[44px] border border-brand-600 text-brand-600 rounded-lg hover:bg-brand-50 disabled:opacity-50"
          >
            โหลดไฟล์ตัวอย่าง
          </button>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            disabled={!selectedType}
          />
          <label
            htmlFor="file-upload"
            className="flex-1 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg px-4 py-2 min-h-[44px] flex items-center justify-center text-sm text-brand-600 hover:border-brand-400"
          >
            {file ? <span className="text-green-700 break-all">{file.name}</span> : <span className="flex items-center gap-2"><ImportFile className="h-8 w-auto text-brand-500 shrink-0" />เลือกไฟล์ (CSV, Excel, JSON)</span>}
          </label>
        </div>
      </div>

      {/* ขั้น 3: นำเข้า */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">3. นำเข้า</h2>
        <button
          onClick={handleImport}
          disabled={loading || !selectedType || !file}
          className="w-full sm:w-auto px-8 py-3 min-h-[44px] border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center">
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
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
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
                  <div key={index} className="text-sm text-red-700 mb-1 break-words">
                    {JSON.stringify(item.row)} - {item.reason}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleAskAI}
                  disabled={aiLoading}
                  className="w-full sm:w-auto px-4 py-2 min-h-[44px] bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {aiLoading ? 'AI กำลังตรวจสอบ...' : 'ให้ AI ช่วยดูปัญหา'}
                </button>
              </div>
              {aiError && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">{aiError}</div>
              )}
              {aiAdvice && (
                <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-medium text-purple-800 mb-2">คำแนะนำจาก AI</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{aiAdvice}</p>
                  <p className="mt-3 text-xs text-gray-500">AI อาจผิดพลาด ควรตรวจสอบก่อนใช้</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alert Dialog */}
      <ConfirmDialog
        isOpen={alert.show}
        onClose={() => setAlert({ ...alert, show: false })}
        title={alert.title}
        message={alert.message}
        confirmText="ตกลง"
        type={alert.type}
        mode="alert"
      />
    </div>
  );
};

export default DataImport;
