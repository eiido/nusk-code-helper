export type CodeState = 'copied' | 'used' | 'skipped' | 'failed';
export type Progress = { version: 3; format: 'nusuk-progress'; states: Record<string, CodeState>; current: string | null; myCode: string; lastSeenAt: string | null };
export const PROGRESS_KEY = 'nusuk_helper_progress_v3';
export const CODE_PATTERN = /^NG-[A-Za-z0-9]{8}$/;
const states = new Set(['copied', 'used', 'skipped', 'failed']);
export function freshProgress(): Progress { return { version: 3, format: 'nusuk-progress', states: {}, current: null, myCode: '', lastSeenAt: null }; }
export function extractCode(text: string): string | null {
  const matches = text.match(/(?<![A-Za-z0-9])NG-[A-Za-z0-9]{8}(?![A-Za-z0-9])/g);
  const unique = [...new Set(matches || [])];
  return unique.length === 1 ? unique[0] : null;
}
export function decodeProgress(value: unknown): Progress {
  if (!value || typeof value !== 'object') throw new Error('ملف تقدم غير صالح.');
  const d = value as Record<string, unknown>;
  if (d.format !== 'nusuk-progress') throw new Error('صيغة الملف غير معروفة.');
  if (d.version === 2 && Array.isArray(d.copied)) {
    if (d.copied.some(c => typeof c !== 'string' || !CODE_PATTERN.test(c))) throw new Error('أكواد غير صالحة في الملف.');
    if (d.lastCode != null && (typeof d.lastCode !== 'string' || !CODE_PATTERN.test(d.lastCode))) throw new Error('كود أخير غير صالح.');
    return { ...freshProgress(), states: Object.fromEntries(d.copied.map(c => [c, 'copied'])), current: null };
  }
  if (d.version !== 3 || !d.states || typeof d.states !== 'object' || Array.isArray(d.states)) throw new Error('إصدار الملف غير مدعوم.');
  for (const [code, state] of Object.entries(d.states)) if (!CODE_PATTERN.test(code) || !states.has(String(state))) throw new Error('حالة أو كود غير صالح.');
  if (d.current != null && (typeof d.current !== 'string' || !CODE_PATTERN.test(d.current))) throw new Error('الكود الحالي غير صالح.');
  if (typeof d.myCode !== 'string' || (d.myCode && !CODE_PATTERN.test(d.myCode))) throw new Error('الكود الشخصي غير صالح.');
  if (d.lastSeenAt != null && (typeof d.lastSeenAt !== 'string' || !Number.isFinite(Date.parse(d.lastSeenAt)))) throw new Error('تاريخ غير صالح.');
  return { ...freshProgress(), states: { ...d.states } as Record<string, CodeState>, current: d.current as string | null, myCode: d.myCode, lastSeenAt: d.lastSeenAt as string | null };
}
export function mergeProgress(a: Progress, b: Progress): Progress {
  return { ...a, states: { ...a.states, ...b.states }, myCode: a.myCode || b.myCode, current: a.current || b.current };
}
export function nextPending(codes: string[], progress: Progress, after?: string | null): string | null {
  if (!codes.length) return null;
  const index = after ? codes.indexOf(after) : -1;
  for (let n = 1; n <= codes.length; n++) { const code = codes[(index + n) % codes.length]; if (!progress.states[code]) return code; }
  return null;
}
