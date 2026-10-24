export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const btnPrimary =
  'min-h-[44px] px-5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';
export const btnSecondary =
  'min-h-[44px] px-4 rounded-lg border border-ink-200 bg-white text-ink-700 font-medium hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';
