import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function moduleOf(path, uni = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, uni }); return exports;
}
const { nightStoreLink, nightTimelineQuery } = moduleOf('../src/utils/nightLink.ts');
test('夜宵分享保留校区楼栋商品，但必须经过楼栋确认入口', () => {
  assert.equal(nightStoreLink({ campusId: 'c', buildingId: 'b', catalogProductId: 'sku/&' }), '/pages/night/buildings?campus=c&buildingId=b&catalogProductId=sku%2F%26');
  assert.equal(nightStoreLink({}), '/pages/night/buildings');
});
function open(banner) {
  const actions = [];
  const { openBannerTarget } = moduleOf('../src/utils/bannerLink.ts', { navigateTo: x => actions.push(x.url), switchTab: x => actions.push(x.url), showToast() {} });
  openBannerTarget({ linkType: 'page', ...banner }); return actions;
}
test('夜宵运营券和订单入口落正确渠道', () => {
  assert.equal(open({ businessType: 'night', linkUrl: 'pages/coupons/index' })[0], '/pages/coupons/index?businessType=night');
  assert.equal(open({ businessType: 'night', linkUrl: 'pages/orders/index' })[0], '/pages/night/orders');
});
test('夜宵商品目标经过楼栋选择；遗留白天商品链接不得打开白天详情', () => {
  assert.equal(open({ businessType: 'night', linkUrl: 'pages/night/buildings?catalogProductId=sku' })[0], '/pages/night/buildings?catalogProductId=sku');
  assert.equal(open({ businessType: 'night', linkUrl: 'pages/product/detail?id=day-sku' })[0], '/pages/night/buildings');
});
test('白天商品目标与tab导航保持原有行为', () => {
  assert.equal(open({ businessType: 'day', linkUrl: 'pages/product/detail?id=day-sku' })[0], '/pages/product/detail?id=day-sku');
  assert.equal(open({ businessType: 'day', linkUrl: 'pages/cart/index' })[0], '/pages/cart/index');
});

test('夜宵朋友圈query明确渠道并保留商品参数，无楼栋也能确认楼栋', () => {
  assert.equal(nightTimelineQuery({ campusId: 'c', buildingId: 'b', catalogProductId: 'sku' }), 'businessType=night&campus=c&buildingId=b&catalogProductId=sku');
  assert.equal(nightTimelineQuery({}), 'businessType=night');
});
