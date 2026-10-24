const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/parentController');

// In-memory per-IP rate limit for the public endpoint
function rateLimit({ windowMs = 10 * 60 * 1000, max = 60 } = {}) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();
    let e = hits.get(key);
    if (!e || e.reset < now) { e = { count: 0, reset: now + windowMs }; hits.set(key, e); }
    e.count++;
    if (e.count > max) {
      res.set('Retry-After', String(Math.ceil((e.reset - now) / 1000)));
      return res.status(429).json({ error: 'เรียกดูบ่อยเกินไป กรุณาลองใหม่ภายหลัง' });
    }
    next();
  };
}

const linksRouter = express.Router();
linksRouter.post('/', authenticate, authorize('ADMIN', 'TEACHER'), ctrl.createLink);

const publicRouter = express.Router();
publicRouter.get('/:token', rateLimit(), ctrl.getPublic);

module.exports = { linksRouter, publicRouter, rateLimit };
