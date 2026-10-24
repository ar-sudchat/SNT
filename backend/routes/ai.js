const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate, authorize } = require('../middleware/auth');

// rate limit ในหน่วยความจำ: 20 ครั้ง / 5 นาที ต่อผู้ใช้ (ใช้กับ endpoint ที่เรียก AI)
const WINDOW_MS = 5 * 60 * 1000;
const LIMIT = 20;
const hits = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.user.id;
  const list = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= LIMIT) {
    const retry = Math.ceil((WINDOW_MS - (now - list[0])) / 1000);
    res.set('Retry-After', String(retry));
    hits.set(key, list);
    return res.status(429).json({ error: `ใช้ผู้ช่วย AI บ่อยเกินไป กรุณารอประมาณ ${Math.ceil(retry / 60)} นาทีแล้วลองใหม่` });
  }
  list.push(now);
  hits.set(key, list);
  next();
}

// ล้างข้อมูลเก่าเป็นระยะ ไม่ให้ Map โตไม่จำกัด
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of hits) {
    if (!list.some(t => now - t < WINDOW_MS)) hits.delete(k);
  }
}, WINDOW_MS).unref();

router.use(authenticate, authorize('ADMIN', 'TEACHER'));

router.get('/status', aiController.status);
router.get('/conversations', aiController.listConversations);
router.get('/conversations/:id', aiController.getConversation);
router.delete('/conversations/:id', aiController.deleteConversation);
router.post('/ask', rateLimit, aiController.ask);
router.post('/report', rateLimit, aiController.report);
router.post('/import-help', rateLimit, aiController.importHelp);
router.post('/draft-task', rateLimit, aiController.draftTask);

module.exports = router;
module.exports._rateLimit = rateLimit;
