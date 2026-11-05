import{NextRequest,NextResponse}from'next/server';
import{readSettings}from'@/lib/site-data';
import{validateContent}from'@/lib/site-content';
import{json,readBody,requireAdmin,sameOrigin}from'@/lib/server';
export async function GET(request:NextRequest){
 const db=await requireAdmin(request);if(!db)return json('غير مصرح لك بالدخول.',401);
 try{return NextResponse.json(await readSettings(db),{headers:{'Cache-Control':'no-store'}});}catch{return json('نفّذ ملف ترقية قاعدة البيانات أولًا.',503);}
}
export async function PATCH(request:NextRequest){
 if(!sameOrigin(request))return json('مصدر الطلب غير مسموح.',403);
 const db=await requireAdmin(request);if(!db)return json('غير مصرح لك بالدخول.',401);
 try{
  const body=await readBody(request,65536) as Record<string,unknown>;
  if(!body||!Number.isSafeInteger(body.revision)||typeof body.autoApprove!=='boolean'||typeof body.submissionsEnabled!=='boolean')return json('إعدادات غير صالحة.',400);
  const content=validateContent(body.content);
  const{data,error}=await db.from('site_settings').update({auto_approve:body.autoApprove,submissions_enabled:body.submissionsEnabled,content}).eq('id',1).eq('revision',body.revision).select('id');
  if(error)return json('تعذر حفظ إعدادات الموقع.',503);
  if(!data?.length)return json('تغيّرت الإعدادات في جلسة أخرى. حدّث البيانات قبل الحفظ.',409);
  return NextResponse.json({message:'تم حفظ الإعدادات. تظهر للزوار عند التحديث أو خلال ٤٥ ثانية.',settings:await readSettings(db)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return json(e instanceof Error?e.message:'بيانات غير صالحة.',400);}
}
