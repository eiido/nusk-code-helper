import { NextRequest,NextResponse } from 'next/server';
import { database,submissionsConfigured,json } from '@/lib/server';
import { readApprovedCodes,readSettings,snapshotTag } from '@/lib/site-data';
import { CONTENT_VERSION } from '@/lib/content';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const db=database();if(!db)return json('الاتصال بقاعدة البيانات غير متاح.',503);
  try{
    const settings=await readSettings(db),etag=snapshotTag(settings);
    const headers={'Cache-Control':'no-store',ETag:etag};
    if(request.headers.get('if-none-match')===etag)return new NextResponse(null,{status:304,headers});
    const codes=await readApprovedCodes(db);
    return NextResponse.json({codes,live:true,acceptingSubmissions:settings.submissionsEnabled&&submissionsConfigured(),autoApprove:settings.autoApprove,content:settings.content,contentVersion:CONTENT_VERSION,etag},{headers});
  }catch{return json('تعذر تحميل بيانات الموقع. تأكد من ترقية قاعدة البيانات أو حاول مجددًا.',503);}
}
