<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow, onHide, onReachBottom, onPullDownRefresh } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useCartStore } from "../../stores/cart";
import { useSessionStore } from "../../stores/session";
import { fenToYuan } from "../../utils/money";
import { preloadPayTemplates, startPayFlow } from "../../utils/payment";
import { startNightPayFlow } from "../../utils/nightPayment";
import { useVisibleNow } from "../../utils/visibleNow";
import type { UserOrderRow } from "../../types/userOrders";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
const session = useSessionStore();
const orders = ref<UserOrderRow[]>([]), active = ref("all"), channel = ref("all");
const nightVisible = ref(false);
const channels = computed(() => nightVisible.value ? [['all','全部订单'],['day','白天单'],['night','夜宵单']] : []);
const paying = ref(""), loading = ref(true), error = ref(false), moreError = ref(false), loadingMore = ref(false);
const partial = ref<string[]>([]), page = ref(1), total = ref(0);
const now = useVisibleNow();
let generation = 0, displayIdentity = "";
const identity = () => `${String(uni.getStorageSync('token') || '')}:${String(uni.getStorageSync('nightCartOwner') || '')}`;
function bindIdentity() {
  const next = identity();
  if (displayIdentity !== next) { orders.value = []; total.value = 0; partial.value = []; page.value = 1; nightVisible.value = false; channel.value = 'all'; displayIdentity = next; }
}
const tabs = [["all", "全部"], ["pending-payment", "待支付"], ["delivering", "配送中"], ["completed", "已完成"], ["cancelled", "已取消"], ["refunded", "退款"], ["exception", "异常"]];
async function load(status = active.value, append = false) {
  if (append && (loading.value || loadingMore.value || error.value || partial.value.length || orders.value.length >= total.value)) return;
  const ticket = ++generation;
  const previous = displayIdentity; bindIdentity();
  if (previous !== displayIdentity) append = false;
  active.value = status;
  if (append) loadingMore.value = true; else loading.value = true;
  error.value = false; moreError.value = false;
  try {
    await session.ensureLogin();
    if (ticket !== generation) return;
    const before = displayIdentity; bindIdentity();
    if (before !== displayIdentity) append = false;
    const owner = identity(), next = append ? page.value + 1 : 1;
    const result = await api.userOrders(channel.value, status, next);
    if (ticket !== generation) return;
    if (owner !== identity()) throw Error('身份已变化，请重试');
    if (!Array.isArray(result.errors)) throw Error('订单服务未就绪，请重试');
    nightVisible.value = result.nightVisible === true;
    if (!nightVisible.value) channel.value = 'all';
    orders.value = append ? [...orders.value, ...result.items.filter(row => !orders.value.some(old => old.key === row.key))] : result.items;
    partial.value = result.errors; total.value = result.total; page.value = next;
  } catch {
    if (ticket === generation) { bindIdentity(); if (append) moreError.value = true; else error.value = true; }
  } finally {
    if (ticket === generation) { loading.value = false; loadingMore.value = false; }
  }
}
function selectChannel(type: string) { channel.value = type; orders.value = []; void load(); }
function selectStatus(status: string) { orders.value = []; void load(status); }
function open(order: UserOrderRow) {
  uni.navigateTo({ url: order.businessType === 'night' ? `/pages/night/order-detail?id=${encodeURIComponent(order.id)}` : `/pages/orders/detail?id=${encodeURIComponent(order.id)}` });
}
function amountLabel(order: UserOrderRow) {
  return order.paidAt ? '实付' : order.status === 'pending-payment' ? '应付' : '未支付';
}
function countdownText(order: UserOrderRow) {
  if (!order.timeoutAt) return '待支付';
  const remaining = new Date(order.timeoutAt).getTime() - now.value;
  if (remaining <= 0) return '支付超时，订单即将关闭';
  return `剩 ${Math.floor(remaining / 60000)}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')} 自动关闭`;
}
async function pay(order: UserOrderRow) {
  if (paying.value) return;
  paying.value = order.key;
  const owner = `${session.user?.id}:${session.user?.campusId}`;
  try {
    const paid = order.businessType === 'night' ? await startNightPayFlow(order.id, order.storeId) : await startPayFlow(order.id);
    if (owner !== `${session.user?.id}:${session.user?.campusId}`) return;
    if (paid) {
      if (order.businessType === 'day') useCartStore().clearLocal();
      uni.showToast({ title: '支付成功', icon: 'success' });
      await load();
    } else { uni.showToast({ title: '支付未完成，可继续支付', icon: 'none' }); open(order); }
  } catch { /* 原支付流程提示错误，订单保留，可进入详情重试。 */ }
  finally { paying.value = ''; }
}
onShow(() => { void preloadPayTemplates(); void load(); });
onHide(() => { generation++; loading.value = false; loadingMore.value = false; });
onReachBottom(() => { void load(active.value, true); });
onPullDownRefresh(async () => { try { await load(); } finally { uni.stopPullDownRefresh(); } });
</script>
<template>
  <view class="page">
    <view v-if="nightVisible" class="order-channels"><button v-for="c in channels" :key="c[0]" :class="{ selected: channel === c[0] }" @tap="selectChannel(c[0]!)">{{ c[1] }}</button></view>
    <scroll-view scroll-x class="tabs"><view class="tabs__inner"><view v-for="t in tabs" :key="t[0]" class="tab" :class="{ 'tab--active': active === t[0] }" @tap="selectStatus(t[0]!)">{{ t[1] }}</view></view></scroll-view>
    <view v-if="partial.length" class="order-warning"><text>{{ partial.map(c => c === 'night' ? '夜宵' : '白天').join('、') }}订单加载失败，当前列表不完整</text><button @tap="load()">重新加载</button></view>
    <view v-if="error" class="empty" @tap="load()"><text class="empty__mark">!</text><text class="empty__title">订单加载失败</text><text class="muted">点击重试，订单不会丢失</text></view>
    <view v-else-if="loading" class="orders-skeleton"><view v-for="n in 3" :key="n" class="skeleton-block" /></view>
    <view v-else-if="!orders.length && !partial.length" class="empty"><text class="empty__title">这里还没有订单</text><text class="muted">{{ nightVisible ? '白天与夜宵订单都会显示在这里' : '下单后可在这里查看订单进度' }}</text></view>
    <template v-else>
      <view v-for="order in orders" :key="order.key" class="order card" @tap="open(order)">
        <view class="order__head"><view><text v-if="nightVisible" class="order-channel" :class="{ night: order.businessType === 'night' }">{{ order.businessType === 'night' ? '夜宵单' : '白天单' }}</text><text>订单 {{ order.orderNo.slice(-8) }}</text></view><text class="order__status">{{ order.statusText }}</text></view>
        <view class="order__goods"><image v-for="(line, index) in order.items.slice(0, 3)" :key="`${line.id}:${index}`" :src="line.image" mode="aspectFit" /><text class="muted">共 {{ order.items.reduce((n, i) => n + i.quantity, 0) }} 件</text></view>
        <text class="order-date">{{ new Date(order.createdAt).toLocaleString('zh-CN', { hour12: false }) }}</text>
        <view class="order__bottom"><text>{{ order.deliveryText }}</text><text class="order__price">{{ amountLabel(order) }} ¥{{ fenToYuan(order.payableAmount) }}</text></view>
        <view v-if="order.status === 'pending-payment'" class="order__pay" @tap.stop><text class="order__countdown">{{ countdownText(order) }}</text><button class="order__pay-btn" :disabled="!!paying" @tap="pay(order)">{{ paying === order.key ? '正在支付…' : '去支付' }}</button></view>
      </view>
      <view v-if="moreError" class="order-warning" @tap="load(active, true)">加载更多失败，点击重试</view>
      <view v-else-if="orders.length && !partial.length" class="list-foot">{{ loadingMore ? '加载中…' : orders.length >= total ? '没有更多了' : '上拉加载更多' }}</view>
    </template>
  </view>
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.page {
  /* IKAHBQ：订单降级普通页（购物车让位 Tab），无自绘 TabBar，留常规底部呼吸 */
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
}
.tabs {
  white-space: nowrap;
  margin-bottom: 26rpx;
}
.tabs__inner {
  display: flex;
  gap: 14rpx;
}
.tab {
  min-height: 72rpx;
  padding: 14rpx 28rpx;
  border-radius: 36rpx;
  background: #fff;
  border: 2rpx solid $line;
  display: flex;
  align-items: center;
}
.tab--active {
  background: $primary;
  color: #fff;
  border-color: $primary;
  font-weight: 800;
  box-shadow: 0 8rpx 18rpx rgba(37, 185, 90, 0.18);
}
.order {
  padding: 28rpx;
  margin-bottom: 22rpx;
}
.order__head,
.order__bottom {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}
.order__head {
  font-weight: 800;
}
.order__status {
  color: $primary-dark;
  background: $primary-soft;
  padding: 5rpx 12rpx;
  border-radius: 14rpx;
  white-space: nowrap;
}
.order__goods {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 24rpx 0;
}
.order__goods image {
  width: 110rpx;
  height: 110rpx;
  background: $primary-soft;
  border-radius: 20rpx;
}
.order__goods .muted {
  margin-left: auto;
}
.order__bottom {
  font-size: 23rpx;
  border-top: 2rpx dashed $line;
  padding-top: 20rpx;
}
.order__price {
  font-weight: 900;
  color: #ff4d18;
}
.order__pay {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 20rpx;
}
.order__countdown {
  font-size: 22rpx;
  color: #b1560f;
}
.order__pay-btn {
  /* 热区提至 88rpx 标准（IK9AWL），视觉字号不变 */
  min-height: 88rpx;
  line-height: 88rpx;
  margin: 0;
  padding: 0 34rpx;
  background: $primary;
  color: #fff;
  font-size: 24rpx;
  font-weight: 800;
  border-radius: 44rpx;
}
.order__pay-btn[disabled] {
  opacity: 0.6;
}
.orders-skeleton {
  padding-top: 10rpx;
}
.skeleton-block {
  height: 240rpx;
  border-radius: 28rpx;
  margin-bottom: 22rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: orders-pulse 1.2s infinite;
}
@keyframes orders-pulse {
  50% {
    opacity: 0.55;
  }
}
.list-foot {
  text-align: center;
  color: $muted;
  font-size: 22rpx;
  padding: 20rpx 0 10rpx;
}
.empty {
  text-align: center;
  padding-top: 140rpx;
}
.empty__mark {
  display: flex;
  width: 160rpx;
  height: 160rpx;
  margin: auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: $primary-soft;
  border: 5rpx solid $primary;
  color: $primary-dark;
  font-size: 52rpx;
  font-weight: 900;
}
.empty__title {
  display: block;
  font-size: 36rpx;
  font-weight: 900;
  margin: 40rpx 0 10rpx;
}
.order-channels { display: flex; gap: 16rpx; margin-bottom: 22rpx; }
.order-channels button { margin: 0; font-size: 25rpx; line-height: 64rpx; border-radius: 32rpx; background: #eaf1e8; color: #365e43; }
.order-channels button.selected { background: #214e35; color: #fff; }
.order-channel { display: inline-block; padding: 4rpx 12rpx; margin-right: 12rpx; border-radius: 12rpx; background: #e8f3e8; color: #315c3f; font-size: 22rpx; }
.order-channel.night { background: #253f31; color: #ffe0a0; }
.order-date { display: block; font-size: 22rpx; color: #849184; margin-bottom: 16rpx; }
.order-warning { padding: 22rpx; background: #fff2d6; color: #725829; font-size: 24rpx; border-radius: 20rpx; margin-bottom: 20rpx; }
.order-warning button { font-size: 24rpx; margin-top: 14rpx; }
</style>
