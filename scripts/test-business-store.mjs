import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function setup() {
  const { createPinia, setActivePinia } = require('pinia');
  setActivePinia(createPinia());
  const storage = new Map([['token', 'a'], ['nightCartOwner', 'a:campus']]);
  const pending = []; const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/stores/business.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, Date, uni: { getStorageSync: k => storage.get(k) }, require: name => name === 'pinia' ? require('pinia') : { nightApi: { entry: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) } } });
  return { store: exports.useBusinessStore(), pending, storage };
}
test('渠道过期读取等待新结果，失败上抛而非返回旧渠道', async () => {
  const { store, pending } = setup();
  const first = store.ensureEntry(); pending[0].resolve({ inNightSession: false }); await first;
  assert.equal((await store.ensureEntry()).inNightSession, false); assert.equal(pending.length, 1);
  store.fetchedAt = 0;
  const next = store.ensureEntry(); pending[1].resolve({ inNightSession: true });
  assert.equal((await next).inNightSession, true);
  store.fetchedAt = 0; const failure = store.ensureEntry(); pending[2].reject(Error('offline'));
  await assert.rejects(failure, /offline/);
});
test('换账号并发请求互不复用，旧响应不能覆盖或清除新请求', async () => {
  const { store, pending, storage } = setup();
  const a = store.ensureEntry(); const rejected = assert.rejects(a, /身份或校区/);
  storage.set('token', 'b'); storage.set('nightCartOwner', 'b:campus'); store.reset();
  const b = store.ensureEntry(); assert.equal(pending.length, 2);
  pending[0].resolve({ inNightSession: false }); await rejected;
  const b2 = store.ensureEntry(); assert.equal(pending.length, 2);
  pending[1].resolve({ inNightSession: true }); await Promise.all([b, b2]);
  assert.equal(store.channel, 'night');
});
