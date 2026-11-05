import {NextRequest}from'next/server';
import{CODE_PATTERN}from'@/lib/progress';
import{clientHash,database,json,rateLimit,readBody,sameOrigin,submissionsConfigured}from'@/lib/server';
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return json('مصدر الطلب غير مسموح.',403);
 const db=database();if(!db||!submissionsConfigured())return json('استقبال الأكواد غير متاح حاليًا.',503);
 let body:unknown;try{body=await readBody(request);}catch{return json('طلب غير صالح أو أكبر من المسموح.',400);}
 const code=(body as{code?:unknown})?.code;if(typeof code!=='string'||!CODE_PATTERN.test(code))return json('يرجى إرسال كود واحد صالح الصيغة.',400);
 try{
  if(!await rateLimit(db,clientHash(request),'submission',5))return json('وصلت لحد الإرسال المؤقت. حاول بعد دقيقة.',429);
  const{data,error}=await db.rpc('submit_public_code',{p_code:code});if(error)throw error;
  if(data?.result==='disabled')return json('المدير أوقف استقبال الأكواد الجديدة مؤقتًا.',503);
  if(data?.result==='duplicate')return json('سبق تسجيل الكود في الموقع. لن يُعاد نشر كود محذوف أو مرفوض تلقائيًا.');
  if(data?.result!=='created')throw new Error();
  return json(data.status==='approved'?'تمت إضافة كودك ونشره مباشرة في القائمة.':'وصل كودك للمراجعة. سيظهر بعد اعتماد المدير.',201);
 }catch{return json('تعذر تأكيد الإرسال الآن. حاول لاحقًا.',503);}
}
