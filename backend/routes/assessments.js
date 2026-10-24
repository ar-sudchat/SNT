// บันทึกหลังแผน (lesson log): templates, records, scores, Word export, term summary.
// Contract: docs/LESSON-LOG.md
const express = require('express');
const router = express.Router();
const { authenticate, authorize, isAdmin } = require('../middleware/auth');
const T = require('../controllers/assessmentTemplateController');
const R = require('../controllers/assessmentRecordController');
const X = require('../controllers/assessmentExportController');
const I = require('../controllers/assessmentInsightController');

router.use(authenticate, authorize('ADMIN', 'TEACHER'));

router.get('/templates', T.list);
router.post('/templates', T.create);
router.put('/templates/:id', T.update);
router.delete('/templates/:id', T.remove);

router.get('/settings', X.getSettings);
router.put('/settings', isAdmin, X.updateSettings);

router.get('/records', R.list);
router.post('/records', R.create);
router.get('/records/:id', R.get);
router.put('/records/:id', R.update);
router.put('/records/:id/scores', R.saveScores);
router.delete('/records/:id', R.remove);

router.post('/records/:id/fill-from-task', I.fillFromTask);
router.get('/summary', I.summary);

router.get('/export', X.exportDocx);

module.exports = router;
