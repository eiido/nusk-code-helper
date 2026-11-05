import{NextRequest,NextResponse}from'next/server';
import{CODE_PATTERN}from'@/lib/progress';
import{json,readBody,requireAdmin,sameOrigin}from'@/lib/server';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pageSize=40;
function pageNumber(v:string|null){const n=Number(v||0);return Number.isSafeInteger(n)&&n>=0&&n<100000?n:0;}
export async function GET(request:NextRequest){
 const db=await requireAdmin(request);if(!db)return json('غير مصرح لك بالدخول.',401);
 const params=request.nextUrl.searchParams,page=pageNumber(params.get('page')),reportPage=pageNumber(params.get('reportPage'));
 const status=params.get('status')||'all',search=(params.get('q')||'').trim().slice(0,100);
 if(!['all','approved','pending','rejected','deleted'].includes(status))return json('تصفية غير صالحة.',400);
 let query=db.from('codes').select('id,code,status,created_at,reviewed_at,deleted_at,sort_order',{count:'exact'});
 if(status!=='all')query=query.eq('status',status);
 if(search)query=query.ilike('code','%'+search.replace(/[\\%_]/g,'\\$&')+'%');
 const[codes,reports,...totals]=await Promise.all([
  query.order('sort_order').order('id').range(page*pageSize,page*pageSize+pageSize-1),
  db.from('reports').select('id,code,reason,created_at',{count:'exact'}).eq('resolved',false).order('created_at').order('id').range(reportPage*pageSize,reportPage*pageSize+pageSize-1),
  ...['approved','pending','rejected','deleted'].map(value=>db.from('codes').select('id',{head:true,count:'exact'}).eq('status',value)),
 ]);
 if(codes.error||reports.error||totals.some(result=>result.error))return json('تعذر جلب بيانات الإدارة. تأكد من ترقية قاعدة البيانات.',503);
 const reportCodes=[...new Set((reports.data||[]).map(r=>r.code))];
 const linked=reportCodes.length?await db.from('codes').select('id,code,status').in('code',reportCodes):{data:[],error:null};
 if(linked.error)return json('تعذر جلب الأكواد المرتبطة بالبلاغات.',503);
 const mapping=new Map((linked.data||[]).map(c=>[c.code,c]));
 const stats={approved:totals[0].count||0,pending:totals[1].count||0,rejected:totals[2].count||0,deleted:totals[3].count||0};
 return NextResponse.json({codes:codes.data,count:codes.count,page,pageSize,reports:reports.data?.map(r=>({...r,codeId:mapping.get(r.code)?.id||null,codeStatus:mapping.get(r.code)?.status||null})),reportCount:reports.count,reportPage,stats},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return json('مصدر الطلب غير مسموح.',403);
 const db=await requireAdmin(request);if(!db)return json('غير مصرح لك بالدخول.',401);
 let body:unknown;try{body=await readBody(request);}catch{return json('طلب غير صالح.',400);}
 const code=(body as{code?:unknown})?.code;if(typeof code!=='string'||!CODE_PATTERN.test(code))return json('كود غير صالح الصيغة.',400);
 const{error}=await db.from('codes').insert({code,status:'approved',reviewed_at:new Date().toISOString()});
 if(error?.code==='23505')return json('الكود مسجل بالفعل. ابحث عنه لاستعادته أو تغيير حالته.',409);
 return error?json('تعذر إضافة الكود.',503):json('تمت إضافة الكود ونشره.',201);
}
export async function PATCH(request:NextRequest){
 if(!sameOrigin(request))return json('مصدر الطلب غير مسموح.',403);
 const db=await requireAdmin(request);if(!db)return json('غير مصرح لك بالدخول.',401);
 let body:unknown;try{body=await readBody(request);}catch{return json('طلب غير صالح.',400);}
 const{id,action,code}=(body||{})as{id?:unknown;action?:unknown;code?:unknown};
 if(typeof id!=='string'||!uuid.test(id)||!['approve','reject','resolve','delete','restore','edit'].includes(String(action)))return json('إجراء غير صالح.',400);
 if(action==='edit'&&(typeof code!=='string'||!CODE_PATTERN.test(code)))return json('الكود الجديد غير صالح.',400);
 if(action==='resolve'){
  const{data,error}=await db.from('reports').update({resolved:true}).eq('id',id).select('id');
  if(error)return json('تعذر حفظ مراجعة البلاغ.',503);if(!data?.length)return json('البلاغ لم يعد متاحًا.',409);return json('تمت مراجعة البلاغ.');
 }
 const{data,error}=await db.rpc('moderate_code',{p_id:id,p_action:action,p_code:action==='edit'?code:null});
 if(error?.code==='23505')return json('الكود الجديد مسجل بالفعل.',409);
 if(error)return json('تعذر حفظ الإجراء. تأكد من تنفيذ ترقية قاعدة البيانات.',503);
 if(data!==true)return json('الكود لم يعد موجودًا. حدّث القائمة.',409);
 const messages:Record<string,string>={approve:'تم نشر الكود.',reject:'تم رفض الكود وإخفاؤه عن الزوار.',delete:'تم حذف الكود من القائمة وحفظه في المحذوفات، ومراجعة بلاغاته. يمكن استعادته.',restore:'تمت استعادة الكود ونشره.',edit:'تم تعديل الكود.'};
 return json(messages[String(action)]);
}
