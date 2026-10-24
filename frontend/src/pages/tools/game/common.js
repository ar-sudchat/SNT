export const seatNo = (s, i) => (s && s.studentNumber != null && s.studentNumber !== '' ? s.studentNumber : i + 1);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
export const SPIN_MS = 4200;
