import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const raw = fs.readFileSync(new URL('../src/pages/night/product-detail.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
function setup({ open = true, seckill = 'sale-a', routeSale = '', rows } = {}) {
  const hooks = {}, writes = [], toasts = [], exports = {};
  const storage = new Map([['token', 'a'], ['nightCartOwner', 'a:c']]);
  const product = { id: 'p', name: '夜宵', price: 800, stock: 3, soldOut: false, seckill: { id: seckill, price: 500, endsAt: '2099-01-01' } };
  const session = { needsPhone: false, ensureLogin: async () => {} };
  const cart = { quantityOf: () => 0, setQuantity: (...args) => writes.push(args), linesOf: () => [] };
  const context = { exports, Date, setInterval: () => 1, clearInterval() {}, uni: { getStorageSync: k => storage.get(k), showToast: x => toasts.push(x.title) }, require(name) {
    if (name.endsWith('/visibleNow')) return { useVisibleNow: () => ({ value: Date.now() }) };
    if (name === 'vue') return { ref: value => ({ value }), computed: fn => ({ get value() { return fn(); } }), onUnmounted() {} };
    if (name === '@dcloudio/uni-app') return Object.fromEntries(['onLoad', 'onShow', 'onHide', 'onShareAppMessage', 'onShareTimeline'].map(k => [k, cb => { hooks[k] = cb; }]));
    if (name.endsWith('/api/night')) return { nightApi: { storeDetail: async () => ({ state: open ? 'open' : 'resting', buildingId: 'server-building' }), storeProducts: () => rows ? rows() : Promise.resolve([product]) } };
    if (name.endsWith('/stores/nightCart')) return { useNightCartStore: () => cart };
    if (name.endsWith('/stores/session')) return { useSessionStore: () => session };
    if (name.endsWith('/businessContext')) {
      const exports = {};
      const code = ts.transpileModule(fs.readFileSync(new URL('../src/utils/businessContext.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
      vm.runInNewContext(code, { exports, uni: context.uni, require: () => ({}) });
      return exports;
    }
    return { track() {}, fenToYuan: x => x / 100 };
  } };
  const code = ts.transpileModule(raw + '\nexport { load, add, product, storeOpen, price, error, loading };', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, context);
  hooks.onLoad({ storeId: 's', id: 'p', buildingId: 'untrusted', promotionId: routeSale });
  return { ...exports, hooks, writes, toasts, storage };
}
test('详情读取真实营业状态，营业店可加购并使用服务端楼栋', async () => {
  const s = setup(); await s.load(); await s.add();
  assert.equal(s.writes.length, 1); assert.equal(s.writes[0][0].buildingId, 'server-building');
});
test('休息店不可加购，普通入口保持普通价', async () => {
  const s = setup({ open: false }); await s.load(); await s.add();
  assert.equal(s.price.value, 800); assert.equal(s.writes.length, 0);
});
test('秒杀详情保持原活动身份和价格，活动更替不能静默改成原价加购', async () => {
  const s = setup({ routeSale: 'sale-a' }); await s.load(); await s.add();
  assert.equal(s.price.value, 500); assert.equal(s.writes[0][1].asSeckill, true);
  const old = setup({ routeSale: 'old-sale' }); await old.load(); await old.add();
  assert.equal(old.error.value, true); assert.equal(old.writes.length, 0);
});
test('离开页面后旧详情响应不能恢复可加购状态', async () => {
  let finish;
  const s = setup({ rows: () => new Promise(r => { finish = r; }) });
  const request = s.load(); await new Promise(resolve => setImmediate(resolve));
  s.hooks.onHide(); finish([{ id: 'p', price: 1, stock: 2 }]); await request;
  assert.equal(s.product.value, undefined); assert.equal(s.storeOpen.value, false);
});

test('请求中登录续期丢弃旧响应时显示可重试错误，不永久停留骨架', async () => {
  let finish;
  const s = setup({ rows: () => new Promise(r => { finish = r; }) });
  const request = s.load(); await new Promise(resolve => setImmediate(resolve));
  s.storage.set('token', 'renewed'); finish([{ id: 'p', price: 1, stock: 2 }]); await request;
  assert.equal(s.loading.value, false); assert.equal(s.error.value, true);
  assert.equal(s.product.value, undefined); await s.add(); assert.equal(s.writes.length, 0);
});
