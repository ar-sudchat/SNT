import { t } from '../../i18n';
import React, { useEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { useVisualViewportBox, useBodyScrollLock } from './WindowModal';

const dialogButtonText = (text) => text === 'ตกลง' ? t('ตกลง') : text === 'ยกเลิก' ? t('ยกเลิก') : text === 'ยืนยัน' ? t('ยืนยัน') : text;

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = t('แจ้งเตือน'),
  message = '',
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก',
  type = 'info', // danger, warning, info, success
  mode = 'confirm', // confirm (2 buttons) | alert (1 button) | prompt (input) | copy (read-only text + คัดลอก)
  // โหมด prompt
  label = '',
  defaultValue = '',
  placeholder = '',
  validate, // (value) => ข้อความ error | '' | null
  // โหมด copy
  text = ''
}) => {
  const uid = useId();
  const titleId = `dlg-title-${uid}`;
  const descId = `dlg-desc-${uid}`;
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const primaryRef = useRef(null);
  const cancelRef = useRef(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isInput = mode === 'prompt' || mode === 'copy';
  // มือถือ: ใช้พื้นที่เหนือแป้นพิมพ์ ปุ่มยืนยันจะไม่ถูกบัง
  const vvBox = useVisualViewportBox(isOpen);
  useBodyScrollLock(isOpen);

  // เปิด: รีเซ็ตค่า, โฟกัสช่องกรอก/ปุ่มหลัก, ปิด: คืนโฟกัสให้ปุ่มที่เรียก
  useEffect(() => {
    if (!isOpen) return undefined;
    const trigger = document.activeElement;
    setValue(defaultValue); setError(''); setCopied(false);
    const t = setTimeout(() => {
      const el = inputRef.current || (type === 'danger' && mode === 'confirm' ? cancelRef.current : primaryRef.current);
      if (el) { el.focus(); if (el.select && mode === 'prompt') el.select(); }
    }, 30);
    return () => {
      clearTimeout(t);
      if (trigger && trigger.isConnected && trigger.focus) trigger.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Esc = ยกเลิก, Tab วนอยู่ในกล่อง
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const f = panelRef.current.querySelectorAll('button:not([disabled]), textarea, input, [href], [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!panelRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [isOpen]);

  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      icon: (
        <svg aria-hidden="true" className="w-12 h-12 text-fail" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      confirmBtn: 'bg-fail hover:brightness-95 focus:ring-fail',
      iconBg: 'bg-fail/10'
    },
    warning: {
      icon: (
        <svg aria-hidden="true" className="w-12 h-12 text-pending" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      confirmBtn: 'bg-pending hover:brightness-95 focus:ring-pending',
      iconBg: 'bg-pending/10'
    },
    info: {
      icon: (
        <svg aria-hidden="true" className="w-12 h-12 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      confirmBtn: 'bg-primary !text-primary-fg hover:brightness-95 focus:ring-brand-500',
      iconBg: 'bg-brand-100'
    },
    success: {
      icon: (
        <svg aria-hidden="true" className="w-12 h-12 text-pass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      confirmBtn: 'bg-primary !text-primary-fg hover:brightness-95 focus:ring-brand-500',
      iconBg: 'bg-pass/10'
    }
  };

  const style = typeStyles[type] || typeStyles.info;

  const handleOverlayClick = (e) => {
    e.stopPropagation(); // portal: กันคลิกทะลุไปยัง element แม่ใน React tree
    if ((e.target === e.currentTarget || e.target.dataset?.dlgWrap) && !isInput) {
      onClose();
    }
  };

  const handleConfirm = (e) => {
    if (e && e.preventDefault) { e.preventDefault(); e.stopPropagation(); }
    if (mode === 'prompt') {
      const v = value;
      const msg = validate ? validate(v) : '';
      if (msg) { setError(msg); if (inputRef.current) inputRef.current.focus(); return; }
      if (onConfirm) onConfirm(v);
      onClose();
      return;
    }
    if (onConfirm) onConfirm();
    onClose();
  };

  const handleCopy = async () => {
    const el = inputRef.current;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (err) {
      try { if (el) { el.focus(); el.select(); } ok = document.execCommand('copy'); } catch (err2) { ok = false; }
    }
    if (ok) setCopied(true); else if (el) { el.focus(); el.select(); setError(t('คัดลอกอัตโนมัติไม่ได้ — ข้อความถูกเลือกไว้แล้ว กดคัดลอก (Ctrl/Cmd + C) เอง')); }
  };

  const fieldCls = 'w-full rounded-xl border-2 border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30';
  const btnBase = 'w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  return createPortal(
    <div
      className="fixed inset-x-0 z-[100] overflow-y-auto overscroll-contain"
      style={vvBox ? { top: vvBox.top, height: vvBox.height } : { top: 0, bottom: 0 }}
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" aria-hidden="true"></div>

      {/* Dialog: มือถือเป็น bottom-sheet, จอใหญ่อยู่กลาง */}
      <div data-dlg-wrap="1" className="flex min-h-full items-end justify-center sm:items-center sm:px-4 sm:py-4">
        <form
          ref={panelRef}
          role={mode === 'alert' ? 'alertdialog' : 'dialog'}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={message ? descId : undefined}
          onSubmit={handleConfirm}
          className="relative w-full max-w-md rounded-t-2xl bg-white shadow-2xl animate-fade-in sm:rounded-2xl"
        >
          <div className="p-5 text-center sm:p-6" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            {/* Icon */}
            <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full sm:mb-4 sm:h-20 sm:w-20 ${style.iconBg}`}>
              {style.icon}
            </div>

            {/* Title */}
            <h3 id={titleId} className="mb-2 break-words text-xl font-semibold text-gray-900">
              {title}
            </h3>

            {/* Message */}
            {message ? (
              <p id={descId} className={`break-words text-gray-500 whitespace-pre-line ${isInput ? 'mb-4' : 'mb-6'}`}>
                {message}
              </p>
            ) : null}

            {mode === 'prompt' && (
              <div className="mb-5 text-left">
                {label ? <label htmlFor={`${titleId}-in`} className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label> : null}
                <input
                  id={`${titleId}-in`}
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => { setValue(e.target.value); if (error) setError(''); }}
                  placeholder={placeholder}
                  autoComplete="off"
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? `${titleId}-err` : undefined}
                  className={fieldCls}
                />
                {error ? <p id={`${titleId}-err`} role="alert" className="mt-1.5 text-sm text-fail">{error}</p> : null}
              </div>
            )}

            {mode === 'copy' && (
              <div className="mb-5 text-left">
                <textarea
                  ref={inputRef}
                  readOnly
                  value={text}
                  rows={Math.min(8, Math.max(3, String(text).split('\n').length + 1))}
                  onFocus={(e) => e.target.select()}
                  aria-label={title}
                  className={`${fieldCls} resize-none break-all`}
                />
                {copied ? <p role="status" className="mt-1.5 text-sm text-pass">{t("คัดลอกแล้ว")}</p> : null}
                {error ? <p role="alert" className="mt-1.5 text-sm text-fail">{error}</p> : null}
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              {mode === 'copy' ? (
                <>
                  <button type="button" ref={cancelRef} onClick={onClose}
                    className={`${btnBase} border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300`}>
                    {cancelText === 'ยกเลิก' ? t('ปิด') : dialogButtonText(cancelText)}
                  </button>
                  <button type="button" ref={primaryRef} onClick={handleCopy}
                    className={`${btnBase} text-white ${style.confirmBtn}`}>
                    {confirmText === 'ตกลง' ? t('คัดลอก') : dialogButtonText(confirmText)}
                  </button>
                </>
              ) : (
                <>
                  {(mode === 'confirm' || mode === 'prompt') && (
                    <button type="button" ref={cancelRef} onClick={onClose}
                      className={`${btnBase} border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300`}>
                      {dialogButtonText(cancelText)}
                    </button>
                  )}
                  <button type="submit" ref={primaryRef}
                    className={`${btnBase} text-white ${style.confirmBtn}`}>
                    {dialogButtonText(confirmText)}
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: none; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        @media (prefers-reduced-motion: reduce) { .animate-fade-in { animation: none; } }
      `}</style>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
