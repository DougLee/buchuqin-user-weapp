import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), pinia = require('pinia');
const compile = file => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function setup() {
  pinia.setActivePinia(pinia.createPinia());
  const storage = new Map([['token', 'session-a']]), profiles = [], entries = [];
  const uni = { getStorageSync: key => storage.get(key) || '', setStorageSync: (key, value) => storage.set(key, value) };
  const businessExports = {};
  vm.runInNewContext(compile('../src/stores/business.ts'), { exports: businessExports, uni, Date, Promise, require(name) {
    if (name === 'pinia') return pinia;
    if (name === '../api/night') return { nightApi: { entry: () => new Promise(resolve => entries.push(resolve)) } };
    throw Error(name);
  } });
  const business = businessExports.useBusinessStore(), sessionExports = {};
  vm.runInNewContext(compile('../src/stores/session.ts'), { exports: sessionExports, uni, Date, Promise, require(name) {
    if (name === 'pinia') return pinia;
    if (name === '../api') return { api: { profile: () => new Promise((resolve, reject) => profiles.push(Object.assign(resolve, { reject }))) } };
    if (name === './business') return { useBusinessStore: () => business };
    if (name === './campus') return { useCampusStore: () => ({ $reset() {} }) };
    if (name === './nightCart') return { useNightCartStore: () => ({ setOwner: (id, campusId) => storage.set('nightCartOwner', `${id}:${campusId}`) }) };
    if (name === './cart') return { useCartStore: () => ({ setOwner() {} }) };
    if (name === '../utils/authSession') return { registerAuthSession() {} };
    if (name === '../api/request' || name === '../utils/bootCampus') return {};
    throw Error(name);
  } });
  return { storage, profiles, entries, business, session: sessionExports.useSessionStore() };
}
const user = { id: 'user-a', campusId: 'campus-a', nickname: '用户甲', phone: '13800000001' };

test('App和首页同时恢复缓存登录，只请求一次资料，不重复使夜宵渠道失效', async () => {
  const f = setup(), pending = [f.session.ensureLogin(), f.session.ensureLogin(), f.session.ensureLogin()];
  for (const resolve of f.profiles) resolve(user);
  await Promise.all(pending);
  assert.equal(f.profiles.length, 1);
  assert.equal(f.session.ready, true);
  assert.equal(f.session.user.id, user.id);
});

test('同一用户更新昵称，不打断正在加载的夜宵入口；换校区仍使旧请求失效', async () => {
  const f = setup(); f.session.applyUser(user);
  const entry = f.business.refresh();
  f.session.applyUser({ ...user, nickname: '新昵称' });
  f.entries[0]({ inNightSession: true });
  assert.equal((await entry).inNightSession, true);
  const old = f.business.refresh();
  f.session.applyUser({ ...user, campusId: 'campus-b' });
  f.entries[1]({ inNightSession: true });
  await assert.rejects(old, /身份或校区已变化/);
});

test('缓存资料请求失败后可重新恢复登录，不留下永久等待状态', async () => {
  const f = setup(), pending = f.session.ensureLogin();
  f.profiles[0].reject(new Error('网络异常'));
  await assert.rejects(pending, /网络异常/);
  assert.equal(f.session.user, null); assert.equal(f.session.ready, false);
  const retry = f.session.ensureLogin(); f.profiles[1](user); await retry;
  assert.equal(f.session.user.id, user.id);
});
