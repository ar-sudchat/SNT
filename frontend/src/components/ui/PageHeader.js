import React from 'react';

// ลิงก์เล็กเหนือชื่อหน้า (breadcrumb / ย้อนกลับ) — สูงแค่บรรทัดเดียว (20px)
// แต่พื้นที่กดยังได้ 44px ด้วย ::after ที่ยื่นขึ้นบน 16px ลงล่าง 8px
export const CRUMB_LINK =
  "relative inline-flex items-center gap-1 text-sm leading-5 text-brand-700 hover:text-brand-900 hover:underline after:absolute after:-inset-x-1 after:-top-4 after:-bottom-2 after:content-['']";

/**
 * หัวหน้าเพจแบบกะทัดรัด ใช้ร่วมกันทุกหน้า (อยู่ในหน้าเสมอ ไม่ย้ายขึ้นแถบบน)
 * - crumb (ถ้ามี) เป็นตัวเล็กติดเหนือชื่อหน้า ไม่มีช่องว่างเพิ่ม
 * - ชื่อหน้า + คำอธิบาย อยู่ก้อนเดียว · ปุ่ม (children) อยู่แถวเดียวกับชื่อ
 *   จอแคบปุ่มจะตกลงไปบรรทัดถัดไปเองเมื่อไม่พอ
 */
const PageHeader = ({ title, subtitle, crumb, children, className = '' }) => (
  <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${className}`}>
    <div className="min-w-0">
      {crumb && <div className="mb-0.5 flex">{crumb}</div>}
      <h1 className="text-xl font-bold leading-tight text-gray-800 sm:text-2xl">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </div>
);

export default PageHeader;
