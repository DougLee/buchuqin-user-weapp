import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/pages/orders/index.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
function setup() {
  const session = { user: { id: 'a', campusId: 'c' }, ensureLogin: async () => {} }, exports = {}, hooks = {}, requests = [], urls = [], payments = [];
  const storage = new Map([['token', 'a'], ['nightCartOwner', 'a:c']]); let cleared = 0;
  const code = ts.transpileModule(source + '\nexport { load, open, pay, amountLabel, orders, partial, error, page, moreError, nightVisible, channels };', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, Date, uni: { getStorageSync: k => storage.get(k), navigateTo: o => urls.push(o.url), showToast() {}, stopPullDownRefresh() {} }, require(name) {
    if (name === 'vue') return { ref: value => ({ value }), computed: get => ({ get value() { return get(); } }) };
    if (name === '@dcloudio/uni-app') return Object.fromEntries(['onShow','onHide','onReachBottom','onPullDownRefresh'].map(k => [k, cb => { hooks[k] = cb; }]));
    if (name.endsWith('/api')) return { api: { userOrders: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })) } };
    if (name.endsWith('/stores/session')) return { useSessionStore: () => session };
    if (name.endsWith('/stores/cart')) return { useCartStore: () => ({ clearLocal() { cleared++; } }) };
    if (name.endsWith('/utils/payment')) return { startPayFlow: async id => { payments.push(['day',id]); return false; }, preloadPayTemplates() {} };
    if (name.endsWith('/utils/nightPayment')) return { startNightPayFlow: async (id,store) => { payments.push(['night',id,store]); return false; } };
    return { setupDefaultShare() {}, useVisibleNow: () => ({ value: Date.now() }) };
  } });
  return { ...exports, session, storage, hooks, requests, urls, payments, cleared: () => cleared };
}
const tick = () => new Promise(r => setImmediate(r));
const result = (items, total = items.length, errors = [], nightVisible = true) => ({ items, total, page: 1, pageSize: 20, errors, nightVisible });
test('两类同ID订单跳各自原详情，继续支付也分渠道且夜单携带storeId', async () => {
  const s = setup(); const day = { key: 'day:same', id: 'same', businessType: 'day' }, night = { key: 'night:same', id: 'same', businessType: 'night', storeId: 'store' };
  s.open(day); s.open(night); await s.pay(day); await s.pay(night);
  assert.deepEqual(s.payments, [['day','same'],['night','same','store']]);
  assert.deepEqual(s.urls.slice(0,2), ['/pages/orders/detail?id=same','/pages/night/order-detail?id=same']); assert.equal(s.cleared(), 0);
});
test('筛选后旧响应不得覆盖新列表，失败来源明确标记不完整', async () => {
  const s = setup(); const old = s.load('all'); await tick(); const next = s.load('delivering'); await tick();
  s.requests[1].resolve(result([{ key: 'night:n' }], 1, ['day'])); await next; s.requests[0].resolve(result([{ key: 'day:old' }])); await old;
  assert.equal(s.orders.value[0].key,'night:n'); assert.equal(s.partial.value[0],'day');
});
test('加载更多失败重试同页，成功后才推进页码', async () => {
  const s = setup(); const first=s.load(); await tick(); s.requests[0].resolve(result([{key:'day:d'}],3));await first;
  const failed=s.load('all',true);await tick();assert.equal(s.requests[1].args[2],2);s.requests[1].reject(Error('offline'));await failed;assert.equal(s.page.value,1);
  const retry=s.load('all',true);await tick();assert.equal(s.requests[2].args[2],2);s.requests[2].resolve(result([{key:'night:n'}],3));await retry;assert.equal(s.page.value,2);assert.equal(s.orders.value.length,2);
});
test('换账号登录失败清旧数据，离开页面晚响应不能回填', async () => {
  const s=setup();const first=s.load();await tick();s.requests[0].resolve(result([{key:'private-a'}]));await first;
  s.storage.delete('token');s.session.ensureLogin=async()=>{throw Error('login failed');};await s.load();assert.equal(s.orders.value.length,0);assert.equal(s.error.value,true);
  s.storage.set('token','b');s.session.ensureLogin=async()=>{};const next=s.load();await tick();s.hooks.onHide();s.requests[1].resolve(result([{key:'b'}]));await next;assert.equal(s.orders.value.length,0);
});

test('未支付取消订单显示未支付，有paidAt才显示实付', () => {
  const s=setup(); assert.equal(s.amountLabel({ status:'cancelled',paidAt:null }), '未支付');
  assert.equal(s.amountLabel({ status:'pending-payment',paidAt:null }), '应付');
  assert.equal(s.amountLabel({ status:'cancelled',paidAt:'2026-11-16T00:00:00Z' }), '实付');
});

test('没有夜宵历史时隐藏渠道筛选，身份切换立即清理可见状态', async () => {
  const s=setup();const first=s.load();await tick();s.requests[0].resolve(result([{key:'day:d'}],1,[],false));await first;
  assert.equal(s.nightVisible.value,false);assert.equal(s.channels.value.length,0);
  const next=s.load();await tick();s.requests[1].resolve(result([{key:'night:n'}],1,[],true));await next;
  assert.equal(s.nightVisible.value,true);assert.equal(s.channels.value.length,3);
  s.storage.set('token','b');s.session.ensureLogin=async()=>{throw Error('offline');};await s.load();
  assert.equal(s.nightVisible.value,false);assert.equal(s.orders.value.length,0);
});
