import React, { useState, useEffect } from 'react';
import { taskAPI, subjectAPI } from '../../services/api';

const ManageTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filterSubject, setFilterSubject] = useState('');
  const [formData, setFormData] = useState({
    subjectId: '',
    taskName: '',
    taskNumber: 1,
    description: '',
    deadline: '',
    status: 'ACTIVE'
  });

  useEffect(() => {
    fetchData();
  }, [filterSubject]);

  const fetchData = async () => {
    try {
      const params = filterSubject ? { subjectId: filterSubject } : {};
      const [taskRes, subjectRes] = await Promise.all([
        taskAPI.getAll(params),
        subjectAPI.getAll()
      ]);
      setTasks(taskRes.data);
      setSubjects(subjectRes.data);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        subjectId: parseInt(formData.subjectId),
        taskNumber: parseInt(formData.taskNumber),
        deadline: formData.deadline || null
      };
      if (editingTask) {
        await taskAPI.update(editingTask.id, data);
      } else {
        await taskAPI.create(data);
      }
      fetchData();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('ต้องการลบงานนี้หรือไม่?')) {
      try {
        await taskAPI.delete(id);
        fetchData();
      } catch (err) {
        setError(err.response?.data?.error || 'ไม่สามารถลบได้');
      }
    }
  };

  const openModal = (task = null) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        subjectId: task.subjectId?.toString() || '',
        taskName: task.taskName,
        taskNumber: task.taskNumber,
        description: task.description || '',
        deadline: task.deadline ? task.deadline.split('T')[0] : '',
        status: task.status
      });
    } else {
      setEditingTask(null);
      setFormData({ subjectId: '', taskName: '', taskNumber: 1, description: '', deadline: '', status: 'ACTIVE' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTask(null);
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">จัดการงาน</h1>
        <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ เพิ่มงาน</button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError('')} className="float-right">&times;</button>
        </div>
      )}

      <div className="flex items-center space-x-4">
        <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">ทุกวิชา</option>
          {subjects.map((s) => (<option key={s.id} value={s.id}>{s.subjectName}</option>))}
        </select>
        <span className="text-gray-500">พบ {tasks.length} งาน</span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วิชา</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">งาน</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">หมายเลข</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">กำหนดส่ง</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">สถานะ</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.map((t) => (
              <tr key={t.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.subject?.subjectName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.taskName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{t.taskNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                  {t.deadline ? new Date(t.deadline).toLocaleDateString('th-TH') : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${t.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {t.status === 'ACTIVE' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                  <button onClick={() => openModal(t)} className="text-blue-600 hover:text-blue-800 mr-3">แก้ไข</button>
                  <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-800">ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{editingTask ? 'แก้ไขงาน' : 'เพิ่มงาน'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วิชา</label>
                <select value={formData.subjectId} onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                  <option value="">เลือกวิชา</option>
                  {subjects.map((s) => (<option key={s.id} value={s.id}>{s.subjectName}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่องาน</label>
                <input type="text" value={formData.taskName} onChange={(e) => setFormData({ ...formData, taskName: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเลขงาน</label>
                <input type="number" min="1" value={formData.taskNumber} onChange={(e) => setFormData({ ...formData, taskNumber: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows="3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">กำหนดส่ง</label>
                <input type="date" value={formData.deadline} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="ACTIVE">ใช้งาน</option>
                  <option value="INACTIVE">ไม่ใช้งาน</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg hover:bg-gray-50">ยกเลิก</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageTasks;
