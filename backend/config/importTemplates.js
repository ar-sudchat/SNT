// แม่แบบไฟล์นำเข้า (CSV) ใช้ร่วมกันระหว่าง importController และ aiController
const IMPORT_TEMPLATES = {
  academicYear: 'Year,Name,StartDate,EndDate,IsCurrent,Status\n2567,ปีการศึกษา 2567,2024-05-16,2025-03-31,true,Active\n2568,ปีการศึกษา 2568,2025-05-16,2026-03-31,false,Active',
  grade: 'GradeName,Description,Status\nม.1,มัธยมศึกษาปีที่ 1,Active\nม.2,มัธยมศึกษาปีที่ 2,Active',
  class: 'ClassName,GradeName,TeacherCode,AcademicYear,Capacity,Status\nม.1/1,ม.1,T001,2567,40,Active',
  student: 'StudentCode,StudentNumber,Name,ClassName,Email,Status\n6001,1,นก ทองคำ,ม.1/1,nok@school.ac.th,Active\n6002,2,ก้อง มั่นคง,ม.1/1,kong@school.ac.th,Active',
  teacher: 'TeacherCode,Name,Email,Status\nT001,นาย ปรีชา สมใจ,preecha@school.ac.th,Active',
  subject: 'SubjectCode,SubjectName,GradeName,AcademicYear,TeacherCode,Description,Status\nMA101,คณิตศาสตร์ ม.1,ม.1,2567,T001,วิชาคณิตศาสตร์ ม.1,Active',
  task: 'SubjectCode,TaskName,TaskNumber,Description,Deadline,ScoringType,MaxScore,Status\nMA101,การบ้านเศษส่วน,1,แสดงวิธีทำโจทย์เศษส่วน,2025-02-10,PASS_FAIL,,Active'
};

module.exports = { IMPORT_TEMPLATES };
