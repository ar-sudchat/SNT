import { useCallback, useEffect, useState } from 'react';
import { currentTid, flushOutbox, listQueued, subscribe } from './outbox';

const FLUSH_INTERVAL_MS = 30000;

// สถานะคิว + flush อัตโนมัติ (online event, กลับมาโฟกัสหน้า, ทุก 30 วิ)
const useOutbox = ({ onRejected } = {}) => {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [pending, setPending] = useState(0);
  const [flushingNow, setFlushingNow] = useState(false);
  const [otherSchool, setOtherSchool] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const items = await listQueued();
      const tid = currentTid();
      const mine = items.filter((i) => i.tid && i.tid === tid).length;
      setPending(mine);
      setOtherSchool(items.length - mine);
    } catch { /* ignore */ }
  }, []);

  const flush = useCallback(async () => {
    const tid = currentTid();
    if (!(await listQueued()).some((i) => i.tid && i.tid === tid)) return;
    setFlushingNow(true);
    try {
      const res = await flushOutbox();
      if (res.rejected.length && onRejected) onRejected(res.rejected);
    } finally {
      setFlushingNow(false);
      refresh();
    }
  }, [onRejected, refresh]);

  useEffect(() => {
    refresh();
    const unsub = subscribe(refresh);
    const goOnline = () => { setOnline(true); flush(); };
    const goOffline = () => setOnline(false);
    const onFocus = () => flush();
    const onVis = () => { if (document.visibilityState === 'visible') flush(); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    const timer = setInterval(() => flush(), FLUSH_INTERVAL_MS);
    flush();
    return () => {
      unsub();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(timer);
    };
  }, [flush, refresh]);

  return { online, pending, otherSchool, flushing: flushingNow, flush };
};

export default useOutbox;
