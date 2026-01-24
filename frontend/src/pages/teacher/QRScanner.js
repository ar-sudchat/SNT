import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { qrcodeAPI, submissionAPI } from '../../services/api';

const QRScanner = () => {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      setError('');
      setScanning(true);

      html5QrCodeRef.current = new Html5Qrcode('qr-reader');

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        async (decodedText) => {
          await handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors
        }
      );
    } catch (err) {
      setError('ไม่สามารถเปิดกล้องได้: ' + err.message);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      await html5QrCodeRef.current.stop();
    }
    setScanning(false);
  };

  const handleScanSuccess = async (qrcodeData) => {
    await stopScanner();
    setLoading(true);
    setError('');

    try {
      const response = await qrcodeAPI.scan({ qrcodeData });
      setScanResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'QR Code ไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmissionUpdate = async (taskId, status, notes = '') => {
    if (!scanResult) return;

    setLoading(true);
    setSuccessMessage('');
    setError('');

    try {
      await submissionAPI.createOrUpdate({
        studentId: scanResult.student.id,
        taskId,
        status,
        notes
      });

      // Update local state
      setScanResult((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId
            ? { ...task, submission: { ...task.submission, status, notes } }
            : task
        )
      }));

      setSuccessMessage('บันทึกสำเร็จ');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'ไม่สามารถบันทึกได้');
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setError('');
    setSuccessMessage('');
  };

  const getStatusBadge = (status) => {
    const styles = {
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      NOT_SUBMITTED: 'bg-gray-100 text-gray-800'
    };

    const labels = {
      APPROVED: 'ผ่าน',
      REJECTED: 'ไม่ผ่าน',
      PENDING: 'รอตรวจ',
      NOT_SUBMITTED: 'ยังไม่ส่ง'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.NOT_SUBMITTED}`}>
        {labels[status] || 'ยังไม่ส่ง'}
      </span>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">สแกน QR Code</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {!scanResult ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div
            id="qr-reader"
            ref={scannerRef}
            className="w-full max-w-sm mx-auto mb-4"
            style={{ display: scanning ? 'block' : 'none' }}
          />

          {!scanning ? (
            <div className="text-center">
              <button
                onClick={startScanner}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-6 h-6 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                เปิดกล้องสแกน
              </button>
              <p className="mt-4 text-sm text-gray-500">
                กดปุ่มเพื่อเปิดกล้องและสแกน QR Code บนสมุดนักเรียน
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-4 text-gray-600">กำลังสแกน... หัน QR Code มาที่กล้อง</p>
              <button
                onClick={stopScanner}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                หยุดสแกน
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Student Info */}
          <div className="border-b pb-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  {scanResult.student.name}
                </h2>
                <p className="text-gray-600">
                  รหัส: {scanResult.student.studentCode}
                </p>
                <p className="text-gray-600">
                  ห้อง: {scanResult.student.class?.className}
                </p>
              </div>
              <button
                onClick={resetScanner}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                สแกนใหม่
              </button>
            </div>
          </div>

          {/* Subject Info */}
          <div className="mb-4">
            <h3 className="text-lg font-medium text-blue-600">
              {scanResult.subject.subjectName}
            </h3>
            <p className="text-sm text-gray-500">
              รหัสวิชา: {scanResult.subject.subjectCode}
            </p>
          </div>

          {/* Tasks List */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">รายการงาน:</h4>

            {scanResult.tasks.map((task) => (
              <div
                key={task.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">งาน {task.taskNumber}: </span>
                    {task.taskName}
                  </div>
                  {getStatusBadge(task.submission?.status)}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSubmissionUpdate(task.id, 'APPROVED')}
                    disabled={loading}
                    className={`flex-1 py-2 rounded-lg text-white transition-colors ${
                      task.submission?.status === 'APPROVED'
                        ? 'bg-green-600'
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    ผ่าน
                  </button>
                  <button
                    onClick={() => handleSubmissionUpdate(task.id, 'REJECTED')}
                    disabled={loading}
                    className={`flex-1 py-2 rounded-lg text-white transition-colors ${
                      task.submission?.status === 'REJECTED'
                        ? 'bg-red-600'
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    ไม่ผ่าน
                  </button>
                </div>

                {task.submission?.notes && (
                  <p className="text-sm text-gray-600">
                    หมายเหตุ: {task.submission.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QRScanner;
