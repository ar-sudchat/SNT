import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiAPI, classAPI, subjectAPI } from '../../services/api';
import { SmartComboBox, ConfirmDialog } from '../../components/ui';
import ConversationList from './ConversationList';
import { useAuth } from '../../context/AuthContext';
import { ChatSpark } from '../../components/illustrations';

const DISCLAIMER = 'AI อาจผิดพลาด ควรตรวจสอบก่อนใช้';

const TABS = [
  { id: 'ask', label: 'ถาม-ตอบ' },
  { id: 'report', label: 'สรุปรายงาน' },
  { id: 'draft', label: 'ร่างงาน' }
];

const EXAMPLE_QUESTIONS = [
  'ใครค้างงานเยอะที่สุด',
  'สรุปห้องของฉันสัปดาห์นี้',
  'งานไหนส่งน้อยที่สุด',
  'ร่างข้อความถึงผู้ปกครองนักเรียนที่ค้างงาน'
];

const SCORING_LABELS = {
  SUBMISSION_ONLY: 'ส่งงานอย่างเดียว',
  PASS_FAIL: 'ผ่าน / ไม่ผ่าน',
  SCORED: 'ให้คะแนน'
};

const PROVIDER_LABELS = {
  anthropic: 'Claude (Anthropic)',
  gemini: 'Gemini (Google)',
  openai: 'OpenAI'
};

const getErrorMessage = (err, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') => {
  if (err.response?.data?.error) return err.response.data.error;
  if (err.code === 'ECONNABORTED') return 'AI ใช้เวลาตอบนานเกินไป กรุณาลองใหม่อีกครั้ง';
  return fallback;
};

/* ---------- ตัวแสดงผล markdown แบบเล็ก ปลอดภัย (สร้าง React element เท่านั้น ไม่ใช้ HTML ดิบ) ---------- */

const renderInline = (text, keyPrefix) => {
  const nodes = [];
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-${i++}`} className="px-1 py-0.5 bg-gray-100 rounded text-sm">{token.slice(1, -1)}</code>
      );
    } else {
      nodes.push(<strong key={`${keyPrefix}-${i++}`}>{token.slice(2, -2)}</strong>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

export const MarkdownView = ({ text }) => {
  const blocks = useMemo(() => {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) { i++; continue; }

      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        out.push({ type: 'h', level: Math.min(heading[1].length, 4), text: heading[2] });
        i++;
        continue;
      }
      if (/^(-{3,}|\*{3,})$/.test(trimmed)) { out.push({ type: 'hr' }); i++; continue; }

      if (/^[-*•]\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
          i++;
        }
        out.push({ type: 'ul', items });
        continue;
      }
      if (/^\d+[.)]\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
          i++;
        }
        out.push({ type: 'ol', items });
        continue;
      }
      if (trimmed.startsWith('|')) {
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          if (!/^\|?[\s:|-]+\|?$/.test(lines[i].trim())) rows.push(splitRow(lines[i]));
          i++;
        }
        out.push({ type: 'table', rows });
        continue;
      }
      const para = [];
      while (
        i < lines.length && lines[i].trim() &&
        !/^(#{1,6}\s|[-*•]\s|\d+[.)]\s|\|)/.test(lines[i].trim())
      ) {
        para.push(lines[i].trim());
        i++;
      }
      out.push({ type: 'p', text: para.join(' ') });
    }
    return out;
  }, [text]);

  const headingClass = {
    1: 'text-xl font-bold mt-4 mb-2',
    2: 'text-lg font-bold mt-4 mb-2',
    3: 'text-base font-semibold mt-3 mb-1',
    4: 'text-base font-semibold mt-3 mb-1'
  };

  return (
    <div className="text-gray-800 text-sm sm:text-base leading-relaxed break-words">
      {blocks.map((b, idx) => {
        const key = `b${idx}`;
        switch (b.type) {
          case 'h': {
            const Tag = `h${Math.min(b.level + 1, 6)}`;
            return <Tag key={key} className={headingClass[b.level]}>{renderInline(b.text, key)}</Tag>;
          }
          case 'hr':
            return <hr key={key} className="my-3 border-gray-200" />;
          case 'ul':
            return (
              <ul key={key} className="list-disc pl-6 my-2 space-y-1">
                {b.items.map((it, n) => <li key={n}>{renderInline(it, `${key}-${n}`)}</li>)}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="list-decimal pl-6 my-2 space-y-1">
                {b.items.map((it, n) => <li key={n}>{renderInline(it, `${key}-${n}`)}</li>)}
              </ol>
            );
          case 'table':
            return (
              <div key={key} className="overflow-x-auto my-2">
                <table className="min-w-full text-sm border border-gray-200">
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r} className={r === 0 ? 'bg-gray-50 font-semibold' : ''}>
                        {row.map((cell, c) => (
                          <td key={c} className="border border-gray-200 px-2 py-1">{renderInline(cell, `${key}-${r}-${c}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <p key={key} className="my-2">{renderInline(b.text, key)}</p>;
        }
      })}
    </div>
  );
};

/* ---------- ส่วนประกอบย่อย ---------- */

const Spinner = ({ className = 'h-5 w-5' }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const ErrorBox = ({ message, onClose }) => (
  <div role="alert" className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-start justify-between gap-3 text-sm">
    <span className="break-words">{message}</span>
    {onClose && (
      <button type="button" onClick={onClose} aria-label="ปิด" className="min-h-[44px] min-w-[44px] -my-3 -mr-3 text-red-500 hover:text-red-700">&times;</button>
    )}
  </div>
);

const Disclaimer = () => (
  <p className="text-xs text-gray-500 mt-2">{DISCLAIMER}</p>
);

const primaryBtn = 'px-5 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';
const secondaryBtn = 'px-4 py-2 min-h-[44px] border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 inline-flex items-center justify-center gap-2';
const inputClass = 'w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 disabled:cursor-not-allowed';

/* ---------- แท็บถาม-ตอบ ---------- */

const lastConvKey = (userId) => `snt.ai.lastConversation.${userId ?? 'anon'}`;
const readLast = (userId) => {
  try { const v = Number(window.localStorage.getItem(lastConvKey(userId))); return Number.isInteger(v) && v > 0 ? v : null; } catch (e) { return null; }
};
const writeLast = (userId, id) => {
  try {
    if (id) window.localStorage.setItem(lastConvKey(userId), String(id));
    else window.localStorage.removeItem(lastConvKey(userId));
  } catch (e) { /* storage ปิดอยู่ ไม่เป็นไร */ }
};

const AskTab = ({ disabled, classes, subjects, userId }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [classId, setClassId] = useState(null);
  const [subjectId, setSubjectId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [convLoading, setConvLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current && endRef.current.scrollIntoView) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, loading]);

  const refreshList = async () => {
    try {
      const res = await aiAPI.conversations();
      setConversations(Array.isArray(res.data) ? res.data : []);
    } catch (e) { /* รายการโหลดไม่ได้ ไม่ขวางการถาม */ } finally { setListLoading(false); }
  };

  const openConversation = async (id) => {
    setHistoryOpen(false);
    setError('');
    setConvLoading(true);
    try {
      const res = await aiAPI.conversation(id);
      setMessages((res.data.messages || []).map(m => ({ role: m.role === 'user' ? 'user' : 'ai', text: m.content })));
      setClassId(res.data.classId ?? null);
      setSubjectId(res.data.subjectId ?? null);
      setActiveId(id);
      writeLast(userId, id);
    } catch (err) {
      if (err.response?.status === 404) { writeLast(userId, null); setActiveId(null); setMessages([]); }
      else setError(getErrorMessage(err, 'โหลดบทสนทนาไม่สำเร็จ'));
    } finally { setConvLoading(false); }
  };

  useEffect(() => {
    refreshList();
    const last = readLast(userId);
    if (last) openConversation(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const newChat = () => {
    setHistoryOpen(false);
    setActiveId(null);
    setMessages([]);
    setError('');
    writeLast(userId, null);
  };

  const confirmDelete = async () => {
    const c = pendingDelete;
    if (!c) return;
    try {
      await aiAPI.deleteConversation(c.id);
      setConversations(prev => prev.filter(x => x.id !== c.id));
      if (c.id === activeId) newChat();
    } catch (err) {
      setError(getErrorMessage(err, 'ลบบทสนทนาไม่สำเร็จ'));
    }
  };

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading || disabled) return;
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setInput('');
    setError('');
    setLoading(true);
    try {
      const payload = { question };
      if (classId) payload.classId = classId;
      if (subjectId) payload.subjectId = subjectId;
      if (activeId) payload.conversationId = activeId;
      const res = await aiAPI.ask(payload);
      setMessages(prev => [...prev, { role: 'ai', text: res.data.answer || '' }]);
      if (res.data.conversationId) {
        setActiveId(res.data.conversationId);
        writeLast(userId, res.data.conversationId);
      }
      refreshList();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const activeTitle = conversations.find(c => c.id === activeId)?.title;
  const list = (
    <ConversationList
      items={conversations}
      loading={listLoading}
      activeId={activeId}
      onSelect={openConversation}
      onNew={newChat}
      onDelete={setPendingDelete}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
      <aside className="hidden lg:block lg:border-r lg:border-gray-200 lg:pr-4 lg:max-h-[75vh]">{list}</aside>
    <div className="space-y-4 min-w-0">
      <div className="flex items-center gap-2 lg:hidden">
        <button type="button" onClick={() => setHistoryOpen(true)} className={`${secondaryBtn} shrink-0`}>
          ประวัติ{conversations.length ? ` (${conversations.length})` : ''}
        </button>
        <p className="flex-1 min-w-0 truncate text-sm text-gray-600">{activeTitle || 'แชทใหม่'}</p>
        {activeId && (
          <button type="button" onClick={newChat} className="shrink-0 min-h-[44px] px-3 text-sm text-brand-600 hover:text-brand-700">+ แชทใหม่</button>
        )}
      </div>
      {activeTitle && <h2 className="hidden lg:block text-base font-semibold text-gray-800 truncate">{activeTitle}</h2>}
      {messages.length === 0 && !loading && !convLoading && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">ลองถาม</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map(q => (
              <button
                key={q}
                type="button"
                disabled={disabled}
                onClick={() => send(q)}
                className="px-4 py-2 min-h-[44px] rounded-full border border-brand-200 bg-brand-50 text-brand-700 text-sm text-left hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      <details className="text-sm" open={!!(classId || subjectId)}>
        <summary className="cursor-pointer min-h-[44px] inline-flex items-center text-brand-600">
          {classId || subjectId ? 'ถามเฉพาะห้อง/วิชาที่เลือก' : 'ถามเฉพาะห้องหรือวิชา (ไม่บังคับ)'}
        </summary>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ห้องเรียน</label>
          <SmartComboBox
            options={classes}
            value={classId}
            onChange={setClassId}
            labelKey="className"
            valueKey="id"
            placeholder="ทุกห้อง"
            disabled={disabled}
            clearable
            searchable
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">วิชา</label>
          <SmartComboBox
            options={subjects}
            value={subjectId}
            onChange={setSubjectId}
            labelKey="label"
            valueKey="id"
            placeholder="ทุกวิชา"
            disabled={disabled}
            clearable
            searchable
          />
        </div>
      </div>
      </details>

      <div className="border border-gray-200 rounded-lg bg-gray-50 p-3 sm:p-4 min-h-[240px] max-h-[55vh] overflow-y-auto space-y-3" aria-live="polite">
        {convLoading && (
          <div className="text-center text-gray-500 text-sm py-6 flex items-center justify-center gap-2"><Spinner className="h-4 w-4" /> กำลังโหลดบทสนทนา...</div>
        )}
        {messages.length === 0 && !loading && !convLoading && (
          <div className="text-center text-gray-500 text-sm py-6">
            <ChatSpark className="mx-auto mb-3 h-16 sm:h-20 w-auto text-brand-500" />
            <p>ถามเกี่ยวกับการส่งงานของนักเรียนได้เลย หรือพิมพ์คำถามด้านล่าง</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] sm:max-w-[80%] rounded-2xl px-4 py-2 ${
              m.role === 'user' ? 'bg-brand-600 text-white whitespace-pre-wrap break-words' : 'bg-white border border-gray-200'
            }`}>
              {m.role === 'user' ? m.text : <MarkdownView text={m.text} />}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
              <Spinner className="h-4 w-4" /> AI กำลังคิดคำตอบ...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <ErrorBox message={error} onClose={() => setError('')} />}

      <div className="flex flex-col sm:flex-row gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          rows={2}
          maxLength={1000}
          placeholder="พิมพ์คำถามของคุณ..."
          className={`${inputClass} resize-y flex-1`}
        />
        <button type="button" onClick={() => send()} disabled={disabled || loading || !input.trim()} className={`${primaryBtn} sm:self-stretch`}>
          {loading ? <Spinner /> : null}
          ส่งคำถาม
        </button>
      </div>
      <Disclaimer />
    </div>
      {historyOpen && (
        <div className="modal-backdrop lg:hidden" onClick={(e) => { if (e.target === e.currentTarget) setHistoryOpen(false); }}>
          <div className="modal-panel rounded-b-none sm:rounded-lg p-4 h-[75vh] flex flex-col" role="dialog" aria-modal="true" aria-label="ประวัติการสนทนา">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-800">ประวัติการสนทนา</h2>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label="ปิด" className="min-h-[44px] min-w-[44px] text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            </div>
            <div className="flex-1 min-h-0">{list}</div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="ลบบทสนทนา"
        message={pendingDelete ? `ลบ "${pendingDelete.title}" ออกจากประวัติ? ย้อนกลับไม่ได้` : ''}
        confirmText="ลบบทสนทนา"
        cancelText="ยกเลิก"
        type="danger"
      />
    </div>
  );
};

/* ---------- แท็บสรุปรายงาน ---------- */

const ReportTab = ({ disabled, classes, subjects }) => {
  const [mode, setMode] = useState('class');
  const [classId, setClassId] = useState(null);
  const [subjectId, setSubjectId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedParent, setCopiedParent] = useState(false);
  const reportRef = useRef(null);
  const parentRef = useRef(null);

  const selected = mode === 'class' ? classId : subjectId;

  const generate = async () => {
    if (!selected || disabled) return;
    setLoading(true);
    setError('');
    setReport('');
    try {
      const res = await aiAPI.report(mode === 'class' ? { classId } : { subjectId });
      setReport(res.data.report || '');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError('ไม่สามารถคัดลอกได้ กรุณาเลือกข้อความแล้วคัดลอกเอง');
    }
  };

  // ดึงเฉพาะหัวข้อที่มีคำว่า "ผู้ปกครอง" จนถึงหัวข้อถัดไป
  const extractParentSection = (md) => {
    const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    const isHeading = (l) => /^#{1,6}\s+/.test(l.trim());
    const start = lines.findIndex(l => isHeading(l) && l.includes('ผู้ปกครอง'));
    if (start === -1) return '';
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (isHeading(lines[i])) { end = i; break; }
    }
    return lines.slice(start + 1, end).join('\n').trim();
  };

  const parentText = useMemo(() => extractParentSection(report), [report]);

  const copyParent = async () => {
    try {
      await navigator.clipboard.writeText(parentText);
    } catch (e) {
      // สำรอง: เลือกข้อความในกล่องแล้วสั่งคัดลอก
      const ta = parentRef.current;
      if (!ta) { setError('ไม่สามารถคัดลอกได้ กรุณาเลือกข้อความแล้วคัดลอกเอง'); return; }
      ta.focus();
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      if (!ok) { setError('ไม่สามารถคัดลอกได้ เลือกข้อความในกล่องแล้วคัดลอกเอง'); return; }
    }
    setCopiedParent(true);
    setTimeout(() => setCopiedParent(false), 2000);
  };

  const print = () => {
    const node = reportRef.current;
    if (!node) return;
    // คัดลอก DOM ที่ React สร้างไว้แล้ว (escape แล้ว) ไปหน้าต่างพิมพ์
    const win = window.open('', '_blank');
    if (!win) { window.print(); return; }
    win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>รายงานสรุป</title>' +
      '<style>body{font-family:"Bai Jamjuree",system-ui,sans-serif;padding:24px;line-height:1.6;color:#111}table{border-collapse:collapse}td{border:1px solid #ccc;padding:4px 8px}ul{padding-left:24px;list-style:disc}ol{padding-left:24px}.note{margin-top:24px;font-size:12px;color:#666}</style>' +
      '</head><body></body></html>');
    win.document.body.appendChild(win.document.importNode(node, true));
    const note = win.document.createElement('p');
    note.className = 'note';
    note.textContent = DISCLAIMER;
    win.document.body.appendChild(note);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="เลือกประเภทรายงาน" className="grid grid-cols-2 gap-2 max-w-md">
        {[{ id: 'class', label: 'รายห้องเรียน' }, { id: 'subject', label: 'รายวิชา' }].map(opt => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={mode === opt.id}
            disabled={disabled}
            onClick={() => setMode(opt.id)}
            className={`min-h-[44px] px-4 py-2 rounded-lg border text-sm font-medium ${
              mode === opt.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            } disabled:opacity-50`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {mode === 'class' ? 'เลือกห้องเรียน' : 'เลือกวิชา'} <span className="text-red-500">*</span>
        </label>
        {mode === 'class' ? (
          <SmartComboBox
            key="class"
            options={classes}
            value={classId}
            onChange={setClassId}
            labelKey="className"
            valueKey="id"
            placeholder="เลือกห้องเรียน"
            disabled={disabled}
            clearable
            searchable
          />
        ) : (
          <SmartComboBox
            key="subject"
            options={subjects}
            value={subjectId}
            onChange={setSubjectId}
            labelKey="label"
            valueKey="id"
            placeholder="เลือกวิชา"
            disabled={disabled}
            clearable
            searchable
          />
        )}
      </div>

      <button type="button" onClick={generate} disabled={disabled || loading || !selected} className={`${primaryBtn} w-full sm:w-auto`}>
        {loading && <Spinner />}
        {loading ? 'AI กำลังสรุปรายงาน...' : 'สร้างรายงานสรุป'}
      </button>

      {error && <ErrorBox message={error} onClose={() => setError('')} />}

      {report && (
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">รายงานสรุป</h2>
            <div className="grid grid-cols-2 sm:flex gap-2">
              <button type="button" onClick={copy} className={secondaryBtn}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</button>
              <button type="button" onClick={print} className={secondaryBtn}>พิมพ์</button>
            </div>
          </div>
          <div className="p-4" ref={reportRef}>
            <MarkdownView text={report} />
          </div>
          {parentText && (
            <div className="p-3 border-t border-gray-200 space-y-2">
              <button type="button" onClick={copyParent} className={`${secondaryBtn} w-full sm:w-auto`}>
                {copiedParent ? 'คัดลอกแล้ว' : 'คัดลอกข้อความถึงผู้ปกครอง'}
              </button>
              <textarea ref={parentRef} readOnly value={parentText} aria-label="ข้อความถึงผู้ปกครอง" rows={1} className="sr-only" tabIndex={-1} />
            </div>
          )}
        </div>
      )}
      <Disclaimer />
    </div>
  );
};

/* ---------- แท็บร่างงาน ---------- */

const rubricToNode = (rubric) => {
  if (!rubric) return null;
  if (typeof rubric === 'string') return <MarkdownView text={rubric} />;
  if (Array.isArray(rubric)) {
    return (
      <ul className="list-disc pl-6 space-y-1 text-sm">
        {rubric.map((r, i) => (
          <li key={i}>{typeof r === 'string' ? r : Object.values(r).join(' - ')}</li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="list-disc pl-6 space-y-1 text-sm">
      {Object.entries(rubric).map(([k, v]) => (
        <li key={k}><strong>{k}</strong>: {typeof v === 'string' ? v : JSON.stringify(v)}</li>
      ))}
    </ul>
  );
};

const DraftTab = ({ disabled, subjects }) => {
  const navigate = useNavigate();
  const [subjectName, setSubjectName] = useState('');
  const [gradeName, setGradeName] = useState('');
  const [topic, setTopic] = useState('');
  const [scoringType, setScoringType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);

  // พิมพ์ชื่อวิชาเองหรือเลือกจากรายการ ถ้าตรงกับวิชาที่มีอยู่จะเติมชั้นให้เอง
  const changeSubject = (value) => {
    setSubjectName(value);
    const s = subjects.find(x => x.subjectName === value);
    if (s?.grade?.gradeName) setGradeName(s.grade.gradeName);
  };

  const generate = async (e) => {
    e.preventDefault();
    if (disabled || loading || !subjectName.trim() || !topic.trim()) return;
    setLoading(true);
    setError('');
    setDraft(null);
    try {
      const payload = { subjectName: subjectName.trim(), topic: topic.trim() };
      if (gradeName.trim()) payload.gradeName = gradeName.trim();
      if (scoringType) payload.scoringType = scoringType;
      const res = await aiAPI.draftTask(payload);
      setDraft(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const useDraft = () => {
    navigate('/admin/tasks', {
      state: {
        aiDraft: {
          taskName: draft.taskName,
          description: draft.description,
          scoringType: draft.scoringType,
          maxScore: draft.maxScore
        }
      }
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={generate} className="space-y-4 max-w-2xl">
        <div>
          <label htmlFor="ai-subject" className="block text-sm font-medium text-gray-700 mb-1">วิชา</label>
          <input id="ai-subject" type="text" list="ai-subject-list" value={subjectName} onChange={(e) => changeSubject(e.target.value)} disabled={disabled} required className={inputClass} placeholder="พิมพ์หรือเลือกวิชา เช่น คณิตศาสตร์" />
          <datalist id="ai-subject-list">
            {subjects.map(x => <option key={x.id} value={x.subjectName}>{x.label}</option>)}
          </datalist>
        </div>
        <div>
          <label htmlFor="ai-topic" className="block text-sm font-medium text-gray-700 mb-1">หัวข้อ</label>
          <textarea id="ai-topic" rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} disabled={disabled} required className={`${inputClass} resize-y`} placeholder="เช่น สมการเชิงเส้นตัวแปรเดียว" />
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer min-h-[44px] inline-flex items-center text-brand-600">ตัวเลือกเพิ่มเติม</summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div>
              <label htmlFor="ai-grade" className="block text-sm font-medium text-gray-700 mb-1">ชั้น</label>
              <input id="ai-grade" type="text" value={gradeName} onChange={(e) => setGradeName(e.target.value)} disabled={disabled} className={inputClass} placeholder="เช่น ม.2" />
            </div>
            <div>
              <label htmlFor="ai-scoring" className="block text-sm font-medium text-gray-700 mb-1">การให้คะแนน</label>
              <select id="ai-scoring" value={scoringType} onChange={(e) => setScoringType(e.target.value)} disabled={disabled} className={inputClass}>
                <option value="">ให้ AI แนะนำ</option>
                {Object.entries(SCORING_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        </details>
        <button type="submit" disabled={disabled || loading || !subjectName.trim() || !topic.trim()} className={`${primaryBtn} w-full sm:w-auto`}>
          {loading && <Spinner />}
          {loading ? 'AI กำลังร่างงาน...' : 'ร่างงานด้วย AI'}
        </button>
      </form>

      {error && <ErrorBox message={error} onClose={() => setError('')} />}

      {draft && (
        <div className="border border-gray-200 rounded-lg bg-white p-4 space-y-3 max-w-2xl">
          <h2 className="font-semibold text-gray-800">ร่างงานจาก AI</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">ชื่องาน</dt>
              <dd className="font-medium text-gray-900 break-words">{draft.taskName}</dd>
            </div>
            <div>
              <dt className="text-gray-500">รายละเอียด</dt>
              <dd className="text-gray-800 whitespace-pre-wrap break-words">{draft.description}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-gray-500">รูปแบบการให้คะแนน</dt>
                <dd className="text-gray-800">{SCORING_LABELS[draft.scoringType] || draft.scoringType || '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">คะแนนเต็ม</dt>
                <dd className="text-gray-800">{draft.scoringType === 'SCORED' && draft.maxScore ? draft.maxScore : '-'}</dd>
              </div>
            </div>
            {draft.rubric && (
              <div>
                <dt className="text-gray-500 mb-1">เกณฑ์การให้คะแนน (Rubric)</dt>
                <dd className="bg-gray-50 rounded-lg p-3">{rubricToNode(draft.rubric)}</dd>
              </div>
            )}
          </dl>
          <button type="button" onClick={useDraft} className={`${primaryBtn} w-full sm:w-auto`}>
            ใช้ร่างนี้สร้างงาน
          </button>
        </div>
      )}
      <Disclaimer />
    </div>
  );
};

/* ---------- หน้าหลัก ---------- */

const AIAssistant = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState('ask');
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await aiAPI.status();
        if (!cancelled) setStatus(res.data);
      } catch (err) {
        if (!cancelled) setStatusError(getErrorMessage(err, 'ไม่สามารถตรวจสอบสถานะผู้ช่วย AI ได้'));
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
      try {
        const [classRes, subjectRes] = await Promise.all([classAPI.getAll(), subjectAPI.getAll()]);
        if (cancelled) return;
        setClasses(classRes.data || []);
        setSubjects((subjectRes.data || []).map(s => ({
          ...s,
          label: s.grade?.gradeName ? `${s.subjectName} (${s.grade.gradeName})` : s.subjectName
        })));
      } catch (err) {
        // ตัวกรองเป็นของเสริม ถ้าโหลดไม่ได้ยังใช้งานแบบไม่กรองได้
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const enabled = !!status?.enabled;
  const disabled = statusLoading || !enabled;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-800">ผู้ช่วย AI</h1>
        {enabled && (
          <span title={[PROVIDER_LABELS[status.provider] || status.provider, status.model].filter(Boolean).join(' · ')} className="inline-flex items-center gap-2 self-start text-xs sm:text-sm px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            พร้อมใช้งาน
          </span>
        )}
      </div>

      {statusLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner className="h-4 w-4" /> กำลังตรวจสอบสถานะ AI...</div>
      )}

      {statusError && <ErrorBox message={statusError} />}

      {!statusLoading && !statusError && !enabled && (
        <div role="status" className="bg-white rounded-lg shadow p-6 sm:p-10 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="mt-3 font-semibold text-gray-800">{isAdmin ? 'ยังไม่ได้ตั้งค่า AI' : 'ผู้ช่วย AI ยังไม่เปิดใช้ แจ้งผู้ดูแลระบบ'}</p>
          {isAdmin && (
            <ol className="mt-3 mx-auto max-w-md list-decimal space-y-1 pl-5 text-left text-sm text-gray-600">
              <li>ใส่ API key อย่างใดอย่างหนึ่งในไฟล์ <code className="bg-gray-100 px-1 rounded">.env</code> ของ backend: <code className="bg-gray-100 px-1 rounded break-all">ANTHROPIC_API_KEY</code>, <code className="bg-gray-100 px-1 rounded break-all">GEMINI_API_KEY</code> หรือ <code className="bg-gray-100 px-1 rounded break-all">OPENAI_API_KEY</code></li>
              <li>รีสตาร์ทเซิร์ฟเวอร์ แล้วรีเฟรชหน้านี้</li>
            </ol>
          )}
        </div>
      )}

      {(statusLoading || enabled) && (
      <div className="bg-white rounded-lg shadow">
        <div role="tablist" aria-label="ฟังก์ชันผู้ช่วย AI" className="flex overflow-x-auto border-b border-gray-200">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`ai-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`ai-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 sm:flex-none whitespace-nowrap min-h-[44px] px-5 py-3 text-sm font-medium border-b-2 -mb-px ${
                activeTab === tab.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`ai-panel-${activeTab}`} aria-labelledby={`ai-tab-${activeTab}`} className="p-4 sm:p-6">
          {activeTab === 'ask' && <AskTab disabled={disabled} classes={classes} subjects={subjects} userId={user?.id} />}
          {activeTab === 'report' && <ReportTab disabled={disabled} classes={classes} subjects={subjects} />}
          {activeTab === 'draft' && <DraftTab disabled={disabled} subjects={subjects} />}
        </div>
      </div>
      )}
    </div>
  );
};

export default AIAssistant;
