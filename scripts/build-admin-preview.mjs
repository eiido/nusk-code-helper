// Design review artifact only. The fixture auth/data adapters are injected at build time;
// they are not imported by the real app and cannot grant access to its admin API.
import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const root=new URL('../',import.meta.url);
const seed=await build({entryPoints:[new URL('lib/site-content.ts',root).pathname],bundle:true,write:false,format:'cjs',platform:'node'});
const module={exports:{}};new Function('require','module','exports',seed.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const settings=module.exports.defaultSettings();
const fixture=`
let session={access_token:'design-preview-only'},callback;
globalThis.__adminPreviewClient={auth:{onAuthStateChange(cb){callback=cb;cb('INITIAL_SESSION',session);return{data:{subscription:{unsubscribe(){}}}}},async getSession(){return{data:{session}}},async signOut(){session=null;callback('SIGNED_OUT',null);return{error:null}},async signInWithPassword(){session={access_token:'design-preview-only'};callback('SIGNED_IN',session);return{error:null}}}};
let settings=${JSON.stringify(settings)};
let rows=[{id:'00000000-0000-0000-0000-000000000001',code:'NG-DEMO0001',status:'approved',created_at:'2026-11-04T12:00:00Z'},{id:'00000000-0000-0000-0000-000000000002',code:'NG-DEMO0002',status:'approved',created_at:'2026-11-04T12:00:00Z'},{id:'00000000-0000-0000-0000-000000000003',code:'NG-DEMO0003',status:'pending',created_at:'2026-11-05T12:00:00Z'},{id:'00000000-0000-0000-0000-000000000004',code:'NG-DEMO0004',status:'deleted',created_at:'2026-11-04T12:00:00Z'},{id:'00000000-0000-0000-0000-000000000005',code:'NG-DEMO0005',status:'rejected',created_at:'2026-11-04T12:00:00Z'}];
let reports=[{id:'00000000-0000-0000-0000-000000000101',code:'NG-DEMO0001',codeId:rows[0].id,codeStatus:'approved',created_at:'2026-11-05T12:00:00Z'}];
globalThis.fetch=async(url,init={})=>{
 const path=new URL(url,'https://preview.invalid');const method=init.method||'GET';
 if(!path.pathname.startsWith('/api/admin/'))throw new Error('Preview is offline');
 if(method==='PATCH'&&path.pathname.endsWith('/settings')){settings={...JSON.parse(init.body),revision:settings.revision+1,updatedAt:new Date().toISOString()};return Response.json({settings,message:'تم الحفظ داخل المعاينة فقط.'});}
 if(method==='PATCH'){const {id,action,code}=JSON.parse(init.body);const row=rows.find(r=>r.id===id);if(action==='resolve')reports=reports.filter(r=>r.id!==id);else if(row){if(action==='delete'){row.status='deleted';reports=reports.filter(r=>r.code!==row.code);}if(action==='restore'||action==='approve')row.status='approved';if(action==='reject')row.status='rejected';if(action==='edit')row.code=code;}return Response.json({message:'تم الإجراء في المعاينة المحلية فقط.'});}
 if(method==='POST'){const {code}=JSON.parse(init.body);if(rows.some(r=>r.code===code))return Response.json({message:'الكود موجود بالفعل في المعاينة.'},{status:409});rows.push({id:crypto.randomUUID(),code,status:'approved',created_at:new Date().toISOString()});return Response.json({message:'تمت الإضافة في المعاينة المحلية فقط.'},{status:201});}
 if(path.pathname.endsWith('/settings'))return Response.json(settings);
 const status=path.searchParams.get('status')||'all',q=(path.searchParams.get('q')||'').toLowerCase();const filtered=rows.filter(r=>(status==='all'||r.status===status)&&r.code.toLowerCase().includes(q));const stats=Object.fromEntries(['approved','pending','rejected','deleted'].map(s=>[s,rows.filter(r=>r.status===s).length]));return Response.json({codes:filtered,count:filtered.length,reports:reports.map(r=>({...r,codeStatus:rows.find(c=>c.id===r.codeId)?.status})),reportCount:reports.length,stats});
};
document.addEventListener('click',event=>{const link=event.target.closest?.('a[href="/"]');if(link){event.preventDefault();alert('هذه معاينة للتصميم فقط. افتح الموقع الفعلي من http://127.0.0.1:3000');}});
`;
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import AdminPanel from './components/admin-panel';${fixture}\ncreateRoot(document.getElementById('root')).render(<AdminPanel/>);`,resolveDir:root.pathname,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',minify:true,tsconfig:new URL('tsconfig.json',root).pathname,
 define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_SUPABASE_URL':'"https://preview.invalid"','process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'"preview-only"'},
 plugins:[{name:'design-preview-adapter',setup(build){build.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'fixture',namespace:'preview'}));build.onLoad({filter:/.*/,namespace:'preview'},()=>({contents:'export function createClient(){return globalThis.__adminPreviewClient}',loader:'js'}));}}],
});
let css=(await readFile(new URL('app/globals.css',root),'utf8'))+'\n'+(await readFile(new URL('app/admin/admin.css',root),'utf8'));
css=css.replace("url('/alexandria.woff2')",'url(data:font/woff2;base64,'+(await readFile(new URL('public/alexandria.woff2',root))).toString('base64')+')');
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>معاينة تصميم لوحة الإدارة</title><style>${css}</style></head><body><div style="font:12px/1.9 Tahoma,Arial;text-align:center;padding:10px 16px;background:#f2dfb5;color:#6b542d">معاينة تفاعلية للتصميم ببيانات توضيحية فقط — لا تتصل بحسابك ولا تعدّل قاعدة البيانات. لا تحتاج إدخال بيانات دخول حقيقية.</div><div id="root"></div><script>${js}</script></body></html>`;
const output=new URL('../../nusuk_admin_preview.html',import.meta.url);await writeFile(output,html);console.log('Admin design preview:',output.pathname,Buffer.byteLength(html),'bytes. No real credentials or data used.');
