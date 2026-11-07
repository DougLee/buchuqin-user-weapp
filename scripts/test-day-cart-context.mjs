import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createPinia, setActivePinia } = require('pinia');
const source = ts.transpileModule(fs.readFileSync(new URL('../src/stores/cart.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
function fixture(api) {
  api = { cart: async () => ({ items: [], totalQuantity: 0, productAmount: 0, deliveryThreshold: 0, version: "empty" }), ...api };
  let token = 'user-a'; const exports = {}; setActivePinia(createPinia());
  vm.runInNewContext(source, { exports, require(name) {
    if (name === 'pinia') return require('pinia');
    if (name === '../api') return { api };
    if (name === '../utils/track') return { track() {} };
    if (name === './session') return { useSessionStore: () => ({ ensureLogin: async () => {} }) };
    throw Error(name);
  }, uni: { getStorageSync: () => token } });
  return { cart: exports.useCartStore(), switchToken() { token = 'user-b'; } };
}
const oldCart = { items: [{ product: { id: 'product-a' }, quantity: 1 }], totalQuantity: 1, productAmount: 100, deliveryThreshold: 0 };
test('白天购物车旧账号响应与排队写操作不能覆盖新账号', async () => {
  let finish; let calls = 0;
  const context = fixture({ updateCart: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  context.cart.setOwner('user-a', 'campus');
  const first = context.cart.set({ id: 'product-a' }, 1);
  await new Promise(setImmediate);
  const second = context.cart.set({ id: 'product-b' }, 1);
  const clear = context.cart.clearAll();
  context.switchToken(); context.cart.setOwner('user-b', 'campus');
  finish(oldCart); await Promise.all([first, second, clear]);
  assert.equal(calls, 1); assert.equal(context.cart.cart.totalQuantity, 0); assert.deepEqual(Object.keys(context.cart.pending), []);
});

test('购物车旧查询晚到，不能盖掉查询期间已经成功的新加购', async () => {
  let finish;
  const updated = { ...oldCart, totalQuantity: 2, productAmount: 200, items: [{ product: { id: 'product-a' }, quantity: 2 }] };
  const context = fixture({ cart: () => new Promise(resolve => { finish = resolve; }), updateCart: async () => updated });
  context.cart.setOwner('user-a', 'campus');
  context.cart.loaded = true;
  const loading = context.cart.load(); await new Promise(setImmediate);
  await context.cart.set({ id: 'product-a' }, 2);
  finish(oldCart); await loading;
  assert.equal(context.cart.cart.totalQuantity, 2);
});

function cartOf(items) {
  return { items: items.map(item => ({ product: { id: item.productId }, quantity: item.quantity, asSeckill: item.asSeckill })), totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0), productAmount: 0, deliveryThreshold: 0 };
}
function queuedFixture() {
  const calls = []; let release;
  const context = fixture({ updateCart: items => {
    calls.push(JSON.parse(JSON.stringify(items)));
    if (calls.length === 1) return new Promise(resolve => { release = () => resolve(cartOf(items)); });
    return Promise.resolve(cartOf(items));
  } });
  context.cart.setOwner('user-a', 'campus');
  return { ...context, calls, release: () => release() };
}
test('清空之前的在途写入不能吞掉清空之后新增的商品', async () => {
  const context = queuedFixture();
  const first = context.cart.set({ id: 'a' }, 1); await new Promise(setImmediate);
  const clear = context.cart.clearAll(), added = context.cart.set({ id: 'b' }, 1, false);
  context.release(); await Promise.all([first, clear, added]);
  assert.equal(context.cart.quantity('b'), 1);
  assert.deepEqual(context.calls.map(items => items.map(item => item.productId)), [['a'], [], ['b']]);
});
test('支付本机清车后，旧加购响应不能让已购商品重新出现', async () => {
  const context = queuedFixture();
  const first = context.cart.set({ id: 'a' }, 1); await new Promise(setImmediate);
  context.cart.clearLocal(); context.release(); await first;
  assert.equal(context.cart.cart.totalQuantity, 0);
});
test('排队中的普通加购与秒杀加购分别保留各自的价格身份', async () => {
  const context = queuedFixture();
  const first = context.cart.set({ id: 'a' }, 1); await new Promise(setImmediate);
  const normal = context.cart.set({ id: 'b' }, 1, false), seckill = context.cart.set({ id: 'c' }, 1, true);
  context.release(); await Promise.all([first, normal, seckill]);
  assert.equal(context.calls.at(-1).find(item => item.productId === 'c').asSeckill, true);
  assert.equal(context.cart.cart.items.find(item => item.product.id === 'c').asSeckill, true);
});

test('首次加购先读取服务端购物车，保留已有其他商品并提交版本', async () => {
  let received, version;
  const context = fixture({ cart: async () => ({ ...oldCart, version: 'server-v1' }), updateCart: async (items, expected) => { received = items; version = expected; return cartOf(items); } });
  context.cart.setOwner('user-a', 'campus');
  assert.equal(await context.cart.set({ id: 'b' }, 1), true);
  assert.equal(version, 'server-v1'); assert.equal(received.length, 2);
  assert.equal(context.cart.quantity('product-a'), 1);
});
test('已加载旧版本时清空等待在途加购后重读版本，最终服务端为空', async () => {
  let state = { ...cartOf([]), version: 'v1' }, finish;
  const context = fixture({ cart: async () => state, updateCart: (items, expected) => {
    if (items.length) return new Promise(resolve => { finish = () => { state = { ...cartOf(items), version: 'v2' }; resolve(state); }; });
    assert.equal(expected, state.version);
    state = { ...cartOf([]), version: 'v3' }; return Promise.resolve(state);
  } });
  context.cart.setOwner('user-a', 'campus'); await context.cart.load();
  const adding = context.cart.set({ id: 'a' }, 1); await new Promise(setImmediate);
  const clearing = context.cart.clearAll(); finish(); await adding;
  assert.equal(await clearing, true); assert.equal(state.totalQuantity, 0); assert.equal(context.cart.cart.version, 'v3');
});
