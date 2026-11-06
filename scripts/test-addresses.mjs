import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compiled = ts.transpileModule(fs.readFileSync(new URL('../src/api/addresses.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function client(request) {
  const exports = {};
  vm.runInNewContext(compiled, { exports, require(name) { if (name === './request') return { request }; throw new Error(name); } });
  return exports.fetchAddresses;
}
test('地址管理与夜宵结算均能选择超过首屏的旧地址，尊重服务端分页大小', async () => {
  const addresses = Array.from({ length: 121 }, (_, i) => ({ id: `address-${i}`, buildingId: i === 120 ? 'own-building' : 'another-building' }));
  const fetchAll = client(async route => { const page = Number(new URL(route, 'http://localhost').searchParams.get('page')); return { items: addresses.slice((page - 1) * 50, page * 50), pageSize: 50, total: 121 }; });
  const result = await fetchAll();
  assert.equal(result.length, 121); assert.equal(result.filter(row => row.buildingId === 'own-building')[0].id, 'address-120');
});
test('地址后续页加载失败不能伪装成完整列表或无本楼地址', async () => {
  let count = 0;
  const fetchAll = client(async () => { if (++count === 2) throw new Error('离线'); return { items: [{ id: 'first' }], pageSize: 1, total: 2 }; });
  await assert.rejects(fetchAll(), /离线/);
});
