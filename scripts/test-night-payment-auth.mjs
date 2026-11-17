import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function harness() {
  const events = [], exports = {}; let lookups = 0;
  const nightApi = { payStatus: async () => { events.push('lookup'); return { paid: ++lookups > 1, status: 'pending-payment' }; }, prepay: async () => { events.push('prepay'); return { payParams: { appId: 'wx-test' } }; }, order: async () => ({ items: [] }) };
  const source = fs.readFileSync(new URL('../src/utils/nightPayment.ts', import.meta.url), 'utf8').replaceAll('import.meta.env.DEV','false').replaceAll('import.meta.env.VITE_NIGHT_LOCAL_PREVIEW', "'false'");
  vm.runInNewContext(ts.transpileModule(source,{ compilerOptions:{ module:ts.ModuleKind.CommonJS } }).outputText, { exports, require(name) { if(name==='./payment')return { requestSubscribeAuth:()=>events.push('auth') }; if(name.includes('api/night'))return {nightApi}; if(name.includes('stores/nightCart'))return {useNightCartStore:()=>({consumeOrder(){events.push('consume');}})}; throw Error(name); }, uni:{ requestPayment(options){events.push('payment');options.success();} } });
  return { exports, events };
}
test('夜单续付在任何网络等待前请求订阅授权，支付保持原流程',async()=>{ const h=harness();assert.equal(await h.exports.startNightPayFlow('night','store'),true);assert.equal(h.events[0],'auth');assert.ok(h.events.includes('payment') && h.events.includes('consume')); });
test('结算按钮已在同步手势内授权时，支付辅助不重复弹授权',async()=>{ const h=harness();assert.equal(await h.exports.startNightPayFlow('night','store',false),true);assert.ok(!h.events.includes('auth')); });
