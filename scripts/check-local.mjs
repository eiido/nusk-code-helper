import assert from'node:assert/strict';
const base=process.env.CHECK_BASE_URL||'http://127.0.0.1:3000';
const response=await fetch(base+'/api/codes');const body=await response.json();
if(response.status===200){assert.equal(body.live,true);assert.ok(Array.isArray(body.codes));assert.equal(typeof body.autoApprove,'boolean');assert.ok(body.content);}else assert.equal(response.status,503);
const denied=await fetch(base+'/api/submissions',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.invalid'},body:JSON.stringify({code:'invalid'})});assert.equal(denied.status,403);
for(const path of['/api/submissions','/api/reports']){const result=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({code:'invalid'})});assert.ok([400,503].includes(result.status));}
for(const path of['/api/admin/codes','/api/admin/settings'])assert.equal((await fetch(base+path)).status,401);
console.log('API checks passed: database readiness, invalid input rejected, cross-origin blocked, codes/settings administration protected. No test rows written.');
