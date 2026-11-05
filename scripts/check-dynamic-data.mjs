// Connected, reversible integration check. Creates only uniquely tagged QA codes and removes those rows in finally.
import{createClient}from'@supabase/supabase-js';import{randomBytes}from'node:crypto';import{readFile,mkdir,writeFile}from'node:fs/promises';import assert from'node:assert/strict';
process.loadEnvFile(new URL('../.env.local',import.meta.url));
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const base=process.env.CHECK_BASE_URL||'http://127.0.0.1:3000';
const{data:original,error}=await db.from('site_settings').select('*').eq('id',1).single();if(error)throw new Error('Settings unavailable: '+error.code);
const backupDir=new URL('../.local-backups/',import.meta.url);await mkdir(backupDir,{recursive:true,mode:0o700});await writeFile(new URL('settings-before-integration.json',backupDir),JSON.stringify(original,null,2),{mode:0o600});
const owned=[];let expectedRevision=Number(original.revision);let changedAuto=false;
async function setAuto(value){const{data,error}=await db.from('site_settings').update({auto_approve:value}).eq('id',1).eq('revision',expectedRevision).select('revision').single();if(error)throw new Error('Concurrent settings change; stop to avoid overwriting owner edits.');expectedRevision=Number(data.revision);changedAuto=true;}
async function newCode(){for(let i=0;i<10;i++){const code='NG-QA'+randomBytes(3).toString('hex');const{data,error}=await db.from('codes').select('id').eq('code',code).maybeSingle();if(error)throw new Error('Code check failed');if(!data)return code;}throw new Error('Could not generate test code');}
async function submit(code){const{data,error}=await db.rpc('submit_public_code',{p_code:code});assert.equal(error,null);const row=await db.from('codes').select('id,status').eq('code',code).single();assert.equal(row.error,null);owned.push({id:row.data.id,code});return{...row.data,result:data};}
async function publicData(){const response=await fetch(base+'/api/codes',{cache:'no-store'});assert.equal(response.status,200);return{data:await response.json(),etag:response.headers.get('etag')};}
try{
 assert.equal(original.submissions_enabled,true,'Public submissions must be enabled for this integration check.');
 await setAuto(true);const code=await newCode();const created=await submit(code);assert.equal(created.status,'approved');assert.equal(created.result.status,'approved');
 const first=await publicData();assert.ok(first.data.codes.some(c=>c.code===code));
 const unchanged=await fetch(base+'/api/codes',{headers:{'If-None-Match':first.etag},cache:'no-store'});assert.equal(unchanged.status,304);
 const report=await db.from('reports').insert({code,reason:'not_working',reporter_hash:randomBytes(32).toString('hex')}).select('id').single();assert.equal(report.error,null);
 let op=await db.rpc('moderate_code',{p_id:created.id,p_action:'delete',p_code:null});assert.equal(op.error,null);assert.equal(op.data,true);
 const removed=await publicData();assert.ok(!removed.data.codes.some(c=>c.code===code));assert.notEqual(removed.etag,first.etag);
 const resolved=await db.from('reports').select('resolved').eq('id',report.data.id).single();assert.equal(resolved.data.resolved,true);
 const duplicate=await db.rpc('submit_public_code',{p_code:code});assert.equal(duplicate.data.result,'duplicate');const stillDeleted=await db.from('codes').select('status').eq('id',created.id).single();assert.equal(stillDeleted.data.status,'deleted');
 op=await db.rpc('moderate_code',{p_id:created.id,p_action:'restore',p_code:null});assert.equal(op.error,null);assert.ok((await publicData()).data.codes.some(c=>c.code===code));
 await setAuto(false);const pendingCode=await newCode();const pending=await submit(pendingCode);assert.equal(pending.status,'pending');assert.ok(!(await publicData()).data.codes.some(c=>c.code===pendingCode));
 const rejected=await db.rpc('moderate_code',{p_id:pending.id,p_action:'reject',p_code:null});assert.equal(rejected.error,null);
 console.log('PASS: default/policy selection, immediate publish, pending when disabled, no static resurrection, restore, duplicate protection, report resolution and ETag invalidation.');
}finally{
 for(const row of owned){await db.from('reports').delete().eq('code',row.code);await db.from('codes').delete().eq('id',row.id).eq('code',row.code);}
 if(changedAuto){const{error}=await db.from('site_settings').update({auto_approve:original.auto_approve}).eq('id',1).eq('revision',expectedRevision);if(error)console.error('Could not restore auto-approval; inspect settings.');}
 console.log('QA-only rows removed; original code rows preserved.');
}
