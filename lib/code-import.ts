import { CODE_PATTERN } from './progress';

export const MAX_IMPORT_CODES = 2000;
export const MAX_IMPORT_BYTES = 65536;

export function parseCodeFile(text: string) {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const codes = new Set<string>();
  let duplicates = 0;
  const invalidLines: number[] = [];

  for (const [index, row] of rows.entries()) {
    const code = row.trim();
    if (!code) continue;
    if (!CODE_PATTERN.test(code)) invalidLines.push(index + 1);
    else if (codes.has(code)) duplicates++;
    else codes.add(code);
  }
  return { codes: [...codes], duplicates, invalidLines };
}
