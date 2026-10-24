// ตัวเรียก AI แบบเลือกผู้ให้บริการได้ (anthropic | gemini | openai) ด้วย fetch ล้วน ไม่ใช้ SDK
// ห้าม log คีย์ไม่ว่ากรณีใด

// แก้รุ่นเริ่มต้นได้ที่นี่ที่เดียว (ใช้เมื่อไม่ได้ตั้ง AI_MODEL)
const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-5-5',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-5-mini'
};

const KEY_ENV = {
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY'
};

const TIMEOUT_MS = 60000;

class AIError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'AIError';
    this.status = status;
  }
}

function getConfig() {
  let provider = (process.env.AI_PROVIDER || '').trim().toLowerCase() || null;
  if (provider && !KEY_ENV[provider]) {
    return { provider: null, model: null, apiKey: null, error: `AI_PROVIDER "${provider}" ไม่รองรับ (ใช้ได้: anthropic, gemini, openai)` };
  }
  if (!provider) {
    provider = Object.keys(KEY_ENV).find(p => process.env[KEY_ENV[p]]) || null;
  }
  if (!provider) return { provider: null, model: null, apiKey: null };
  const apiKey = process.env[KEY_ENV[provider]] || null;
  const model = (process.env.AI_MODEL || '').trim() || DEFAULT_MODELS[provider];
  return { provider, model, apiKey };
}

function getStatus() {
  const { provider, model, apiKey } = getConfig();
  const enabled = Boolean(provider && apiKey);
  return { enabled, provider: enabled ? provider : null, model: enabled ? model : null };
}

async function postJSON(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new AIError('ผู้ให้บริการ AI ตอบช้าเกินกำหนด (60 วินาที) กรุณาลองใหม่');
    throw new AIError('เชื่อมต่อผู้ให้บริการ AI ไม่ได้');
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch (_) { /* ignore */ }
  if (!res.ok) {
    const detail = data && (data.error?.message || data.error?.status || data.message);
    console.error(`AI provider HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 300)}` : ''}`);
    if (res.status === 429) throw new AIError('ผู้ให้บริการ AI จำกัดการใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง');
    if (res.status === 401 || res.status === 403) throw new AIError('คีย์ของผู้ให้บริการ AI ไม่ถูกต้องหรือไม่มีสิทธิ์');
    throw new AIError(`ผู้ให้บริการ AI ตอบกลับผิดพลาด (HTTP ${res.status})`);
  }
  if (!data) throw new AIError('อ่านคำตอบจากผู้ให้บริการ AI ไม่ได้');
  return data;
}

const JSON_HINT = '\n\nตอบเป็น JSON object ที่ถูกต้องเท่านั้น ห้ามมีข้อความอื่นหรือ markdown code fence';

const callers = {
  async anthropic({ model, apiKey, system, prompt, json, maxTokens }) {
    // Messages API (raw HTTP) — ไม่ส่ง temperature/thinking เพื่อเข้ากับรุ่นปัจจุบัน
    const data = await postJSON('https://api.anthropic.com/v1/messages', {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }, {
      model,
      max_tokens: maxTokens,
      system: system + (json ? JSON_HINT : ''),
      messages: [{ role: 'user', content: prompt }]
    });
    if (data.stop_reason === 'refusal') throw new AIError('AI ปฏิเสธคำขอนี้ กรุณาปรับคำถามแล้วลองใหม่');
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  },

  async gemini({ model, apiKey, system, prompt, json, maxTokens }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const generationConfig = { maxOutputTokens: maxTokens };
    if (json) generationConfig.responseMimeType = 'application/json';
    const data = await postJSON(url, { 'x-goog-api-key': apiKey }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig
    });
    const cand = (data.candidates || [])[0];
    if (!cand) throw new AIError('AI ไม่ได้ส่งคำตอบกลับมา (อาจถูกบล็อกโดยตัวกรอง)');
    return ((cand.content && cand.content.parts) || []).map(p => p.text || '').join('');
  },

  async openai({ model, apiKey, system, prompt, json, maxTokens }) {
    const body = {
      model,
      max_completion_tokens: maxTokens,
      messages: [
        { role: 'system', content: system + (json ? JSON_HINT : '') },
        { role: 'user', content: prompt }
      ]
    };
    if (json) body.response_format = { type: 'json_object' };
    const data = await postJSON('https://api.openai.com/v1/chat/completions', {
      authorization: `Bearer ${apiKey}`
    }, body);
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    if (msg && msg.refusal) throw new AIError('AI ปฏิเสธคำขอนี้ กรุณาปรับคำถามแล้วลองใหม่');
    return (msg && msg.content) || '';
  }
};

async function generate({ system = '', prompt, json = false, maxTokens = 4000 }) {
  const cfg = getConfig();
  if (cfg.error) throw new AIError(cfg.error, 503);
  if (!cfg.provider || !cfg.apiKey) {
    throw new AIError('ยังไม่ได้ตั้งค่า AI: กรุณาใส่ ANTHROPIC_API_KEY, GEMINI_API_KEY หรือ OPENAI_API_KEY ในไฟล์ .env ของ backend', 503);
  }
  const text = await callers[cfg.provider]({ ...cfg, system, prompt, json, maxTokens });
  if (!text || !text.trim()) throw new AIError('AI ส่งคำตอบว่างกลับมา กรุณาลองใหม่');
  return text.trim();
}

module.exports = { generate, getStatus, getConfig, AIError, DEFAULT_MODELS };
