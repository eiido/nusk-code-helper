import { NextRequest } from 'next/server';
import { CODE_PATTERN } from '@/lib/progress';
import { clientHash, database, json, rateLimit, readBody, sameOrigin, submissionsConfigured } from '@/lib/server';
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json('مصدر الطلب غير مسموح.', 403);
  const db = database(); if (!db || !submissionsConfigured()) return json('استقبال البلاغات غير متاح حاليًا.', 503);
  let body: unknown;
  try { body = await readBody(request); } catch { return json('طلب غير صالح.', 400); }
  const { code, reason } = (body || {}) as { code?: unknown; reason?: unknown };
  if (typeof code !== 'string' || !CODE_PATTERN.test(code) || reason !== 'not_working') return json('بيانات البلاغ غير صالحة.', 400);
  try {
    const hash = clientHash(request);
    if (!(await rateLimit(db, hash, 'report', 10))) return json('وصلت لحد البلاغات المؤقت. حاول بعد دقيقة.', 429);
    {
      const { data, error } = await db.from('codes').select('id').eq('code', code).eq('status', 'approved').maybeSingle();
      if (error || !data) return json('الكود غير موجود في القائمة المعتمدة.', 400);
    }
    const { error } = await db.from('reports').insert({ code, reason, reporter_hash: hash });
    if (error?.code === '23505') return json('سبق تسجيل بلاغك على هذا الكود. شكرًا لك.');
    if (error) throw error;
    return json('تم إرسال البلاغ للمراجعة. لن يُحذف الكود تلقائيًا.', 201);
  } catch { return json('تعذر تأكيد إرسال البلاغ الآن. حاول لاحقًا.', 503); }
}
