import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
async function compile(path,options={}){
 const result=await build({entryPoints:[new URL(path,import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',...options});
 const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,mod,mod.exports);return mod.exports;
}
const {defaultSettings}=await compile('../lib/site-content.ts');
const {default:AdminPanel}=await compile('../components/admin-panel.tsx',{
 define:{'process.env.NEXT_PUBLIC_SUPABASE_URL':'"https://fixture.supabase.co"','process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'"fixture-public-key"'},
 plugins:[{name:'fixture-auth',setup(build){build.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'auth',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export function createClient(){return globalThis.__adminFixtureClient}',loader:'js'}));}}],
});
test('admin workflow keeps settings drafts, confirms deletion, and offers restore without leaking actions into search',async()=>{
 const dom=new JSDOM('<!doctype html><html lang="ar" dir="rtl"><body><div id="root"></div></body></html>',{url:'http://127.0.0.1:3000/admin',pretendToBeVisual:true});
 const saved={window:globalThis.window,document:globalThis.document,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),fetch:globalThis.fetch,raf:globalThis.requestAnimationFrame,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.requestAnimationFrame=fn=>{fn(0);return 1;};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 let session={access_token:'fixture-session'};let authCallback;
 globalThis.__adminFixtureClient={auth:{onAuthStateChange(callback){authCallback=callback;callback('INITIAL_SESSION',session);return{data:{subscription:{unsubscribe(){}}}};},async getSession(){return{data:{session}};},async signOut(){session=null;authCallback('SIGNED_OUT',null);return{error:null};}}};
 let settings=defaultSettings();const rows=[
  {id:'00000000-0000-0000-0000-000000000001',code:'NG-TEST0001',status:'approved',created_at:'2026-11-04T12:00:00Z'},
  {id:'00000000-0000-0000-0000-000000000002',code:'NG-TEST0002',status:'pending',created_at:'2026-11-04T12:00:00Z'},
 ];let reports=[{id:'00000000-0000-0000-0000-000000000101',code:rows[0].code,codeId:rows[0].id,codeStatus:'approved',created_at:'2026-11-05T12:00:00Z'}];const writes=[];
 globalThis.fetch=async(url,init={})=>{
  assert.equal(init.headers.Authorization,'Bearer fixture-session');const path=new URL(url,'http://127.0.0.1:3000');
  if(init.method==='PATCH'){
   const body=JSON.parse(init.body);writes.push({path:path.pathname,body});
   if(path.pathname.endsWith('/settings')){settings={...body,revision:settings.revision+1};return Response.json({message:'saved',settings});}
   const row=rows.find(row=>row.id===body.id);
   if(body.action==='delete'){row.status='deleted';reports=reports.filter(report=>report.code!==row.code);}
   if(body.action==='restore')row.status='approved';
   return Response.json({message:'تم حفظ الإجراء.'});
  }
  if(path.pathname.endsWith('/settings'))return Response.json(settings);
  const filter=path.searchParams.get('status');const list=rows.filter(row=>filter==='all'||!filter||row.status===filter);
  const stats=Object.fromEntries(['approved','pending','rejected','deleted'].map(status=>[status,rows.filter(row=>row.status===status).length]));
  return Response.json({codes:list,count:list.length,reports,reportCount:reports.length,stats});
 };
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 const click=async element=>{assert.ok(element,'Expected control exists');await act(async()=>element.click());};
 const nav=label=>[...document.querySelectorAll('.adm-sidebar nav button')].find(b=>b.textContent.trim()===label);
 try{
  await act(async()=>root.render(React.createElement(AdminPanel)));
  assert.ok(document.querySelector('.adm-stats'));assert.equal(document.querySelectorAll('.adm-stat').length,4);
  await click(nav('الإعدادات والمحتوى'));
  const firstSwitch=document.querySelector('.adm-setting-switch input');assert.equal(firstSwitch.checked,true);
  await click(firstSwitch);assert.equal(firstSwitch.checked,false);assert.equal(writes.length,0,'A switch must not silently persist before Save.');
  await click([...document.querySelectorAll('.adm-settings-nav button')].find(b=>b.textContent.includes('هوية الموقع')));
  await click([...document.querySelectorAll('.adm-settings-nav button')].find(b=>b.textContent.includes('النشر والاستقبال')));
  assert.equal(firstSwitch.checked,false,'Draft survives settings section navigation.');
  const form=document.querySelector('.adm-settings-form');await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(writes[0].body.autoApprove,false);assert.equal(document.querySelector('.adm-save-bar button[type=submit]').disabled,true);
  await click([...document.querySelectorAll('.adm-sidebar nav button')].find(b=>b.textContent.startsWith('البلاغات')));
  assert.equal(document.querySelectorAll('.adm-report-card').length,1);
  await click(document.querySelector('.adm-report-card .danger-subtle'));
  assert.ok(document.querySelector('.adm-dialog[open]'));assert.equal(writes.filter(w=>w.body.action==='delete').length,0,'Opening confirmation must not delete.');
  await click(document.querySelector('.adm-dialog-buttons .danger'));
  assert.equal(writes.filter(w=>w.body.action==='delete').length,1);assert.equal(reports.length,0);
  await click(nav('المحذوفات'));assert.equal(document.querySelectorAll('.adm-code-row').length,1);
  await click(document.querySelector('.adm-code-row .adm-approve-mini'));
  assert.equal(rows[0].status,'approved');assert.equal(writes.at(-1).body.action,'restore');
 }finally{
  await act(async()=>root.unmount());dom.window.close();globalThis.window=saved.window;globalThis.document=saved.document;if(saved.navigator)Object.defineProperty(globalThis,'navigator',saved.navigator);else delete globalThis.navigator;globalThis.fetch=saved.fetch;globalThis.requestAnimationFrame=saved.raf;globalThis.IS_REACT_ACT_ENVIRONMENT=saved.act;delete globalThis.__adminFixtureClient;
 }
});

test('settings preserve unsaved edits when a newer remote revision arrives',async()=>{
 const {default:SettingsEditor}=await compile('../components/settings-editor.tsx');
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://127.0.0.1:3000/admin'});
 const saved={window:globalThis.window,document:globalThis.document,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),raf:globalThis.requestAnimationFrame,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.requestAnimationFrame=fn=>{fn(0);return 1;};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 const initial=defaultSettings();const props={saving:false,onSave:async()=>{},onReload:()=>{}};
 try{
  await act(async()=>root.render(React.createElement(SettingsEditor,{...props,value:initial})));
  await act(async()=>document.querySelector('.adm-setting-switch input').click());
  const newer=structuredClone(initial);newer.revision++;newer.content.siteName='اسم محفوظ من جلسة أخرى';
  await act(async()=>root.render(React.createElement(SettingsEditor,{...props,value:newer})));
  assert.equal(document.querySelector('.adm-setting-switch input').checked,false);
  assert.match(document.querySelector('.adm-inline-error').textContent,/جلسة أخرى/);
  await act(async()=>document.querySelector('.adm-save-actions button[type=button]').click());
  assert.equal(document.querySelector('.adm-setting-switch input').checked,true);
  assert.equal(document.querySelector('[data-group=identity] input').value,newer.content.siteName);
  assert.equal(document.querySelector('.adm-save-actions button[type=submit]').disabled,true);
 }finally{
  await act(async()=>root.unmount());dom.window.close();globalThis.window=saved.window;globalThis.document=saved.document;if(saved.navigator)Object.defineProperty(globalThis,'navigator',saved.navigator);else delete globalThis.navigator;globalThis.requestAnimationFrame=saved.raf;globalThis.IS_REACT_ACT_ENVIRONMENT=saved.act;
 }
});
