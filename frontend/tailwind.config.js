/** @type {import('tailwindcss').Config} */
// อัตลักษณ์ SNT — ดู /BRAND.md
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['"Bai Jamjuree"', 'system-ui', 'sans-serif'],
        'display': ['"Bai Jamjuree"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // น้ำเงินหมึก (Ink Navy) — สีหลัก
        brand: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: 'rgb(var(--brand-950) / <alpha-value>)',
        },
        // ส้มดาวเรือง (Marigold) — สีเน้น/สำเร็จ
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          50: '#fff8eb', 100: '#feedc9', 200: '#fdd98e', 300: '#fbc155',
          400: '#f6a92e', 500: '#e8901a', 600: '#c87212', 700: '#a05514',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          50: '#f6f8fb', 100: '#eceff5', 200: '#d8dde8', 300: '#b4bccd',
          400: '#8792a8', 500: '#5f6b84', 600: '#47526a', 700: '#353e53',
          800: '#232a3b', 900: '#151a27',
        },
        'side': 'rgb(var(--side) / <alpha-value>)',
        'side-fg': 'rgb(var(--side-fg) / <alpha-value>)',
        'side-on': 'rgb(var(--side-on) / <alpha-value>)',
        'side-on-fg': 'rgb(var(--side-on-fg) / <alpha-value>)',
        'side-logo': 'rgb(var(--side-logo) / <alpha-value>)',
        'page': 'rgb(var(--page) / <alpha-value>)',
        'cta': 'rgb(var(--cta) / <alpha-value>)',
        'cta-fg': 'rgb(var(--cta-fg) / <alpha-value>)',
        'th': 'rgb(var(--th) / <alpha-value>)',
        'th-fg': 'rgb(var(--th-fg) / <alpha-value>)',
        'title': 'rgb(var(--title) / <alpha-value>)',
        'title-fg': 'rgb(var(--title-fg) / <alpha-value>)',
        'primary': 'rgb(var(--primary) / <alpha-value>)',
        'primary-fg': 'rgb(var(--primary-fg) / <alpha-value>)',
        gray: { 400: '#636a78', 500: '#5f6675' }, // 400 ≥4.9:1 บนพื้นธีมอ่อน (เดิม 2.5)
        // เข้มขึ้นให้ ≥4.6:1 บนพื้นธีมสีอ่อนทุกธีม
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        'card': 'rgb(var(--card) / <alpha-value>)',
        pass: '#16a36a',
        pending: '#d99413',
        fail: '#d4443b',
        info: '#2f7fd1',
      },
      screens: {
        'xs': '475px',
      }
    },
  },
  plugins: [],
}
