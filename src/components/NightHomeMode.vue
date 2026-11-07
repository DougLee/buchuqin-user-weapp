<script setup lang="ts">
import { readNightBuilding, clearNightBuilding, createBusinessRequestScope } from "../utils/businessContext";
import { computed, onMounted, ref } from "vue";
import { nightApi } from "../api/night";
import { useNightCartStore } from "../stores/nightCart";
import { useSessionStore } from "../stores/session";
import NightProductShelf from "./NightProductShelf.vue";
import type { NightProduct, NightStoreRow } from "../types/night";

/**
 * 夜宵模式首页（IKSW1F，道哥 2026-11-05 定稿）：夜宵场次中，首页商品区
 * 整体切换为当前楼栋夜宵店——白天商品流/搜索/推荐全部隐藏，仅显示本店
 * 可售商品。楼栋记忆：storage「nightStoreBuildingId」（选店确认时写入），
 * 无记忆/店铺失效时显示选楼栋引导。三态：营业中=商品流+购物车条；
 * 无楼长/未开业=状态卡+换楼栋引导。挂载方（首页）负责 inNightSession 判定，
 * 本组件信任挂载时机，不再重复拉 entry。
 */
const cart = useNightCartStore();
const session = useSessionStore();
const error = ref(false);
let generation = 0;

const store = ref<NightStoreRow>();
const storeId = ref("");
const sessionInfo = ref<NightStoreRow["session"]>();
const products = ref<NightProduct[]>([]);
const selectedCatalogId = ref("");
const loading = ref(true);
const buildingId = ref("");
const buildingName = ref("");

const isOpen = computed(() => store.value?.state === "open");
const cartLines = computed(() => cart.linesOf(storeId.value));
const cartCount = computed(() => cart.countOf(storeId.value));
const cartAmount = computed(() => cart.amountOf(storeId.value));

/** 加载本店数据（挂载方 onShow 可复用——首页 tabbar 页不销毁，
 *  返回首页/进店后回首页需刷新楼栋店状态） */
const loadScope = createBusinessRequestScope();
async function load() {
  const invocation = ++generation;
  loadScope.invalidate();
  let current = () => invocation === generation;
  error.value = false; loading.value = true;
  store.value = undefined; storeId.value = ''; products.value = [];
  try {
    await session.ensureLogin();
    if (invocation !== generation) return;
    current = loadScope.begin();
    const memo = readNightBuilding();
    if (!memo) return;
    const bundle = await nightApi.stores(memo);
    if (!current()) return;
    const row = bundle.stores.find(row => row.buildingId === memo);
    if (!row || !row.storeId) { clearNightBuilding(); return; }
    const [detail, goods] = await Promise.all([nightApi.storeDetail(row.storeId), nightApi.storeProducts(row.storeId)]);
    if (!current()) return;
    storeId.value = row.storeId; buildingId.value = row.buildingId; buildingName.value = row.buildingName;
    store.value = detail; sessionInfo.value = detail.session; products.value = goods;
    cart.refreshProducts(row.storeId, goods);
  } catch { if (current()) error.value = true; }
  finally { if (current()) loading.value = false; }
}
onMounted(load);
function shareTarget() { return { buildingId: buildingId.value, catalogProductId: selectedCatalogId.value, name: products.value.find(product => product.catalogProductId === selectedCatalogId.value)?.name || `${buildingName.value}夜宵店` }; }
defineExpose({ load, shareTarget });

function goBuildings() {
  uni.navigateTo({ url: "/pages/night/buildings" });
}
function goOrders() {
  uni.navigateTo({ url: "/pages/night/orders" });
}
function goCheckout() {
  if (!cartCount.value) return;
  if (!isOpen.value) { uni.showToast({ title: "店铺休息中，开门后可下单", icon: "none" }); return; }
  // storeId=夜宵店 id（购物车分桶键，与店铺页同约定），buildingId=楼栋 id
  uni.navigateTo({
    url: `/pages/night/checkout?storeId=${storeId.value}&buildingId=${buildingId.value}`,
  });
}
</script>
<template>
  <view class="nhm">
    <view v-if="error" class="nhm__guide card"><text class="nhm__guide-title">夜宵好物暂时没加载出来</text><text class="nhm__guide-sub">保留了你的楼栋选择和购物车</text><button class="nhm__guide-btn" @tap="load">重新加载</button></view>
    <!-- 引导：未选楼栋/店铺失效 -->
    <view v-else-if="!loading && !store" class="nhm__guide card">
      <text class="nhm__guide-title">🌙 夜宵店 · 选择你的楼栋</text>
      <text class="nhm__guide-sub">楼长夜宵店营业中，选好楼栋即可下单送到寝室</text>
      <button class="nhm__guide-btn" @tap="goBuildings">选择楼栋</button>
    </view>
    <view v-else-if="loading && !store" class="nhm__guide card"><text class="nhm__guide-sub">正在准备今晚的好物…</text></view>
    <template v-else-if="store">
      <!-- 店头 -->
      <view class="nhm__head card">
        <view class="nhm__head-row">
          <text class="nhm__head-name">🌙 {{ buildingName }}·夜宵店</text>
          <text
            class="nhm__head-badge"
            :class="{ 'nhm__head-badge--open': isOpen }"
            >{{ isOpen ? "营业中" : "未开业" }}</text
          >
        </view>
        <view class="nhm__head-actions">
          <text class="nhm__head-link" @tap="goOrders">我的夜宵单</text>
          <text class="nhm__head-link" @tap="goBuildings">切换楼栋</text>
        </view>
      </view>
      <NightProductShelf @detail-change="selectedCatalogId = $event" :products="products" :store-id="storeId" :building-id="buildingId" :building-name="buildingName" :open="isOpen" />
      <!-- 购物车条 -->
      <view v-if="cartCount" class="nhm__cartbar" @tap="goCheckout">
        <text class="nhm__cartbar-badge">{{ cartCount }}</text>
        <text class="nhm__cartbar-amount">￥{{ (cartAmount / 100).toFixed(2) }}</text>
        <text class="nhm__cartbar-go">去结算</text>
      </view>
    </template>
  </view>
</template>
<style scoped>
.nhm {
  display: block;
  padding-bottom: 160rpx;
}
.nhm__head {
  background: linear-gradient(135deg, #10381f, #0d6b3a);
  border-radius: 20rpx;
  padding: 28rpx 30rpx;
  color: #fff;
  margin-bottom: 20rpx;
}
.nhm__head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nhm__head-name {
  font-size: 32rpx;
  font-weight: 800;
}
.nhm__head-badge {
  font-size: 22rpx;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 999rpx;
  padding: 6rpx 18rpx;
}
.nhm__head-badge--open {
  background: #ffd75e;
  color: #7a4d00;
  font-weight: 700;
}
.nhm__head-actions {
  display: flex;
  gap: 28rpx;
  margin-top: 16rpx;
}
.nhm__head-link {
  font-size: 24rpx;
  color: #ffe9a8;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.nhm__goods {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
}
.nhm__img {
  width: 120rpx;
  height: 120rpx;
  border-radius: 16rpx;
  background: #f2f2f2;
  flex: none;
}
.nhm__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.nhm__name {
  font-size: 28rpx;
  font-weight: 700;
}
.nhm__price {
  font-size: 28rpx;
  color: #e02020;
  font-weight: 800;
}
.nhm__add {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #0d6b3a;
  color: #fff;
  font-size: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.nhm__add--off {
  background: #cccccc;
  font-size: 22rpx;
}
.nhm__empty {
  padding: 60rpx 20rpx;
  text-align: center;
  color: var(--muted, #999);
  font-size: 26rpx;
}
.nhm__cartbar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(124rpx + env(safe-area-inset-bottom));
  background: #10381f;
  border-radius: 999rpx;
  padding: 22rpx 36rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  color: #fff;
  box-shadow: 0 10rpx 24rpx rgba(7, 60, 30, 0.35);
  z-index: 50;
}
.nhm__cartbar-badge {
  min-width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #ffd75e;
  color: #7a4d00;
  font-size: 24rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nhm__cartbar-amount {
  flex: 1;
  font-size: 32rpx;
  font-weight: 800;
}
.nhm__cartbar-go {
  font-size: 28rpx;
  font-weight: 800;
  color: #ffd75e;
}
.nhm__guide {
  padding: 60rpx 40rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: center;
  text-align: center;
}
.nhm__guide-title {
  font-size: 32rpx;
  font-weight: 800;
}
.nhm__guide-sub {
  font-size: 24rpx;
  color: #999;
}
.nhm__guide-btn {
  margin-top: 8rpx;
  background: #0d6b3a;
  color: #fff;
  font-size: 28rpx;
  border-radius: 999rpx;
  padding: 8rpx 48rpx;
}
.nhm__guide-btn::after {
  border: none;
}
</style>
