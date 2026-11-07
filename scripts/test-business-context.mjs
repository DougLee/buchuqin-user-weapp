import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(fs.readFileSync(new URL('../src/utils/businessContext.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
const storage = new Map();
vm.runInNewContext(source, { exports, require: () => ({ nightApi: { entry() { throw Error('not used'); } } }), uni: { getStorageSync: key => storage.get(key) || '', setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key) } });
const { createBusinessResolver } = exports;
test('当前营业上下文决定渠道，已关闭场次回到白天，历史渠道可显式指定', async () => {
  let night = true;
  const resolve = createBusinessResolver({ identity: () => 'user:campus', entry: async () => ({ inNightSession: night }) });
  assert.equal(await resolve(), 'night'); night = false; assert.equal(await resolve(), 'day');
  assert.equal(await resolve('night'), 'night'); assert.equal(await resolve('day'), 'day');
});
test('网络失败不能解释成白天，非法业务类型不能默默落入另一渠道', async () => {
  const resolve = createBusinessResolver({ identity: () => 'user:campus', entry: async () => { throw Error('offline'); } });
  await assert.rejects(resolve(), /offline/); await assert.rejects(resolve('other'), /业务类型/);
});
test('校区或账号在请求中变化时拒绝旧响应，不把旧渠道结果显示给新身份', async () => {
  let owner = 'user-a:campus-a', finish;
  const resolve = createBusinessResolver({ identity: () => owner, entry: () => new Promise(r => { finish = r; }) });
  const pending = resolve(); owner = 'user-b:campus-b'; finish({ inNightSession: true });
  await assert.rejects(pending, /身份或校区已变化/);
});

test('楼栋记忆跟随用户与校区，清除当前选择不影响其他作用域', () => {
  storage.set('nightCartOwner', 'buyer:campus-a');
  exports.rememberNightBuilding('building-a');
  storage.set('nightCartOwner', 'buyer:campus-b');
  assert.equal(exports.readNightBuilding(), '');
  exports.rememberNightBuilding('building-b');
  exports.clearNightBuilding();
  storage.set('nightCartOwner', 'buyer:campus-a');
  assert.equal(exports.readNightBuilding(), 'building-a');
});

test('旧楼栋请求返回无店时，不能清除新校区的楼栋记忆', async () => {
  storage.set('token', 'token-a'); storage.set('nightCartOwner', 'buyer:campus-a'); exports.rememberNightBuilding('building-a');
  const scope = exports.createBusinessRequestScope(); const current = scope.begin();
  let finish;
  const old = new Promise(resolve => { finish = resolve; }).then(() => { if (current()) exports.clearNightBuilding(); });
  storage.set('token', 'token-b'); storage.set('nightCartOwner', 'buyer:campus-b'); exports.rememberNightBuilding('building-b');
  finish(); await old;
  assert.equal(exports.readNightBuilding(), 'building-b');
});
