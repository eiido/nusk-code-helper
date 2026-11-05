import{build}from'esbuild';import{readFile,writeFile}from'node:fs/promises';import{createClient}from'@supabase/supabase-js';
const root=new URL('../',import.meta.url);let props=null;
try{process.loadEnvFile(new URL('.env.local',root));}catch{/* A standalone preview can also be built without a configured account. */}
if(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const settings=await db.from('site_settings').select('content,auto_approve').eq('id',1).single();if(settings.error)throw new Error('Cannot build a current preview: migrated database settings unavailable.');
 const codes=[];for(let page=0;page<100;page++){const result=await db.from('codes').select('code,created_at:reviewed_at').eq('status','approved').order('sort_order').order('id').range(page*1000,page*1000+999);if(result.error)throw new Error('Cannot load preview codes.');codes.push(...result.data);if(result.data.length<1000)break;}
 props={initialCodes:codes.map(c=>c.code),initialItems:codes,initialContent:settings.data.content,initialAutoApprove:settings.data.auto_approve};
}
const options=props?{stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import HelperApp from './components/helper-app';createRoot(document.getElementById('root')).render(<HelperApp {...${JSON.stringify(props)}}/>);`,resolveDir:root.pathname,loader:'tsx'}}:{entryPoints:[new URL('preview-entry.tsx',import.meta.url).pathname]};
const result=await build({...options,bundle:true,write:false,minify:true,format:'iife',platform:'browser',jsx:'automatic',tsconfig:new URL('tsconfig.json',root).pathname,define:{'process.env.NODE_ENV':'"production"'}});
const code=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');let css=await readFile(new URL('app/globals.css',root),'utf8');
const font=(await readFile(new URL('public/alexandria.woff2',root))).toString('base64');css=css.replace("url('/alexandria.woff2')",'url(data:font/woff2;base64,'+font+')');
const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#173e34"><title>مساعد أكواد نسك — معاينة</title><style>${css}</style></head><body><div style="padding:8px 14px;text-align:center;background:#e8d9b8;color:#655431;font-size:11px;font-family:Tahoma,Arial">معاينة محلية بلقطة من المحتوى وقت التوليد · لإدارة البيانات والتحديثات المباشرة افتح رابط الموقع المتصل</div><div id="root"></div><script>${code}</script></body></html>`;
const output=new URL('../../nusuk_first_version.html',import.meta.url);await writeFile(output,html);console.log('Standalone snapshot updated:',output.pathname,Buffer.byteLength(html),'bytes');
