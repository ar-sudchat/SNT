import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

// กล่องโต้ตอบของ KruScan แทน alert/confirm/prompt ของเบราว์เซอร์
//   const dialog = useDialog();
//   await dialog.alert({ title, message, type });                 → Promise<void>
//   await dialog.confirm({ title, message, confirmText, cancelText, type }) → Promise<boolean>
//   await dialog.prompt({ title, label, defaultValue, placeholder, confirmText, validate }) → Promise<string|null>
//   await dialog.copyText({ title, message, text })               → Promise<void>  (สำรองเมื่อคัดลอกอัตโนมัติไม่ได้)
const DialogContext = createContext(null);

export const DialogProvider = ({ children }) => {
  const [current, setCurrent] = useState(null); // { id, kind, props, resolve }
  const queue = useRef([]);
  const seq = useRef(0);
  const active = useRef(null);

  const showNext = useCallback(() => {
    const next = queue.current.shift() || null;
    active.current = next;
    setCurrent(next);
  }, []);

  const open = useCallback((kind, props, fallback) => new Promise((resolve) => {
    const item = { id: ++seq.current, kind, props, resolve, fallback, done: false };
    if (active.current) queue.current.push(item);
    else { active.current = item; setCurrent(item); }
  }), []);

  const settle = useCallback((item, value) => {
    if (item.done) return;
    item.done = true;
    item.resolve(value);
    showNext();
  }, [showNext]);

  const api = useMemo(() => ({
    alert: (o = {}) => open('alert', { type: 'info', confirmText: 'ตกลง', ...o }, undefined),
    confirm: (o = {}) => open('confirm', { type: 'warning', confirmText: 'ยืนยัน', cancelText: 'ยกเลิก', ...o }, false),
    prompt: (o = {}) => open('prompt', { type: 'info', confirmText: 'ตกลง', cancelText: 'ยกเลิก', ...o }, null),
    copyText: (o = {}) => open('copy', { type: 'info', ...o }, undefined),
  }), [open]);

  let dialog = null;
  if (current) {
    const { kind, props } = current;
    const common = {
      isOpen: true,
      title: props.title,
      message: props.message || '',
      type: props.type,
      confirmText: props.confirmText,
      cancelText: props.cancelText,
    };
    // onConfirm ถูกเรียกก่อน onClose เสมอ — settle รับค่าแรกเท่านั้น
    if (kind === 'alert') {
      dialog = <ConfirmDialog key={current.id} {...common} mode="alert" onConfirm={() => settle(current, undefined)} onClose={() => settle(current, undefined)} />;
    } else if (kind === 'confirm') {
      dialog = <ConfirmDialog key={current.id} {...common} mode="confirm" onConfirm={() => settle(current, true)} onClose={() => settle(current, false)} />;
    } else if (kind === 'prompt') {
      dialog = (
        <ConfirmDialog key={current.id} {...common} mode="prompt"
          label={props.label} defaultValue={props.defaultValue || ''} placeholder={props.placeholder} validate={props.validate}
          onConfirm={(v) => settle(current, v)} onClose={() => settle(current, null)} />
      );
    } else {
      dialog = <ConfirmDialog key={current.id} {...common} mode="copy" text={props.text || ''} onClose={() => settle(current, undefined)} />;
    }
  }

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog ต้องอยู่ภายใน <DialogProvider>');
  return ctx;
};

export default DialogProvider;
