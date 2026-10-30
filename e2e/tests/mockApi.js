// mock API ด้วย page.route — เทสต์สแกน/เช็คชื่อไม่แตะข้อมูลจริงในฐานข้อมูล (ล็อกอินยังใช้ backend local จริง)
// กล้องใช้ไม่ได้ใน headless จึงขับผ่านช่อง "พิมพ์รหัสนักเรียน" ของหน้า
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

// handlers: [[METHOD, /regex ของ path หลัง /api/], (ctx) => ({status?, body})]
async function mockApi(page, handlers) {
  const calls = [];
  await page.route(/\/api\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const path = u.pathname.replace(/^.*\/api\//, '');
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    for (const [method, re, fn] of handlers) {
      if (method === req.method() && re.test(path)) {
        let body = null;
        try { body = req.postDataJSON(); } catch { /* ไม่มี body */ }
        const query = Object.fromEntries(u.searchParams);
        calls.push({ method, path, body, query });
        const r = fn({ body, query, path });
        return route.fulfill({
          status: r.status || 200,
          headers: { ...CORS, 'content-type': 'application/json' },
          body: JSON.stringify(r.body),
        });
      }
    }
    return route.continue();
  });
  return calls;
}

module.exports = { mockApi };
