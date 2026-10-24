const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const express = require('express');

const stub = (rel, exports) => {
  const p = require.resolve(path.join('..', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
// authenticate: user id + role from headers (no DB/JWT)
stub('middleware/auth.js', {
  authenticate: (req, res, next) => {
    if (!req.headers['x-user']) return res.status(401).end();
    req.user = { id: Number(req.headers['x-user']), role: 'TEACHER' }; next();
  },
  authorize: () => (req, res, next) => next()
});

// in-memory prisma for the two chat models (+ the overview context queries)
const convs = []; const msgs = []; let seq = 1;
const match = (row, where = {}) => Object.entries(where).every(([k, v]) => row[k] === v);
const prompts = [];
stub('config/database.js', {
  academicYear: { findFirst: async () => null },
  class: { findMany: async () => [] },
  subject: { findMany: async () => [] },
  aiConversation: {
    findFirst: async ({ where, include }) => {
      const c = convs.find(r => match(r, where));
      if (!c) return null;
      return include ? { ...c, messages: msgs.filter(m => m.conversationId === c.id) } : c;
    },
    findMany: async ({ where }) => convs.filter(r => match(r, where)).map(c => ({ ...c, messages: msgs.filter(m => m.conversationId === c.id).slice(-1) })),
    create: async ({ data }) => { const c = { id: seq++, createdAt: new Date(), updatedAt: new Date(), ...data }; convs.push(c); return c; },
    update: async ({ where, data }) => Object.assign(convs.find(c => c.id === where.id), data),
    deleteMany: async ({ where }) => {
      const i = convs.findIndex(r => match(r, where)); if (i < 0) return { count: 0 };
      convs.splice(i, 1); return { count: 1 };
    }
  },
  aiMessage: {
    findMany: async ({ where, take }) => msgs.filter(m => match(m, where)).slice().reverse().slice(0, take),
    createMany: async ({ data }) => { data.forEach(d => msgs.push({ id: seq++, ...d })); return { count: data.length }; }
  }
});
class AIError extends Error {}
stub('services/aiProvider.js', {
  AIError, getStatus: () => ({}),
  generate: async ({ prompt }) => { prompts.push(prompt); return `answer${prompts.length}`; }
});

const router = require('../routes/ai');

function req(port, method, p, body, user) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const headers = { 'content-type': 'application/json', ...(data ? { 'content-length': data.length } : {}), ...(user ? { 'x-user': String(user) } : {}) };
    const r = http.request({ port, method, path: p, headers }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d ? JSON.parse(d) : null }));
    });
    r.on('error', reject); r.end(data);
  });
}

test('ai chat history ownership', async (t) => {
  const app = express(); app.use(express.json()); app.use('/ai', router);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(() => server.close());
  const port = server.address().port;

  const a1 = await req(port, 'POST', '/ai/ask', { question: 'คำถามแรก ' + 'ก'.repeat(80) }, 1);
  assert.strictEqual(a1.status, 200);
  const cid = a1.body.conversationId;
  assert.ok(cid);
  assert.strictEqual(a1.body.title.length, 60);

  const a2 = await req(port, 'POST', '/ai/ask', { question: 'ต่อเนื่อง', conversationId: cid }, 1);
  assert.strictEqual(a2.status, 200);
  assert.strictEqual(a2.body.conversationId, cid);
  assert.match(prompts[1], /<HISTORY>[\s\S]*คำถามแรก[\s\S]*answer1[\s\S]*<\/HISTORY>/);
  assert.match(prompts[1], /<DATA>/);

  await t.test('owner sees list + messages', async () => {
    const l = await req(port, 'GET', '/ai/conversations', null, 1);
    assert.strictEqual(l.body.length, 1);
    assert.strictEqual(l.body[0].preview, 'answer2');
    const g = await req(port, 'GET', `/ai/conversations/${cid}`, null, 1);
    assert.strictEqual(g.body.messages.length, 4);
  });
  await t.test('other user gets 404 / empty list and cannot append or delete', async () => {
    assert.deepStrictEqual((await req(port, 'GET', '/ai/conversations', null, 2)).body, []);
    assert.strictEqual((await req(port, 'GET', `/ai/conversations/${cid}`, null, 2)).status, 404);
    const n = prompts.length;
    assert.strictEqual((await req(port, 'POST', '/ai/ask', { question: 'x', conversationId: cid }, 2)).status, 404);
    assert.strictEqual(prompts.length, n, 'no AI call for foreign conversation');
    assert.strictEqual((await req(port, 'DELETE', `/ai/conversations/${cid}`, null, 2)).status, 404);
    assert.strictEqual(convs.length, 1);
  });
  await t.test('bad id → 400/404, owner delete works', async () => {
    assert.strictEqual((await req(port, 'POST', '/ai/ask', { question: 'x', conversationId: 'abc' }, 1)).status, 400);
    assert.strictEqual((await req(port, 'GET', '/ai/conversations/abc', null, 1)).status, 404);
    assert.strictEqual((await req(port, 'DELETE', `/ai/conversations/${cid}`, null, 1)).status, 200);
    assert.strictEqual(convs.length, 0);
  });
});
