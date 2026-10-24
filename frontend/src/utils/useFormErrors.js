import { useState, useCallback } from 'react';

// ตรวจฟอร์มเองเป็นภาษาไทย (ใช้คู่กับ <form noValidate>)
// rules: [{ key, message, missing }] เรียงตามลำดับในฟอร์ม · ช่องที่ห่อด้วย data-field={key}
// validate() คืน false และโฟกัสช่องแรกที่ผิด (combobox / input / select)
export default function useFormErrors() {
  const [errors, setErrors] = useState({});

  const validate = useCallback((form, rules) => {
    const next = {};
    rules.forEach((r) => { if (r.missing) next[r.key] = r.message; });
    setErrors(next);
    const first = rules.find((r) => next[r.key]);
    if (!first) return true;
    const wrap = form && form.querySelector(`[data-field="${first.key}"]`);
    const target = wrap && (wrap.matches('input,select,textarea,[role="combobox"]')
      ? wrap
      : wrap.querySelector('[role="combobox"],input,select,textarea'));
    if (target && target.focus) target.focus();
    return false;
  }, []);

  const reset = useCallback(() => setErrors({}), []);

  // แสดงข้อความเฉพาะตอนที่ช่องยังว่างอยู่ (กรอกแล้วข้อความหายเอง)
  const errorFor = (key, stillMissing) => (errors[key] && stillMissing ? errors[key] : '');

  return { validate, reset, errorFor };
}
