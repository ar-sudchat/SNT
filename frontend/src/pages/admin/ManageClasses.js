import React, { useState, useEffect } from 'react';
import { classAPI, gradeAPI, teacherAPI } from '../../services/api';

const ManageClasses = () => {
  const [classes, setClasses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [formData, setFormData] = useState({
    className: '',
    gradeId: '',
    teacherId: '',
    academicYear: new Date().getFullYear() + 543 + '',
    capacity: 40,
    description: '',
    status: 'ACTIVE'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [classRes, gradeRes, teacherRes] = await Promise.all([
        classAPI.getAll(),
        gradeAPI.getAll(),
        teacherAPI.getAll()
      ]);
      setClasses(classRes.data);
      setGrades(gradeRes.data);
      setTeachers(teacherRes.data);
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
        gradeId: parseInt(formData.gradeId),
        teacherId: formData.teacherId ? parseInt(formData.teacherId) : null,
        capacity: parseInt(formData.capacity)
      };
      if (editingClass) {
        await classAPI.update(editingClass.id, data);
      } else {
        await classAPI.create(data);
      }
      fetchData();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('ต้องการลบห้องเรียนนี้หรือไม่?')) {
      try {
        await classAPI.delete(id);
        fetchData();
      } catch (err) {
        setError(err.response?.data?.error || 'ไม่สามารถลบได้');
      }
    }
  };

  const openModal = (classData = null) => {
    if (classData) {
      setEditingClass(classData);
      setFormData({
        className: classData.className,
        gradeId: classData.gradeId?.toString() || '',
        teacherId: classData.teacherId?.toString() || '',
        academicYear: classData.academicYear,
        capacity: classData.capacity,
        description: classData.description || '',
        status: classData.status
      });
    } else {
      setEditingClass(null);
      setFormData({
        className: '',
        gradeId: '',
        teacherId: '',
        academicYear: new Date().getFullYear() + 543 + '',
        capacity: 40,
        description: '',
        status: 'ACTIVE'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClass(null);
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
        <h1 className="text-2xl font-bold text-gray-800">จัดการห้องเรียน</h1>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + เพิ่มห้องเรียน
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError('')} className="float-right">&times;</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ห้องเรียน</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชั้นปี</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ครูประจำชั้น</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">ปีการศึกษา</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">นักเรียน</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">สถานะ</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {classes.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.className}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.grade?.gradeName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.homeTeacher?.name || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{c.academicYear}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{c._count?.students || 0}/{c.capacity}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${c.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {c.status === 'ACTIVE' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                  <button onClick={() => openModal(c)} className="text-blue-600 hover:text-blue-800 mr-3">แก้ไข</button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800">ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingClass ? 'แก้ไขห้องเรียน' : 'เพิ่มห้องเรียน'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อห้องเรียน</label>
                <input type="text" value={formData.className} onChange={(e) => setFormData({ ...formData, className: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชั้นปี</label>
                <select value={formData.gradeId} onChange={(e) => setFormData({ ...formData, gradeId: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required>
                  <option value="">เลือกชั้นปี</option>
                  {grades.map((g) => (<option key={g.id} value={g.id}>{g.gradeName}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ครูประจำชั้น</label>
                <select value={formData.teacherId} onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">ไม่ระบุ</option>
                  {teachers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ปีการศึกษา</label>
                <input type="text" value={formData.academicYear} onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ความจุ (คน)</label>
                <input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
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

export default ManageClasses;
