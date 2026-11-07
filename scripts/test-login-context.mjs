import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const raw = fs.readFileSync(new URL('../src/api/request.ts', import.meta.url), 'utf8');
const active = [true];
const mpSource = raw.split('\n').filter(line => {
  const start = line.match(/\/\/\s*#(ifdef|ifndef)\s+(\S+)/);
  if (start) { const match = start[2] === 'MP-WEIXIN'; active.push(active.at(-1) && (start[1] === 'ifdef' ? match : !match)); return false; }
  if (/\/\/\s*#endif/.test(line)) { active.pop(); return false; }
  return active.at(-1);
}).join('\n');
const compiled = ts.transpileModule(mpSource, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
function fixture(resolveCampus) {
  let token = '', loginCallback; const requests = [], applied = []; const exports = {};
  const state = { setToken(value) { token = value; }, replyLogin(value, user = { id: 'auto-user', campusId: 'campus', nickname: '自动登录用户' }) { loginCallback({ statusCode: 200, data: { code: 0, data: { token: value, user } } }); } };
  vm.runInNewContext(compiled, { exports, require(name) {
    if (name === '../utils/authSession') return { applyAuthenticatedUser(user) { applied.push(user); } };
    if (name === './base') return { BASE_URL: 'http://localhost/api/v1' };
    if (name === '../config/app') return { WECHAT_APP_ID: 'wx-test' };
    if (name === '../utils/bootCampus') return { resolveLoginCampus: () => resolveCampus(state), readSharedCampusId: () => '' };
    throw Error(name);
  }, uni: { getStorageSync: () => token, setStorageSync: (_key, value) => { token = value; }, removeStorageSync: () => { token = ''; }, showToast() {}, login({ success }) { success({ code: 'memory-only-code' }); }, request(options) {
    requests.push(options.url);
    if (options.url.endsWith('/auth/wechat-login')) loginCallback = options.success;
    else options.success({ statusCode: 200, data: { code: 0, data: { ok: true } } });
  } } });
  return { request: exports.request, state, requests, applied, get token() { return token; } };
}
test('校区确认页先存本次合法token再解除等待，挂起原请求应直接继续', async () => {
  const client = fixture(async state => { state.setToken('confirmed-campus-token'); return 'campus'; });
  assert.equal((await client.request('/profile')).ok, true);
  assert.equal(client.token, 'confirmed-campus-token');
  assert.equal(client.requests.length, 1); assert.ok(client.requests[0].endsWith('/profile'));
});
test('真正的旧微信登录返回不能覆盖后来登录的新身份', async () => {
  const client = fixture(async () => 'campus');
  const pending = client.request('/profile');
  await new Promise(setImmediate);
  client.state.setToken('newer-user-token'); client.state.replyLogin('old-login-result');
  await assert.rejects(pending, /身份或校区已变化/);
  assert.equal(client.token, 'newer-user-token'); assert.equal(client.applied.length, 0);
});

test('自动登录成功后同步实际用户与校区，购物车owner不会继续用旧身份', async () => {
  const client = fixture(async () => 'campus');
  const pending = client.request('/profile'); await new Promise(setImmediate);
  client.state.replyLogin('fresh-token', { id: 'actual-user', campusId: 'actual-campus', nickname: '新身份' });
  await pending;
  assert.equal(client.applied[0]?.id, 'actual-user'); assert.equal(client.applied[0]?.campusId, 'actual-campus');
});
