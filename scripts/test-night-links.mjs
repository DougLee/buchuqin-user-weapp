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
// IKTZ7J 道哥 2026-11-09：地址定楼——夜宵分享统一落首页（businessType=night），
// 接收者按自己当前地址定店；楼栋/商品参数弃用，链接不授予配送资格
test('夜宵分享落首页并保留校区，楼栋商品参数弃用', () => {
  assert.equal(nightStoreLink({ campusId: 'c', buildingId: 'b', catalogProductId: 'sku/&' }), '/pages/index/index?campus=c&businessType=night');
  assert.equal(nightStoreLink({}), '/pages/index/index?businessType=night');
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
test('夜宵商品/校区目标落分类页夜货架（地址定店），不再拦选楼页', () => {
  assert.equal(open({ businessType: 'night', linkUrl: 'pages/product/detail?id=day-sku' })[0], '/pages/category/index');
  assert.equal(open({ businessType: 'night', linkUrl: 'pages/campus/index' })[0], '/pages/category/index');
});
test('白天商品目标与tab导航保持原有行为', () => {
  assert.equal(open({ businessType: 'day', linkUrl: 'pages/product/detail?id=day-sku' })[0], '/pages/product/detail?id=day-sku');
  assert.equal(open({ businessType: 'day', linkUrl: 'pages/cart/index' })[0], '/pages/cart/index');
});

test('夜宵朋友圈query明确渠道并保留校区，楼栋参数不再下发', () => {
  assert.equal(nightTimelineQuery({ campusId: 'c', buildingId: 'b', catalogProductId: 'sku' }), 'campus=c&businessType=night');
  assert.equal(nightTimelineQuery({}), 'businessType=night');
});
