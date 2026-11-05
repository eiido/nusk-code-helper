import 'server-only';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function submissionsConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.RATE_LIMIT_SECRET?.length || 0) >= 32);
}
export function json(message: string, status = 200) {
  return NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    // Next's internal URL may use localhost even when the browser used 127.0.0.1.
    // Compare against the incoming Host and proxy scheme, not the internal routing URL.
    const incoming = new URL(origin), host = request.headers.get('host');
    const scheme = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || request.nextUrl.protocol.replace(':','');
    return incoming.host === host && incoming.protocol === scheme + ':';
  } catch { return false; }
}
export async function readBody(request: NextRequest, maxBytes = 4096): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('يرجى إرسال بيانات JSON.');
  // Enforce an actual streamed limit; Content-Length alone can be absent or inaccurate.
  const reader = request.body?.getReader();
  if (!reader) throw new Error('الطلب فارغ.');
  let size = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new Error('الطلب أكبر من المسموح.'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('البيانات غير صالحة.'); }
}
export function clientHash(request: NextRequest) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new Error('Rate limiting is not configured.');
  // Vercel overwrites x-vercel-forwarded-for. Only trust the hosting provider's canonical header.
  const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() : 'local-development';
  if (!ip) throw new Error('Missing trusted proxy address.');
  return createHmac('sha256', secret).update(ip).digest('hex');
}
export async function rateLimit(db: NonNullable<ReturnType<typeof database>>, hash: string, kind: string, limit: number) {
  const { data, error } = await db.rpc('consume_rate_limit', { p_key: kind + ':' + hash, p_limit: limit });
  if (error) throw new Error('Rate limiter unavailable.');
  return data === true;
}
export async function requireAdmin(request: NextRequest) {
  const db = database(); if (!db) return null;
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  const allowed = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (error || !data.user?.email || !allowed.includes(data.user.email.toLowerCase()) || !data.user.email_confirmed_at) return null;
  return db;
}
