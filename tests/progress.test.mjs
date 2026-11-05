import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeProgress, extractCode, freshProgress, mergeProgress, nextPending } from '../lib/progress.ts';
const a='NG-AbCd1234', b='NG-efgh5678', c='NG-IJKL9012';
test('extract one complete case-sensitive code without accepting trailing garbage or ambiguous messages',()=>{
  assert.equal(extractCode('رابط https://services.nusuk.sa/app?p=27&id='+a+' وشاركنا'),a);
  assert.equal(extractCode(a+' '+a),a);
  assert.equal(extractCode(a+' '+b),null);
  assert.equal(extractCode(a+'Z'),null);
  assert.equal(extractCode('XX'+a),null);
  assert.equal(extractCode('ng-AbCd1234'),null);
});
test('old v2 exports migrate copied state without claiming used status',()=>{
  const p=decodeProgress({format:'nusuk-progress',version:2,copied:[a,b],lastCode:b});
  assert.equal(p.states[a],'copied');assert.equal(p.states[b],'copied');assert.equal(p.current,null);
});
test('next pending wraps, skips all marked states, and returns null when finished',()=>{
  const p=freshProgress();p.states[a]='used';p.states[b]='skipped';
  assert.equal(nextPending([a,b,c],p,a),c);
  assert.equal(nextPending([a,b,c],p,c),c);
  p.states[c]='copied';assert.equal(nextPending([a,b,c],p),null);
});
test('import merges by code identity regardless of list order and retains local current code',()=>{
  const p={...freshProgress(),current:a,states:{[a]:'used'}};
  const q={...freshProgress(),current:b,states:{[b]:'copied'}};
  const merged=mergeProgress(p,q);
  assert.equal(merged.current,a);assert.equal(merged.states[a],'used');assert.equal(merged.states[b],'copied');
  assert.equal(nextPending([c,b,a],merged),c);
});
test('reject malicious or invalid backup states before writing local progress',()=>{
  for(const invalid of [null,[],{format:'other'}, {...freshProgress(),states:{[a]:'winner'}},{...freshProgress(),states:JSON.parse('{"__proto__":"used"}')},{...freshProgress(),lastSeenAt:'bad-date'},{...freshProgress(),current:'javascript:alert(1)'}]){
    assert.throws(()=>decodeProgress(invalid));
  }
  assert.deepEqual(decodeProgress(freshProgress()),freshProgress());
});
