import{test}from'node:test';import assert from'node:assert/strict';import{build}from'esbuild';import{createRequire}from'node:module';import React,{act}from'react';import{renderToString}from'react-dom/server';import{JSDOM}from'jsdom';
const compiled=await build({entryPoints:[new URL('../app/layout.tsx',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'},jsx:'automatic'});
const mod={exports:{}};const require=createRequire(import.meta.url);new Function('require','module','exports',compiled.outputFiles[0].text)(require,mod,mod.exports);const Layout=mod.exports.default;
test('body-only hydration escape hatch handles injected extension attributes without hiding child mismatches',async()=>{
 const originalWindow=globalThis.window,originalDocument=globalThis.document,originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),originalAct=globalThis.IS_REACT_ACT_ENVIRONMENT;
 const errors=[],recoveries=[];const originalError=console.error;console.error=(...args)=>errors.push(args.map(String).join(' '));
 async function scenario(mismatch){
  const ssr=renderToString(React.createElement(Layout,null,React.createElement('div',null,'server content')));
  const dom=new JSDOM('<!doctype html>'+ssr,{url:'http://127.0.0.1:3000/admin'});dom.window.document.body.setAttribute('location','127.0.0.1');
  globalThis.window=dom.window;globalThis.document=dom.window.document;Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const{hydrateRoot}=await import('react-dom/client');let root;
  await act(async()=>{root=hydrateRoot(dom.window.document,React.createElement(Layout,null,React.createElement('div',null,mismatch?'different client content':'server content')),{onRecoverableError:error=>recoveries.push(error.message)});});
  await act(async()=>root.unmount());dom.window.close();
 }
 try{
  await scenario(false);assert.equal(errors.filter(e=>/hydrated|hydration|didn.t match/i.test(e)).length,0);assert.equal(recoveries.length,0);
  await scenario(true);assert.ok(recoveries.some(e=>/didn.t match|Hydration failed/i.test(e)),'A real child mismatch must remain detectable.');
 }finally{console.error=originalError;globalThis.window=originalWindow;globalThis.document=originalDocument;if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;globalThis.IS_REACT_ACT_ENVIRONMENT=originalAct;}
});
