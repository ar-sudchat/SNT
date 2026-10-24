const test = require('node:test');
const assert = require('node:assert');
const { generate, getStatus, getConfig, AIError } = require('../services/aiProvider');

const ENV = ['AI_PROVIDER', 'AI_MODEL', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY'];
const realFetch = global.fetch;
const clear = () => ENV.forEach(k => delete process.env[k]);
let last;
const okFetch = (payload, status = 200) => async (url, opt) => {
  last = { url, opt, body: JSON.parse(opt.body) };
  return { ok: status < 400, status, json: async () => payload };
};
test.beforeEach(clear);
test.afterEach(() => { clear(); global.fetch = realFetch; });

test('no config -> disabled status and 503 error', async () => {
  assert.deepStrictEqual(getStatus(), { enabled: false, provider: null, model: null });
  await assert.rejects(generate({ prompt: 'x' }), e => e instanceof AIError && e.status === 503 && /ยังไม่ได้ตั้งค่า/.test(e.message));
});

test('auto selection order anthropic > gemini > openai', () => {
  process.env.OPENAI_API_KEY = 'o';
  assert.strictEqual(getStatus().provider, 'openai');
  process.env.GEMINI_API_KEY = 'g';
  assert.strictEqual(getStatus().provider, 'gemini');
  process.env.ANTHROPIC_API_KEY = 'a';
  assert.strictEqual(getStatus().provider, 'anthropic');
});

test('explicit AI_PROVIDER, AI_MODEL override, unknown provider', async () => {
  process.env.AI_PROVIDER = ' OpenAI ';
  process.env.OPENAI_API_KEY = 'o'; process.env.ANTHROPIC_API_KEY = 'a';
  assert.strictEqual(getConfig().provider, 'openai');
  process.env.AI_MODEL = 'my-model';
  assert.strictEqual(getConfig().model, 'my-model');
  process.env.AI_PROVIDER = 'bogus';
  await assert.rejects(generate({ prompt: 'x' }), e => e.status === 503 && /ไม่รองรับ/.test(e.message));
});

test('explicit provider without its key -> clear error', async () => {
  process.env.AI_PROVIDER = 'gemini';
  process.env.ANTHROPIC_API_KEY = 'a';
  assert.strictEqual(getStatus().enabled, false);
  await assert.rejects(generate({ prompt: 'x' }), e => e.status === 503 && /GEMINI_API_KEY/.test(e.message));
});

test('anthropic request shape', async () => {
  process.env.ANTHROPIC_API_KEY = 'ka';
  global.fetch = okFetch({ content: [{ type: 'text', text: ' สวัสดี ' }], stop_reason: 'end_turn' });
  assert.strictEqual(await generate({ system: 'S', prompt: 'P', json: true, maxTokens: 100 }), 'สวัสดี');
  assert.strictEqual(last.url, 'https://api.anthropic.com/v1/messages');
  assert.strictEqual(last.opt.headers['x-api-key'], 'ka');
  assert.strictEqual(last.opt.headers['anthropic-version'], '2023-06-01');
  assert.strictEqual(last.body.model, 'claude-sonnet-5-5');
  assert.strictEqual(last.body.max_tokens, 100);
  assert.deepStrictEqual(last.body.messages, [{ role: 'user', content: 'P' }]);
  assert.ok(last.body.system.startsWith('S') && /JSON/.test(last.body.system));
});

test('anthropic refusal -> 502', async () => {
  process.env.ANTHROPIC_API_KEY = 'ka';
  global.fetch = okFetch({ content: [], stop_reason: 'refusal' });
  await assert.rejects(generate({ prompt: 'P' }), e => e.status === 502);
});

test('gemini request shape', async () => {
  process.env.AI_PROVIDER = 'gemini'; process.env.GEMINI_API_KEY = 'kg'; process.env.AI_MODEL = 'gemini-x';
  global.fetch = okFetch({ candidates: [{ content: { parts: [{ text: 'G' }] } }] });
  assert.strictEqual(await generate({ system: 'S', prompt: 'P', json: true, maxTokens: 50 }), 'G');
  assert.ok(last.url.endsWith('/v1beta/models/gemini-x:generateContent'));
  assert.strictEqual(last.opt.headers['x-goog-api-key'], 'kg');
  assert.strictEqual(last.body.systemInstruction.parts[0].text, 'S');
  assert.strictEqual(last.body.contents[0].parts[0].text, 'P');
  assert.strictEqual(last.body.generationConfig.responseMimeType, 'application/json');
  assert.strictEqual(last.body.generationConfig.maxOutputTokens, 50);
});

test('gemini no candidates -> error', async () => {
  process.env.GEMINI_API_KEY = 'kg';
  global.fetch = okFetch({ candidates: [] });
  await assert.rejects(generate({ prompt: 'P' }), AIError);
});

test('openai request shape', async () => {
  process.env.OPENAI_API_KEY = 'ko';
  global.fetch = okFetch({ choices: [{ message: { content: 'O' } }] });
  assert.strictEqual(await generate({ system: 'S', prompt: 'P', json: true, maxTokens: 70 }), 'O');
  assert.strictEqual(last.url, 'https://api.openai.com/v1/chat/completions');
  assert.strictEqual(last.opt.headers.authorization, 'Bearer ko');
  assert.strictEqual(last.body.max_completion_tokens, 70);
  assert.deepStrictEqual(last.body.response_format, { type: 'json_object' });
  assert.strictEqual(last.body.messages[1].content, 'P');
  assert.strictEqual(last.body.messages[0].role, 'system');
});

test('HTTP errors map to Thai messages', async () => {
  process.env.OPENAI_API_KEY = 'ko';
  const origErr = console.error; console.error = () => {};
  try {
    global.fetch = okFetch({ error: { message: 'x' } }, 429);
    await assert.rejects(generate({ prompt: 'P' }), /จำกัดการใช้งาน/);
    global.fetch = okFetch({}, 401);
    await assert.rejects(generate({ prompt: 'P' }), /คีย์/);
    global.fetch = okFetch({}, 500);
    await assert.rejects(generate({ prompt: 'P' }), /HTTP 500/);
  } finally { console.error = origErr; }
});

test('empty reply -> error', async () => {
  process.env.OPENAI_API_KEY = 'ko';
  global.fetch = okFetch({ choices: [{ message: { content: '  ' } }] });
  await assert.rejects(generate({ prompt: 'P' }), /ว่าง/);
});

test('timeout (abort) -> AIError', async (t) => {
  process.env.OPENAI_API_KEY = 'ko';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  global.fetch = (url, opt) => new Promise((_, reject) => {
    opt.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
  });
  const p = generate({ prompt: 'P' });
  await new Promise(r => setImmediate(r));
  t.mock.timers.tick(60000);
  await assert.rejects(p, e => e instanceof AIError && /ตอบช้า/.test(e.message));
});

test('network failure -> AIError', async () => {
  process.env.OPENAI_API_KEY = 'ko';
  global.fetch = async () => { throw new TypeError('fail'); };
  await assert.rejects(generate({ prompt: 'P' }), /เชื่อมต่อ/);
});
