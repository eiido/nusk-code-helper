import { NextRequest, NextResponse } from 'next/server';
import { MAX_IMPORT_BYTES, MAX_IMPORT_CODES, parseCodeFile } from '@/lib/code-import';
import { json, readBody, requireAdmin, sameOrigin } from '@/lib/server';

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json('مصدر الطلب غير مسموح.', 403);
  const db = await requireAdmin(request);
  if (!db) return json('غير مصرح لك بالدخول.', 401);

  let body: { text?: unknown };
  try {
    body = await readBody(request, MAX_IMPORT_BYTES * 2) as typeof body;
  } catch {
    return json('تعذر قراءة الملف. تأكد من صيغته وحجمه.', 400);
  }

  if (typeof body?.text !== 'string' || Buffer.byteLength(body.text) > MAX_IMPORT_BYTES) {
    return json('اختر ملف TXT لا يزيد حجمه عن ٦٤ كيلوبايت.', 400);
  }
  const { codes, duplicates, invalidLines } = parseCodeFile(body.text);
  if (invalidLines.length) return json('راجع صيغة الكود في السطور: ' + invalidLines.slice(0, 10).join('، '), 400);
  if (!codes.length || codes.length > MAX_IMPORT_CODES) {
    return json('الملف لازم يحتوي على كود واحد على الأقل وبحد أقصى ٢٠٠٠ كود مختلف.', 400);
  }

  const reviewedAt = new Date().toISOString();
  const { count, error } = await db.from('codes').upsert(
    codes.map(code => ({ code, status: 'approved', reviewed_at: reviewedAt })),
    { onConflict: 'code', ignoreDuplicates: true, count: 'exact' },
  );
  if (error || count === null) return json('تعذر تأكيد نتيجة الاستيراد. يمكنك إعادة المحاولة بأمان.', 503);

  const existing = codes.length - count;
  const number = (value: number) => value.toLocaleString('ar-EG');
  return NextResponse.json({
    inserted: count, existing, duplicates,
    message: `تم نشر ${number(count)} كود. موجود مسبقًا ${number(existing)}، ومكرر داخل الملف ${number(duplicates)}.`,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
