import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function setup(fail = false, entryFail = false) {
  const { setActivePinia, createPinia } = require('pinia'); setActivePinia(createPinia());
  const campusExports = {};
  vm.runInNewContext(compile(fs.readFileSync(new URL('../src/stores/campus.ts', import.meta.url), 'utf8')), { exports: campusExports, require: n => n === 'pinia' ? require('pinia') : {} });
  const campus = campusExports.useCampusStore();
  campus.apply({ servicePhone: 'old-phone', serviceQrcode: 'old-qr', afterSalesGroupQrcode: 'old-group' });
  const exports = {};
  const source = fs.readFileSync(new URL('../src/pages/profile/index.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(compile(source + '\nexport { loadProfile, group, serviceContact, orderCount, orderReady, contextError, goOrders };'), {
    exports, Date, uni: { getStorageSync: k => k === 'token' ? 'b-token' : 'b-owner' }, require(name) {
      if (name === 'vue') return { ref: value => ({ value }), computed: f => ({ get value() { return f(); } }) };
      if (name === '@dcloudio/uni-app') return { onShow() {}, onHide() {} };
      if (name.endsWith('/api')) return { api: { addresses: async () => [], coupons: async () => ({ mine: [], claimable: [] }), ordersPage: async () => ({ total: 0 }), userOrders: async () => ({ total: 0, errors: [] }), currentCampus: async () => { if (fail) throw Error('offline'); return { name: '乙校区', servicePhone: '', serviceQrcode: 'b-qr', afterSalesGroupQrcode: 'b-group' }; } } };
      if (name.endsWith('/stores/campus')) return { useCampusStore: () => campus };
      if (name.endsWith('/stores/session')) return { useSessionStore: () => ({ ensureLogin: async () => {} }) };
      if (name.endsWith('/businessContext')) return { resolveBusinessType: async () => { if (entryFail) throw Error('entry offline'); return 'day'; }, businessUrl: x => x };
      return { setupDefaultShare() {}, pickCurrentAddress: a => a[0] };
    },
  });
  return { ...exports, campus };
}
test('我的页使用本次校区的客服/群，空电话不会继承上一校区', async () => {
  const s = setup(); await s.loadProfile();
  assert.equal(s.group.value, 'b-group'); assert.equal(s.serviceContact.value.qrcode, 'b-qr');
  assert.equal(s.serviceContact.value.phone, ''); assert.equal(s.campus.servicePhone, '');
});
test('本次校区请求失败不展示上一校区的客服/群', async () => {
  const s = setup(true); await s.loadProfile();
  assert.equal(s.group.value, ''); assert.equal(s.serviceContact.value.qrcode, ''); assert.equal(s.serviceContact.value.phone, '');
});

test('营业入口接口失败仍加载统一订单计数，不封锁我的订单', async () => {
  const s = setup(false, true); await s.loadProfile();
  assert.equal(s.contextError.value, false); assert.equal(s.orderReady.value, true); assert.equal(s.orderCount.value, 0);
});
