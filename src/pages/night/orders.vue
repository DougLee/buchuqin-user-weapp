<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { onShow, onReachBottom } from "@dcloudio/uni-app";
import { nightApi } from "../../api/night";
import { fenToYuan } from "../../utils/money";
import { startNightPayFlow } from "../../utils/nightPayment";
import type { NightOrder } from "../../types/night";
import { setupDefaultShare } from "../../utils/share";
import { useSessionStore } from "../../stores/session";
import { nightDate } from "../../utils/nightDate";
setupDefaultShare();

/**
 * 夜宵订单列表（IKSW1F）：夜宵单独立于白天订单（无 statusPhase 12 态，
 * 用夜宵轻量状态机）。待支付单按 timeoutAt 倒计时，可去支付；其余态
 * 点卡片进详情页操作（取消/确认收货/售后）。
 */
const orders = ref<NightOrder[]>([]);
const session = useSessionStore();
const active = ref("all");
const paying = ref("");
const loading = ref(true);
const error = ref(false);
const page = ref(1);
const total = ref(0);
const loadingMore = ref(false);
const moreError = ref(false);
let loadGeneration = 0;
const nowTick = ref(Date.now());
const ticker = setInterval(() => (nowTick.value = Date.now()), 30_000);
onUnmounted(() => clearInterval(ticker));
/** tab 与后端 status 过滤参数一一对应（夜宵轻量状态机） */
const tabs: Array<[string, string]> = [
  ["all", "全部"],
  ["pending-payment", "待支付"],
  ["pending-accept", "待接单"],
  ["delivering", "配送中"],
  ["delivered", "已送达"],
  ["completed", "已完成"],
  ["cancelled", "已取消"],
  ["cancelling", "退款中"],
  ["refunded", "已退款"],
  ["exception", "需处理"],
];
async function load(status = "all") {
  const generation = ++loadGeneration;
  active.value = status;
  loading.value = true;
  error.value = false;
  loadingMore.value = false;
  moreError.value = false;
  try {
    await session.ensureLogin();
    const result = await nightApi.orders(status, 1);
    if (generation !== loadGeneration) return;
    orders.value = result.items;
    page.value = 1;
    total.value = result.total;
  } catch (e) {
    // ADR-0005：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
    if (generation === loadGeneration) error.value = true;
  } finally {
    if (generation === loadGeneration) loading.value = false;
  }
}
async function loadMore() {
  if (loading.value || loadingMore.value || orders.value.length >= total.value) return;
  const generation = loadGeneration;
  loadingMore.value = true;
  moreError.value = false;
  try {
    const result = await nightApi.orders(active.value, page.value + 1);
    if (generation !== loadGeneration) return;
    const seen = new Set(orders.value.map(row => row.id));
    orders.value.push(...result.items.filter(row => !seen.has(row.id)));
    page.value = result.page;
    total.value = result.total;
  } catch { if (generation === loadGeneration) moreError.value = true; }
  finally { if (generation === loadGeneration) loadingMore.value = false; }
}
onReachBottom(loadMore);
onShow(() => {
  load(active.value);
});
/** 待支付倒计时（timeoutAt 服务端下发，客户端不自算窗口） */
function countdownText(order: NightOrder): string {
  if (!order.timeoutAt) return "待支付";
  const remaining = new Date(order.timeoutAt).getTime() - nowTick.value;
  if (remaining <= 0) return "支付超时，订单即将关闭";
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `剩 ${minutes}:${String(seconds).padStart(2, "0")} 自动关闭`;
}
async function pay(order: NightOrder) {
  if (paying.value) return;
  paying.value = order.id;
  try {
    const paid = await startNightPayFlow(order.id, order.store?.id);
    if (paid) {
      uni.showToast({ title: "支付成功", icon: "success" });
      await load(active.value);
    } else {
      // 取消/失败：跳详情页提供"继续支付"入口，不留死路
      uni.showToast({ title: "支付未完成，可继续支付", icon: "none" });
      uni.navigateTo({ url: `/pages/night/order-detail?id=${order.id}` });
    }
  } catch {
    // 网络异常等：request 层已 toast，这里兜底防未处理 rejection
  } finally {
    paying.value = "";
  }
}
const totalCount = (order: NightOrder) =>
  order.items.reduce((sum, line) => sum + line.quantity, 0);
/** 夜宵单标识副行：楼栋 + 业务日期（跨零点场次归属） */
const metaText = (order: NightOrder) =>
  `${order.store?.buildingName ?? "夜宵店"} · ${order.businessDate} 夜宵场`;
/** 列表副行兜底文案（无优惠时展示下单时间） */
const remarkOf = (order: NightOrder) =>
  `下单 ${nightDate(order.createdAt)}`;
</script>

<template>
  <view class="page"
    ><scroll-view scroll-x class="tabs"
      ><view class="tabs__inner"
        ><view
          v-for="t in tabs"
          :key="t[0]"
          class="tab"
          :class="{ 'tab--active': active === t[0] }"
          @tap="load(t[0])"
          >{{ t[1] }}</view
        ></view
      ></scroll-view
    ><view v-if="error" class="empty" @tap="load(active)"
      ><text class="empty__mark">!</text
      ><text class="empty__title">夜宵订单加载失败</text
      ><text class="muted">网络异常，点击重试</text></view
    ><view v-else-if="loading" class="orders-skeleton"
      ><view v-for="n in 3" :key="n" class="skeleton-block" /></view
    ><view v-else-if="!orders.length" class="empty"
      ><text class="empty__mark">🌙</text
      ><text class="empty__title">还没有夜宵订单</text
      ><text class="muted">深夜饿了，去夜宵店逛逛</text><button class="primary-btn" @tap="uni.navigateTo({ url: '/pages/night/buildings' })">逛逛夜宵店</button></view
    ><template v-else
    ><view
      v-for="order in orders"
      :key="order.id"
      class="order card"
      @tap="uni.navigateTo({ url: `/pages/night/order-detail?id=${order.id}` })"
      ><view class="order__head"
        ><text>夜宵单 {{ order.orderNo.slice(-8) }}</text
        ><text class="order__status">{{ order.statusText }}</text></view
      ><text class="muted order__meta">{{ metaText(order) }}</text
      ><view class="order__goods"
        ><image
          v-for="line in order.items.slice(0, 3)"
          :key="line.nightProductId"
          :src="line.image"
          mode="aspectFit"
        /><text class="muted">共 {{ totalCount(order) }} 件</text></view
      ><view class="order__bottom"
        ><text class="muted">{{
          order.couponDiscount > 0
            ? `已优惠 ¥${fenToYuan(order.couponDiscount)}`
            : remarkOf(order)
        }}</text
        ><text class="order__price"
          >{{ order.paidAt ? "实付" : order.status === 'pending-payment' ? "待付" : "未支付" }} ¥{{
            fenToYuan(order.payableAmount)
          }}</text
        ></view
      ><view
        v-if="order.status === 'pending-payment'"
        class="order__pay"
        @tap.stop
        ><text class="order__countdown">{{ countdownText(order) }}</text
        ><button
          class="order__pay-btn"
          :disabled="paying === order.id"
          @tap="pay(order)"
        >
          {{ paying === order.id ? "正在支付…" : "去支付" }}
        </button></view
      ></view
    ><button class="load-more" :disabled="loadingMore" @tap="loadMore">{{ loadingMore ? '加载中…' : moreError ? '加载失败，点击重试' : orders.length < total ? '加载更多订单' : '已显示全部订单' }}</button></template
    ></view
  >
</template>

<style scoped lang="scss">
@import "../../styles/theme.scss";
.page {
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
}
.load-more { min-height: 88rpx; background: transparent; color: #637368; font-size: 24rpx; }
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
  background: #1e2520;
  color: #ffe082;
  border-color: #1e2520;
  font-weight: 800;
  box-shadow: 0 8rpx 18rpx rgba(10, 34, 24, 0.2);
}
.order {
  padding: 28rpx;
  margin-bottom: 22rpx;
}
.order__head {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  font-weight: 800;
}
.order__status {
  color: #1d5c3c;
  background: $primary-soft;
  padding: 5rpx 12rpx;
  border-radius: 14rpx;
  white-space: nowrap;
}
.order__meta {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
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
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
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
  min-height: 88rpx;
  line-height: 88rpx;
  margin: 0;
  padding: 0 34rpx;
  background: #1e2520;
  color: #ffe082;
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
  height: 260rpx;
  border-radius: 28rpx;
  margin-bottom: 22rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: night-pulse 1.2s infinite;
}
@keyframes night-pulse {
  50% {
    opacity: 0.55;
  }
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
  background: #1e2520;
  font-size: 60rpx;
}
.empty__title {
  display: block;
  font-size: 36rpx;
  font-weight: 900;
  margin: 40rpx 0 10rpx;
}
</style>
