import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { createPinia, setActivePinia } = require('pinia');
const compiled = ts.transpileModule(fs.readFileSync(new URL('../src/stores/nightCart.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
function fixture(initial = []) {
  const storage = new Map(initial), exports = {};
  setActivePinia(createPinia());
  vm.runInNewContext(compiled, { exports, require, uni: { getStorageSync: k => storage.get(k) || '', setStorageSync: (k, v) => storage.set(k, v) } });
  return { storage, cart: exports.useNightCartStore() };
}
const store = { id: 'store-a', buildingId: 'building-a', buildingName: '西区9栋' };
const product = { id: 'product-a', name: '茉莉绿茶', image: '/tea.jpg', price: 500, stock: 10 };
test('账号和楼栋分桶互相隔离，返回原账号保留自己的商品', () => {
  const { cart, storage } = fixture([['cart', 'day-cart-unchanged']]);
  cart.setOwner('user-a'); cart.setQuantity(store, product, 2);
  cart.setQuantity({ ...store, id: 'store-b' }, product, 1);
  cart.setOwner('user-b'); assert.equal(cart.countOf(store.id), 0);
  cart.setQuantity(store, product, 4);
  cart.setOwner('user-a'); assert.equal(cart.countOf(store.id), 2); assert.equal(cart.countOf('store-b'), 1);
  cart.clear(store.id); assert.equal(cart.countOf('store-b'), 1);
  assert.equal(storage.get('cart'), 'day-cart-unchanged');
});
test('重验最新售价和资料，保留缺货数量让用户核对，金额随快照更新', () => {
  const { cart } = fixture(); cart.setOwner('user'); cart.setQuantity(store, product, 2);
  assert.equal(cart.refreshProducts(store.id, [{ ...product, price: 700, stock: 1, name: '新绿茶' }]), true);
  assert.equal(cart.amountOf(store.id), 1400); assert.equal(cart.countOf(store.id), 2); assert.equal(cart.linesOf(store.id)[0].name, '新绿茶');
  cart.refreshProducts(store.id, []); assert.equal(cart.countOf(store.id), 2);
  cart.removeLines(store.id, [product.id]); assert.equal(cart.countOf(store.id), 0);
});
test('数量为整数且不超过库存，无效数量不能污染金额', () => {
  const { cart } = fixture(); cart.setOwner('user');
  for (const [quantity, expected] of [[2.8, 2], [20, 10], [-1, 0], [NaN, 0], [Infinity, 0]]) {
    cart.setQuantity(store, product, quantity); assert.equal(cart.countOf(store.id), expected); assert.equal(cart.amountOf(store.id), expected * 500);
  }
});
test('损坏或旧的无归属购物车不会带入其他用户', () => {
  let f = fixture([['nightCart', '{legacy}']]); assert.equal(f.cart.countOf(store.id), 0);
  f = fixture([['nightCartOwner', 'user'], ['nightCart:user', '{broken']]); assert.equal(f.cart.countOf(store.id), 0);
  f = fixture([['nightCartOwner', 'user'], ['nightCart:user', JSON.stringify({ 'store-a': { ...store, storeId: store.id, items: [{ productId: 'p', quantity: -1 }, { productId: 'p', name: '茶', image: '', price: 100, quantity: 2 }] } })]]);
  assert.equal(f.cart.countOf(store.id), 2); assert.equal(f.cart.amountOf(store.id), 200);
});

test('支付只扣除该单已选数量，保留新加商品，重查支付与刷新都不重复清车', () => {
  const { cart, storage } = fixture(); cart.setOwner('user-a');
  cart.setQuantity(store, product, 5);
  cart.setQuantity(store, { ...product, id: 'new-product' }, 1);
  const lines = [{ nightProductId: product.id, quantity: 2 }];
  cart.consumeOrder(store.id, 'paid-order', lines);
  assert.equal(cart.quantityOf(store.id, product.id), 3);
  assert.equal(cart.quantityOf(store.id, 'new-product'), 1);
  cart.consumeOrder(store.id, 'paid-order', lines);
  assert.equal(cart.countOf(store.id), 4);
  const again = fixture([...storage]); again.cart.consumeOrder(store.id, 'paid-order', lines);
  assert.equal(again.cart.countOf(store.id), 4);
});

test('同一用户跨校区购物车隔离，切回原校区保留商品', () => {
  const { cart } = fixture();
  cart.setOwner('buyer', 'campus-a'); cart.setQuantity(store, product, 2);
  cart.setOwner('buyer', 'campus-b'); assert.equal(cart.countOf(store.id), 0);
  cart.setQuantity(store, product, 1);
  cart.setOwner('buyer', 'campus-a'); assert.equal(cart.countOf(store.id), 2);
});

test('秒杀行锁定渠道与数量，过期不悄悄改成原价，原单支付不清掉新换的普通行', () => {
  const { cart } = fixture(); cart.setOwner('buyer', 'campus');
  const seckill = { ...product, asSeckill: true, seckill: { id: 'promo', price: 200, endsAt: new Date(Date.now() + 60000).toISOString() } };
  cart.setQuantity(store, seckill, 2);
  assert.equal(cart.countOf(store.id), 1); assert.equal(cart.amountOf(store.id), 200);
  assert.equal(cart.setQuantity(store, { ...product, asSeckill: false }, 1), false);
  cart.refreshProducts(store.id, [{ ...product, seckill: null }]);
  assert.equal(cart.linesOf(store.id)[0].asSeckill, true); assert.equal(cart.amountOf(store.id), 200);
  cart.clear(store.id); cart.setQuantity(store, product, 1);
  cart.consumeOrder(store.id, 'paid-seckill', [{ nightProductId: product.id, quantity: 1, asSeckill: true }]);
  assert.equal(cart.countOf(store.id), 1);
});

test('旧秒杀活动不会迁移到下一场，新活动车行也不会被旧订单支付清除', () => {
  const { cart } = fixture(); cart.setOwner('buyer', 'campus');
  const old = { ...product, asSeckill: true, seckill: { id: 'old-promo', price: 200, endsAt: new Date(Date.now() + 60000).toISOString() } };
  const next = { ...old, seckill: { ...old.seckill, id: 'next-promo', price: 300 } };
  cart.setQuantity(store, old, 1);
  cart.refreshProducts(store.id, [next]);
  assert.equal(cart.linesOf(store.id)[0].promotionId, 'old-promo');
  assert.equal(cart.amountOf(store.id), 200);
  assert.equal(cart.setQuantity(store, next, 1), false);
  cart.clear(store.id); cart.setQuantity(store, next, 1);
  cart.consumeOrder(store.id, 'old-paid', [{ nightProductId: product.id, quantity: 1, asSeckill: true, promotionId: 'old-promo' }]);
  assert.equal(cart.countOf(store.id), 1); assert.equal(cart.amountOf(store.id), 300);
});
