import 'server-only';
import { cache } from 'react';
import { database, submissionsConfigured } from './server';
import { CONTENT_VERSION } from './content';
import { defaultSettings, validateContent, type SiteSettings } from './site-content';
import { CODE_PATTERN } from './progress';
export type PublicCode={code:string;created_at:string|null;added_at?:string|null};
export type PublicSnapshot={codes:PublicCode[];settings:SiteSettings;live:boolean;acceptingSubmissions:boolean;contentVersion:string;etag:string;error?:string};
export async function readSettings(db:NonNullable<ReturnType<typeof database>>):Promise<SiteSettings>{
  const {data,error}=await db.from('site_settings').select('auto_approve,submissions_enabled,content,revision,codes_revision,updated_at').eq('id',1).single();
  if(error||!data)throw new Error('إعدادات قاعدة البيانات غير متاحة. تأكد من تنفيذ ملف الترقية.');
  return {autoApprove:data.auto_approve,submissionsEnabled:data.submissions_enabled,content:validateContent(data.content),revision:Number(data.revision),codesRevision:Number(data.codes_revision),updatedAt:data.updated_at};
}
export function snapshotTag(settings:SiteSettings){return '"'+CONTENT_VERSION+':'+settings.revision+':'+settings.codesRevision+'"';}
export async function readApprovedCodes(db:NonNullable<ReturnType<typeof database>>):Promise<PublicCode[]>{
  const result:PublicCode[]=[];
  for(let page=0;page<100;page++){
    const {data,error}=await db.from('codes').select('code,created_at:reviewed_at,added_at:created_at').eq('status','approved').order('sort_order').order('id').range(page*1000,page*1000+999);
    if(error)throw new Error('تعذر تحميل الأكواد من قاعدة البيانات.');
    for(const row of data||[])if(CODE_PATTERN.test(row.code))result.push(row);
    if(!data||data.length<1000)return result;
  }
  throw new Error('قائمة الأكواد أكبر من الحد المسموح للاستجابة.');
}
export const initialSnapshot=cache(async():Promise<PublicSnapshot>=>{
  const db=database();
  try{
    if(!db)throw new Error('الاتصال بقاعدة البيانات لم يُضبط بعد.');
    const settings=await readSettings(db),codes=await readApprovedCodes(db);
    return{codes,settings,live:true,acceptingSubmissions:settings.submissionsEnabled&&submissionsConfigured(),contentVersion:CONTENT_VERSION,etag:snapshotTag(settings)};
  }catch(e){return{codes:[],settings:defaultSettings(),live:false,acceptingSubmissions:false,contentVersion:CONTENT_VERSION,etag:'',error:e instanceof Error?e.message:'تعذر الاتصال بقاعدة البيانات.'};}
});
