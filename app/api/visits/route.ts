import { NextRequest, NextResponse } from 'next/server';
import { clientHash, database, json, rateLimit, sameOrigin } from '@/lib/server';

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json('مصدر الطلب غير مسموح.', 403);
  const db = database();
  if (!db) return json('عداد الزيارات غير متاح.', 503);

  try {
    if (!await rateLimit(db, clientHash(request), 'visit', 60)) {
      return json('تم بلوغ حد طلبات العداد.', 429);
    }
    const { data, error } = await db.rpc('record_site_visit');
    if (error || typeof data !== 'number') return json('عداد الزيارات غير متاح.', 503);
    return NextResponse.json({ visits: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return json('عداد الزيارات غير متاح.', 503);
  }
}
