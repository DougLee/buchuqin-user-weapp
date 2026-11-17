import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const script = fs.readFileSync(new URL('../src/pages/index/index.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
const ast = ts.createSourceFile('home.ts', script, ts.ScriptTarget.Latest, true);
const loaders = ast.statements.filter(s => ts.isFunctionDeclaration(s) && ['loadHome', 'clearHomeData'].includes(s.name?.text)).map(s => s.getText(ast)).join('\n');
const storeSource = fs.readFileSync(new URL('../src/stores/business.ts', import.meta.url), 'utf8');
const tick = () => new Promise(setImmediate);
function setup(enabled = false) {
  const { createPinia, setActivePinia } = require('pinia'); setActivePinia(createPinia());
  const storage = new Map([['token', 'buyer'], ['nightCartOwner', 'buyer:campus'], ['selectedAddressId', 'address']]);
  const uni = { getStorageSync: key => storage.get(key) || '' }, channels = [];
  let campus = async () => ({ nightEnabled: enabled }), entry = async () => ({ inNightSession: true }), nightCalls = 0;
  const api = {
    currentCampus: () => campus(),
    home: async channel => { channels.push(channel); return { campus: { name: '当前校区' }, notice: '', hotProducts: [{ id: channel + '-product' }], banners: [], categories: [] }; },
  };
  const nightApi = { entry: () => { nightCalls++; return entry(); }, addresses: async () => [{ id: 'address', buildingId: 'building' }] };
  const storeExports = {};
  vm.runInNewContext(compile(storeSource), { exports: storeExports, Date, uni, require(name) {
    if (name === 'pinia') return require('pinia');
    if (name === '../api') return { api };
    if (name === '../api/night') return { nightApi };
    throw Error(name);
  } });
  const state = Object.fromEntries(['products', 'banners', 'promotions', 'categories', 'nightProducts', 'signupCoupons'].map(key => [key, { value: [] }]));
  for (const key of ['nightStoreId', 'nightBuildingId', 'campus', 'notice', 'keyword']) state[key] = { value: '' };
  for (const key of ['nightMode', 'signupLoaded', 'homeError', 'loading', 'giftOpen']) state[key] = { value: false };
  state.defaultAddress = { value: null }; state.nightDetail = { value: undefined };
  const exports = {};
  vm.runInNewContext(compile('let homeGeneration = 0, homeOwner = "";\n' + loaders + '\nexport { loadHome };'), {
    exports, ...state, api, nightApi, uni, businessStore: storeExports.useBusinessStore(),
    nightCardMap: new Map(), closeHomeOverlays() {},
    useSessionStore: () => ({ ensureLogin: async () => {} }),
    pickCurrentAddress: addresses => addresses[0], resolveNightBuildingId: async () => 'building',
    loadNightStore: async () => { state.nightStoreId.value = 'night-store'; },
    campusStore: { apply() {} }, cart: { load: async () => {} },
    loadHomeBlocks: async () => {}, maybeShowWelcomeGift() {}, maybeShowGroupAd() {},
    setTimeout() {}, measureCategoryOverflow() {},
  });
  return { load: exports.loadHome, state, channels, storage, get nightCalls() { return nightCalls; }, setCampus: fn => { campus = fn; }, setEntry: fn => { entry = fn; } };
}

test('未开通首页无需等待夜宵接口即可加载白天商品和地址', async () => {
  const f = setup(); f.setEntry(() => new Promise(() => {}));
  await f.load();
  assert.equal(f.nightCalls, 0); assert.deepEqual(f.channels, ['day']);
  assert.equal(f.state.products.value[0].id, 'day-product');
  assert.equal(f.state.defaultAddress.value.id, 'address');
  assert.equal(f.state.homeError.value, false); assert.equal(f.state.loading.value, false);
});
test('开通校区等待夜宵核验，正常营业只加载夜宵商品', async () => {
  const f = setup(true); let resolve;
  f.setEntry(() => new Promise(done => { resolve = done; }));
  const loading = f.load(); await tick();
  assert.deepEqual(f.channels, []); assert.equal(f.state.loading.value, true);
  resolve({ inNightSession: true }); await loading;
  assert.deepEqual(f.channels, ['night']); assert.equal(f.state.nightMode.value, true);
  assert.equal(f.state.products.value[0].id, 'night-product'); assert.equal(f.state.homeError.value, false);
});
test('夜宵已开通但核验超时：首次加载提供重试，不展示白天商品', async () => {
  const f = setup(true); f.setEntry(async () => { throw Error('timeout'); }); await f.load();
  assert.deepEqual(f.channels, []); assert.equal(f.state.products.value.length, 0);
  assert.equal(f.state.homeError.value, true); assert.equal(f.state.loading.value, false);
  f.setEntry(async () => ({ inNightSession: true })); await f.load();
  assert.deepEqual(f.channels, ['night']); assert.equal(f.state.homeError.value, false);
});
test('夜场刷新失败保留原数据供恢复，不以白天覆盖；关闭后重新加载白天', async () => {
  const f = setup(true); await f.load();
  f.setEntry(async () => { throw Error('offline'); }); await f.load();
  assert.deepEqual(f.channels, ['night']); assert.equal(f.state.products.value[0].id, 'night-product');
  assert.equal(f.state.nightMode.value, true); assert.equal(f.state.homeError.value, true);
  f.setCampus(async () => ({ nightEnabled: false })); await f.load();
  assert.deepEqual(f.channels, ['night', 'day']); assert.equal(f.state.products.value[0].id, 'day-product');
  assert.equal(f.state.nightMode.value, false); assert.equal(f.state.nightStoreId.value, '');
  assert.equal(f.state.homeError.value, false);
});
test('校区状态未知不能猜成未开通；切号晚到响应也不能加载商品', async () => {
  const f = setup(); f.setCampus(async () => { throw Error('campus unavailable'); });
  await f.load(); assert.deepEqual(f.channels, []); assert.equal(f.state.homeError.value, true);
  let resolve; f.setCampus(() => new Promise(done => { resolve = done; }));
  const old = f.load(); await tick(); f.storage.set('token', 'other-user');
  resolve({ nightEnabled: false }); await old;
  assert.deepEqual(f.channels, []); assert.equal(f.nightCalls, 0);
});
