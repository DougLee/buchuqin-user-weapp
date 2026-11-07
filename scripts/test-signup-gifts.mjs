import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/utils/signupGifts.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { usableSignupGifts, scopedUiKey } = exports;
test('新人礼包仅展示本渠道返回的有效注册券，过期/锁定/已用/手领券不混入', () => {
  const base = { id: 'signup', status: 'claimed', coupon: { name: '新人券', trigger: 'signup', amount: 100, threshold: 0, expiresAt: null } };
  const rows = [base, { ...base, id: 'locked', status: 'locked' }, { ...base, id: 'expired', coupon: { ...base.coupon, expiresAt: '2001-01-01T00:00:00Z' } }, { ...base, id: 'manual', coupon: { ...base.coupon, trigger: 'manual' } }];
  assert.deepEqual(Array.from(usableSignupGifts(rows).map(row => row.id)), ['signup']);
});
test('礼包/群提示偏好按用户校区隔离，礼包额外按日夜隔离', () => {
  assert.notEqual(scopedUiKey('gift', 'a', 'c', 'day'), scopedUiKey('gift', 'a', 'c', 'night'));
  assert.notEqual(scopedUiKey('group', 'a', 'c'), scopedUiKey('group', 'b', 'c'));
  assert.notEqual(scopedUiKey('group', 'a', 'c'), scopedUiKey('group', 'a', 'd'));
  assert.equal(scopedUiKey('gift'), '');
});
