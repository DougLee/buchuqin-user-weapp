import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const script = fs.readFileSync(new URL('../src/pages/category/index.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
const ast = ts.createSourceFile('category.ts', script, ts.ScriptTarget.Latest, true);
const loader = ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'loadNight').getText(ast);
test('切楼后请求失败不混用新店ID与旧楼商品/营业态', async () => {
  const state = Object.fromEntries(['loading', 'error', 'nightNoAddress', 'nightMissing', 'renderSegs', 'sections', 'nightStoreId', 'nightBuildingId', 'nightBuildingName', 'nightOpen', 'nightProducts', 'nightMode'].map(k => [k, { value: undefined }]));
  state.nightStoreId.value = 'store-a'; state.nightBuildingId.value = 'building-a';
  state.nightProducts.value = [{ id: 'product-a' }]; state.nightOpen.value = true; state.nightMode.value = true;
  const current = Object.assign(() => true, { isLatest: () => true }); const exports = {};
  vm.runInNewContext(ts.transpileModule(loader + '\nexport { loadNight };', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    ...state, exports, nightLoadScope: { begin: () => current }, resolveNightBuildingId: async () => 'building-b',
    nightApi: { stores: async () => ({ stores: [{ storeId: 'store-b', buildingId: 'building-b', buildingName: '乙楼' }] }), storeDetail: async () => ({ state: 'open' }), storeProducts: async () => { throw Error('offline'); } },
    nightCart: { refreshProducts() { throw Error('failed request must not update cart'); } },
  });
  await exports.loadNight();
  assert.equal(state.error.value, true); assert.equal(state.nightOpen.value, false);
  assert.equal(state.nightProducts.value.length, 0); assert.equal(state.nightStoreId.value, '');
});
