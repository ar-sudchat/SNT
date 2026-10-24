import React from 'react';

// กันทั้งหน้ากลายเป็นจอขาวเมื่อหน้าใดหน้าหนึ่งพัง (เช่น ข้อมูลจาก API ไม่ครบ)
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Page error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-lg font-semibold text-gray-800">หน้านี้แสดงผลไม่ได้</p>
          <p className="mt-1 text-sm text-gray-500">ลองโหลดใหม่ ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 min-h-[44px] px-5 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
          >
            โหลดใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
