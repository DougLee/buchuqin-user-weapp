import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tick = () => new Promise(setImmediate);
function setup() {
  const { createPinia, setActivePinia } = require('pinia');
  setActivePinia(createPinia());
  const storage = new Map([['token', 'a'], ['nightCartOwner', 'a:campus']]);
  const pending = []; const exports = {};
  let campus = async () => ({ nightEnabled: true }), campusCalls = 0;
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/stores/business.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, Date, uni: { getStorageSync: k => storage.get(k) }, require(name) {
    if (name === 'pinia') return require('pinia');
    if (name === '../api') return { api: { currentCampus: () => { campusCalls++; return campus(); } } };
    if (name === '../api/night') return { nightApi: { entry: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) } };
    throw Error(name);
  } });
  return { store: exports.useBusinessStore(), pending, storage, setCampus: fn => { campus = fn; }, get campusCalls() { return campusCalls; } };
}
test('渠道过期读取等待新结果，失败上抛而非返回旧渠道', async () => {
  const { store, pending } = setup();
  const first = store.ensureEntry(); await tick(); pending[0].resolve({ inNightSession: false }); await first;
  assert.equal((await store.ensureEntry()).inNightSession, false); assert.equal(pending.length, 1);
  store.fetchedAt = 0;
  const next = store.ensureEntry(); await tick(); pending[1].resolve({ inNightSession: true });
  assert.equal((await next).inNightSession, true);
  store.fetchedAt = 0; const failure = store.ensureEntry(); await tick(); pending[2].reject(Error('offline'));
  await assert.rejects(failure, /offline/);
});
test('换账号并发请求互不复用，旧响应不能覆盖或清除新请求', async () => {
  const { store, pending, storage } = setup();
  const a = store.ensureEntry(); const rejected = assert.rejects(a, /身份或校区/); await tick();
  storage.set('token', 'b'); storage.set('nightCartOwner', 'b:campus'); store.reset();
  const b = store.ensureEntry(); await tick(); assert.equal(pending.length, 2);
  pending[0].resolve({ inNightSession: false }); await rejected;
  const b2 = store.ensureEntry(); assert.equal(pending.length, 2);
  pending[1].resolve({ inNightSession: true }); await Promise.all([b, b2]);
  assert.equal(store.channel, 'night');
});
test('服务器明确未开通时直接确定白天，不请求夜宵入口', async () => {
  const f = setup(); f.setCampus(async () => ({ nightEnabled: false }));
  assert.equal((await f.store.refresh()).inNightSession, false);
  assert.equal(f.store.channel, 'day'); assert.equal(f.pending.length, 0);
  await f.store.ensureEntry(); assert.equal(f.campusCalls, 1);
});
test('开通后必须等待夜宵状态，失败或超时不能当成白天', async () => {
  const f = setup(); let settled = false;
  const load = f.store.refresh(); load.finally(() => { settled = true; }).catch(() => {});
  await tick(); assert.equal(settled, false); assert.equal(f.store.entry, null);
  const rejected = assert.rejects(load, /timeout/); f.pending[0].reject(Error('timeout')); await rejected;
  assert.equal(f.store.entry, null);
  const retry = f.store.refresh(); await tick(); f.pending[1].resolve({ inNightSession: true });
  await retry; assert.equal(f.store.channel, 'night');
});
test('校区信息失败或旧API未下发开通字段时，不擅自授权白天渠道', async () => {
  const f = setup(); f.setCampus(async () => { throw Error('campus offline'); });
  await assert.rejects(f.store.refresh(), /campus offline/); assert.equal(f.pending.length, 0);
  f.setCampus(async () => ({})); const next = f.store.refresh(); await tick();
  assert.equal(f.pending.length, 1); const rejected = assert.rejects(next, /entry offline/);
  f.pending[0].reject(Error('entry offline')); await rejected; assert.equal(f.store.entry, null);
});
test('首页强制刷新重新核验开关，开启后不能沿用旧白天，关闭后不再查夜宵', async () => {
  const f = setup(); f.setCampus(async () => ({ nightEnabled: false })); await f.store.refresh();
  f.setCampus(async () => ({ nightEnabled: true })); const opened = f.store.refresh(); await tick();
  f.pending[0].resolve({ inNightSession: true }); await opened; assert.equal(f.store.channel, 'night');
  f.setCampus(async () => ({ nightEnabled: false })); await f.store.refresh();
  assert.equal(f.store.channel, 'day'); assert.equal(f.pending.length, 1);
});
test('校区请求在途换号后不能查询新账号夜宵或覆盖新渠道', async () => {
  const f = setup(); let resolve;
  f.setCampus(() => new Promise(done => { resolve = done; }));
  const old = f.store.refresh(); const rejected = assert.rejects(old, /身份或校区/);
  f.storage.set('token', 'b'); f.storage.set('nightCartOwner', 'b:new-campus'); f.store.reset();
  f.setCampus(async () => ({ nightEnabled: false })); await f.store.refresh();
  resolve({ nightEnabled: true }); await rejected;
  assert.equal(f.pending.length, 0); assert.equal(f.store.channel, 'day');
});
test('并发页面共享本次校区核验，换地址后旧夜宵响应失效', async () => {
  const f = setup(), first = f.store.refresh(), same = f.store.ensureEntry(); await tick();
  assert.equal(f.campusCalls, 1); assert.equal(f.pending.length, 1);
  const rejected = Promise.all([assert.rejects(first, /身份或校区/), assert.rejects(same, /身份或校区/)]);
  f.storage.set('selectedAddressId', 'new-address');
  f.pending[0].resolve({ inNightSession: true }); await rejected; assert.equal(f.store.entry, null);
});
