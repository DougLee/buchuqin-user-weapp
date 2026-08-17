<script setup lang="ts">
import { ref } from "vue";
import { onHide, onShow, onUnload } from "@dcloudio/uni-app";
import { api } from "../../api";
import { fenToYuan } from "../../utils/money";
import { startPayFlow } from "../../utils/payment";
import type { Order } from "../../types";
/** 与后端支付超时关单保持一致（15 分钟，Cron + 懒执行） */
const PAY_WINDOW_MS = 15 * 60 * 1000;
const orders = ref<Order[]>([]),
  active = ref("all"),
  now = ref(Date.now()),
  paying = ref(""),
  ticker = ref<number>();
// tab 与后端 status 过滤参数直接对应；delivering 含全部履约中状态（含 delivered 已送达待确认）
const tabs = [
  ["all", "全部"],
  ["pending-payment", "待支付"],
  ["delivering", "配送中"],
  ["completed", "已完成"],
  ["cancelled", "已取消"],
  ["refunded", "退款"],
  ["exception", "异常"],
];
async function load(status = "all") {
  active.value = status;
  orders.value = await api.orders(status);
}
function startTicker() {
  // 定时刷新"待支付剩余时间"展示
  if (!ticker.value)
    ticker.value = setInterval(() => (now.value = Date.now()), 30_000);
}
function stopTicker() {
  if (ticker.value) {
    clearInterval(ticker.value);
    ticker.value = undefined;
  }
}
function countdownText(order: Order): string {
  const remaining =
    new Date(order.createdAt).getTime() + PAY_WINDOW_MS - now.value;
  if (remaining <= 0) return "支付超时，订单即将关闭";
  const minutes = Math.floor(remaining / 60_000),
    seconds = Math.floor((remaining % 60_000) / 1000);
  return `剩 ${minutes}:${String(seconds).padStart(2, "0")} 自动关闭`;
}
async function pay(order: Order) {
  if (paying.value) return;
  paying.value = order.id;
  try {
    const paid = await startPayFlow(order.id);
    if (paid) {
      uni.showToast({ title: "支付成功", icon: "success" });
      await load(active.value);
    } else {
      // 取消/失败：跳详情页提供"继续支付"入口，不留死路
      uni.showToast({ title: "支付未完成，可继续支付", icon: "none" });
      uni.navigateTo({ url: `/pages/orders/detail?id=${order.id}` });
    }
  } finally {
    paying.value = "";
  }
}
onShow(() => {
  startTicker();
  load(active.value);
});
onHide(stopTicker);
onUnload(stopTicker);
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
    ><view v-if="!orders.length" class="empty"
      ><text class="empty__mark">空</text
      ><text class="empty__title">这里还没有订单</text
      ><text class="muted">第一袋快乐，正在首页等你</text></view
    ><view
      v-for="order in orders"
      :key="order.id"
      class="order card"
      @tap="uni.navigateTo({ url: `/pages/orders/detail?id=${order.id}` })"
      ><view class="order__head"
        ><text>订单 {{ order.orderNo.slice(-8) }}</text
        ><text class="order__status">{{ order.statusText }}</text></view
      ><view class="order__goods"
        ><image
          v-for="line in order.items.slice(0, 3)"
          :key="line.product.id"
          :src="line.product.image"
          mode="aspectFit"
        /><text class="muted"
          >共 {{ order.items.reduce((n, i) => n + i.quantity, 0) }} 件</text
        ></view
      ><view class="order__bottom"
        ><text>{{ order.estimatedArrival }}</text
        ><text class="order__price"
          >实付 ¥{{ fenToYuan(order.payableAmount) }}</text
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
    ></view
  >
  <CartOverlay />
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
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
  min-height: 64rpx;
  line-height: 64rpx;
  margin: 0;
  padding: 0 34rpx;
  background: $primary;
  color: #fff;
  font-size: 24rpx;
  font-weight: 800;
  border-radius: 32rpx;
}
.order__pay-btn[disabled] {
  opacity: 0.6;
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
</style>
