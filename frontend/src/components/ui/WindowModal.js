import { t } from '../../i18n';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// WindowModal — popup ที่ทำตัวเหมือนหน้าต่าง OS: ย่อ / ขยาย / ลาก / ปิด
// <WindowModal open title onClose initialWidth="max-w-lg" footer={...} id="unique-key">...</WindowModal>
// ตอนย่อ เนื้อหายัง mount อยู่ (ข้อมูลในฟอร์มไม่หาย) และมีชิปที่แถบล่างซ้าย

const TASKBAR_ID = 'window-taskbar-root';
const MARGIN = 8;

function getTaskbar() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(TASKBAR_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TASKBAR_ID;
    el.setAttribute('aria-label', t('หน้าต่างที่ย่อไว้'));
    el.className = 'fixed z-40 flex flex-col-reverse gap-2 pointer-events-none';
    el.style.left = 'calc(env(safe-area-inset-left, 0px) + 12px)';
    el.style.bottom = 'calc(env(safe-area-inset-bottom, 0px) + 12px)';
    el.style.maxWidth = 'calc(100vw - 24px)';
    document.body.appendChild(el);
  }
  return el;
}

function loadState(id) {
  if (!id) return null;
  try {
    const raw = sessionStorage.getItem(`wm:${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveState(id, state) {
  if (!id) return;
  try {
    sessionStorage.setItem(`wm:${id}`, JSON.stringify(state));
  } catch (e) {
    /* ignore */
  }
}

function useIsDesktop() {
  const query = '(min-width: 640px)';
  const [match, setMatch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : true
  );
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const fn = () => setMatch(mq.matches);
    fn();
    mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', fn) : mq.removeListener(fn));
  }, []);
  return match;
}

// พื้นที่ที่มองเห็นจริงบนมือถือ (หักแป้นพิมพ์ออก) — ให้โมดัลเต็มจอไม่ถูกแป้นพิมพ์บังปุ่มล่าง
export function useVisualViewportBox(active) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !vv) { setBox(null); return undefined; }
    const fn = () => setBox({ top: vv.offsetTop, height: vv.height });
    fn();
    vv.addEventListener('resize', fn);
    vv.addEventListener('scroll', fn);
    return () => { vv.removeEventListener('resize', fn); vv.removeEventListener('scroll', fn); };
  }, [active]);
  return box;
}

// ล็อกการเลื่อนของหน้าด้านหลังขณะมีโมดัลเปิด (นับซ้อนหลายชั้น)
let lockCount = 0;
let lockPrev = '';
export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    if (lockCount === 0) { lockPrev = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = lockPrev;
    };
  }, [active]);
}

function clamp(pos, el) {
  const w = el ? el.offsetWidth : 0;
  const h = el ? el.offsetHeight : 0;
  const maxX = Math.max(MARGIN, window.innerWidth - w - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - h - MARGIN);
  return {
    x: Math.min(Math.max(MARGIN, pos.x), maxX),
    y: Math.min(Math.max(MARGIN, pos.y), maxY),
  };
}

const btnBase =
  'inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] rounded-md text-title-fg/80 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white';

const Icon = ({ d }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ICON_MIN = 'M3 12h10';
const ICON_MAX = 'M3.5 3.5h9v9h-9z';
const ICON_RESTORE = 'M5.5 5.5h7v7h-7z M3.5 10.5v-7h7';
const ICON_CLOSE = 'M4 4l8 8M12 4l-8 8';

export default function WindowModal({ open, title, onClose, initialWidth = 'max-w-lg', footer, id, children }) {
  const isDesktop = useIsDesktop();
  const saved = useRef(loadState(id));
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(!!(saved.current && saved.current.maximized));
  const [pos, setPos] = useState(saved.current && saved.current.pos ? saved.current.pos : null);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const dragRef = useRef(null);
  const titleId = useId();
  const vvBox = useVisualViewportBox(open && !minimized && !isDesktop);
  useBodyScrollLock(open && !minimized);

  // reset minimized when closed
  useEffect(() => {
    if (!open) setMinimized(false);
  }, [open]);

  // persist position / maximize
  useEffect(() => {
    if (open) saveState(id, { pos, maximized });
  }, [id, open, pos, maximized]);

  // focus management: into window on open/restore, back to opener on close
  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    return () => {
      const el = openerRef.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && !minimized && panelRef.current) {
      const target = panelRef.current.querySelector('[data-autofocus]') || panelRef.current;
      target.focus({ preventScroll: true });
    }
  }, [open, minimized]);

  // keep in viewport on resize
  useEffect(() => {
    if (!open || !pos) return undefined;
    const fn = () => setPos((p) => (p ? clamp(p, panelRef.current) : p));
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [open, pos]);

  // Escape closes (only when not minimized)
  useEffect(() => {
    if (!open || minimized) return undefined;
    const fn = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose && onClose();
      }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, minimized, onClose]);

  const onPointerDown = useCallback(
    (e) => {
      if (!isDesktop || maximized || e.button > 0) return;
      if (e.target.closest('button')) return;
      const rect = panelRef.current.getBoundingClientRect();
      dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, pid: e.pointerId };
      setPos({ x: rect.left, y: rect.top });
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [isDesktop, maximized]
  );

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    const next = clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }, panelRef.current);
    d.last = next;
    if (d.raf) return;
    d.raf = requestAnimationFrame(() => {
      d.raf = null;
      const el = panelRef.current;
      if (el && d.last) {
        el.style.left = `${d.last.x}px`;
        el.style.top = `${d.last.y}px`;
      }
    });
  }, []);

  const endDrag = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.raf) cancelAnimationFrame(d.raf);
    if (d.last) setPos(d.last);
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
  }, []);

  if (!open) return null;

  const toggleMax = () => setMaximized((m) => !m);
  const showMax = isDesktop && maximized;

  let panelStyle;
  let panelClass;
  if (!isDesktop) {
    panelClass = 'fixed inset-x-0 rounded-none';
    const keyboardUp = vvBox && window.innerHeight - vvBox.height > 120;
    panelStyle = vvBox
      ? { top: vvBox.top, height: vvBox.height, paddingBottom: keyboardUp ? 0 : 'env(safe-area-inset-bottom, 0px)' }
      : { top: 0, bottom: 0, paddingBottom: 'env(safe-area-inset-bottom, 0px)' };
  } else if (showMax) {
    panelClass = 'fixed rounded-lg';
    panelStyle = { inset: MARGIN };
  } else if (pos) {
    panelClass = `fixed w-[calc(100vw-2rem)] ${initialWidth} max-h-[90vh] rounded-lg`;
    panelStyle = { left: pos.x, top: pos.y };
  } else {
    panelClass = `fixed w-[calc(100vw-2rem)] ${initialWidth} max-h-[90vh] rounded-lg`;
    panelStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }

  const taskbar = minimized ? getTaskbar() : null;

  return createPortal(
    <>
      {!minimized && (
        <div className="fixed inset-0 z-50 bg-black/50 print:hidden" aria-hidden="true" />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={!minimized ? 'true' : undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
        hidden={minimized}
        className={`${panelClass} z-50 ${minimized ? 'hidden' : 'flex'} print:hidden flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-black/10 focus:outline-none ${
          dragging ? 'select-none' : ''
        }`}
        style={panelStyle}
      >
        <div
          data-drag-handle
          className={`flex items-center gap-1 bg-title text-title-fg pl-4 pr-1 py-1 shrink-0 ${
            isDesktop && !maximized ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
          }`}
          style={isDesktop ? { touchAction: 'none' } : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={(e) => {
            if (isDesktop && !e.target.closest('button')) toggleMax();
          }}
        >
          <h2 id={titleId} className="flex-1 truncate text-base font-semibold text-white select-none">
            {title}
          </h2>
          <button type="button" className={btnBase} aria-label={t("ย่อหน้าต่าง")} title={t("ย่อ")} onClick={() => setMinimized(true)}>
            <Icon d={ICON_MIN} />
          </button>
          {isDesktop && (
            <button
              type="button"
              className={btnBase}
              aria-label={maximized ? t('คืนขนาดหน้าต่าง') : t('ขยายหน้าต่าง')}
              title={maximized ? t('คืนขนาด') : t('ขยาย')}
              onClick={toggleMax}
            >
              <Icon d={maximized ? ICON_RESTORE : ICON_MAX} />
            </button>
          )}
          <button
            type="button"
            className={`${btnBase} hover:!bg-red-500 hover:!text-white`}
            aria-label={t("ปิดหน้าต่าง")}
            title={t("ปิด")}
            onClick={onClose}
          >
            <Icon d={ICON_CLOSE} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">{footer}</div>}
      </div>
      {taskbar &&
        createPortal(
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg bg-gray-900 pl-3 pr-1 py-1 text-white shadow-lg max-w-[18rem]">
            <button
              type="button"
              className="min-h-[44px] sm:min-h-[36px] flex-1 truncate text-left text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded"
              aria-label={t("เปิดหน้าต่าง {value1}", { value1: typeof title === 'string' ? title : '' }).trim()}
              onClick={() => setMinimized(false)}
            >
              {title}
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] rounded-md hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              aria-label={t("คืนหน้าต่าง")}
              title={t("คืนหน้าต่าง")}
              onClick={() => setMinimized(false)}
            >
              <Icon d={ICON_MAX} />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] rounded-md hover:bg-red-500/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              aria-label={t("ปิดหน้าต่าง")}
              title={t("ปิด")}
              onClick={onClose}
            >
              <Icon d={ICON_CLOSE} />
            </button>
          </div>,
          taskbar
        )}
    </>,
    document.body
  );
}
