import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(fs.readFileSync(new URL('../src/api/request.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function fixture() {
  let token = 'owner-a-campus-a', callback, removals = 0;
  const exports = {};
  vm.runInNewContext(source, { exports, require(name) {
    if (name === '../stores/session') return { useSessionStore: () => ({ applyUser() {} }) };
    if (name === './base') return { BASE_URL: 'http://localhost/api/v1' };
    if (name === '../config/app') return { WECHAT_APP_ID: 'wx-test' };
    if (name === '../utils/bootCampus') return {};
    throw Error(name);
  }, uni: { getStorageSync: () => token, setStorageSync: (_key, value) => { token = value; }, removeStorageSync: () => { removals++; token = ''; }, showToast() {}, request(options) { callback = options; } } });
  return { request: exports.request, switchOwner() { token = 'owner-b-campus-b'; }, get token() { return token; }, get removals() { return removals; }, reply(status = 200) { callback.success({ statusCode: status, data: { code: 0, data: { campusId: 'campus-a' } } }); } };
}
test('账号或校区切换后，旧成功响应不能再交给页面或store', async () => {
  const client = fixture(), pending = client.request('/night/entry');
  await new Promise(setImmediate); client.switchOwner(); client.reply();
  await assert.rejects(pending, /身份或校区已变化/);
});
test('旧401响应不能清掉后来登录的新身份令牌', async () => {
  const client = fixture(), pending = client.request('/profile');
  await new Promise(setImmediate); client.switchOwner(); client.reply(401);
  await assert.rejects(pending, /身份或校区已变化/);
  assert.equal(client.token, 'owner-b-campus-b'); assert.equal(client.removals, 0);
});
test('上下文不变时正常解包响应', async () => {
  const client = fixture(), pending = client.request('/night/entry');
  await new Promise(setImmediate); client.reply();
  assert.equal((await pending).campusId, 'campus-a');
});
