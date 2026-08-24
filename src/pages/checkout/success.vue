<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import { fenToYuan } from "../../utils/money";
import type { Banner, Order } from "../../types";
const orderId = ref(""),
  order = ref<Order>(),
  cancelling = ref(false),
  /** 订单卡加载中（2026-08-24）：拉单期间给同构占位，卡片不突兀弹入 */
  loading = ref(true),
  /** 支付成功页广告位（IKA57E）：未配置为 null，区域整体不渲染 */
  ad = ref<Banner | null>(null);
onLoad(async (q) => {
  orderId.value = String(q?.id || "");
  // 广告位拉取失败静默（不影响支付结果展示）
  api
    .paySuccessBanner()
    .then((banner) => (ad.value = banner))
    .catch(() => {});
  try {
    if (orderId.value) order.value = await api.order(orderId.value);
  } finally {
    loading.value = false;
  }
});
/** 广告点击进图文详情（IKA57E）：复用 Banner 图文基建，storage 传参 */
function openAd() {
  if (!ad.value) return;
  uni.setStorageSync("bannerContent", JSON.stringify(ad.value));
  uni.navigateTo({ url: "/pages/content/detail" });
}
function goHome() {
  // IK9SNY：switchTab 失败（极端栈状态）兜底 reLaunch，确保落到首页而非上一页
  uni.switchTab({
    url: "/pages/index/index",
    fail: () => uni.reLaunch({ url: "/pages/index/index" }),
  });
}
/**
 * 取消确认（IK9AWR）：后端 cancel 接口暂无 reason 字段，
 * 原原因选择弹窗收集后不上传属 UI 表演，已移除；接口支持后再恢复选择并上传。
 * G2（2026-08-19 grilling）：仅待支付可取消；已支付订单按 ADR-0004 走客服，
 * 不再显示取消入口（原"按支付渠道发起退款"文案与后端 400 事实矛盾）。
 */
function openCancel() {
  uni.showModal({
    title: "取消订单",
    content: "订单尚未支付，取消后直接关闭",
    confirmColor: "#d4380d",
    success: async (m) => {
      if (!m.confirm || !order.value || cancelling.value) return;
      cancelling.value = true;
      try {
        await api.cancelOrder(order.value.id);
        uni.showToast({ title: "订单已取消", icon: "success" });
        // IKAHBQ：订单已非 tab 页，改 navigateTo
        setTimeout(() => uni.navigateTo({ url: "/pages/orders/index" }), 600);
      } finally {
        cancelling.value = false;
      }
    },
  });
}
</script>
<template>
  <view class="page success"
    ><view class="banner"
      ><view class="banner__check">✓</view
      ><text class="banner__title">支付成功</text
      ><text class="banner__sub"
        >这一袋已经从校园仓出发接力，留意消息通知</text
      ></view
    ><!-- 订单卡骨架（2026-08-24）：三行同构占位 --><view
      v-if="loading"
      class="order success-skeleton"
      ><view v-for="n in 3" :key="n" class="success-skeleton__row" /></view
    ><view v-else-if="order" class="order card"
      ><view class="order__row"
        ><text class="muted">订单编号</text
        ><text>{{ order.orderNo }}</text></view
      ><view class="order__row"
        ><text class="muted">实付金额</text
        ><text class="order__amount"
          >¥{{ fenToYuan(order.payableAmount) }}</text
        ></view
      ><view class="order__row"
        ><text class="muted">送达寝室</text
        ><text
          >{{ order.address.buildingName }} · {{ order.address.room }}</text
        ></view
      ></view
    ><!-- 支付成功页广告位（IKA57E）：后台配置 placement=pay-success 的 Banner，未配置不占位 -->
    <view v-if="ad" class="ad card" role="button" @tap="openAd"
      ><image class="ad__image" :src="ad.image ?? ''" mode="aspectFill" /><view
        class="ad__meta"
        ><text class="ad__title">{{ ad.title }}</text
        ><text v-if="ad.subtitle" class="ad__sub">{{ ad.subtitle }}</text
        ><text class="ad__go">查看详情 ›</text></view
      ></view
    ><view class="actions safe-bottom"
      ><button class="primary-btn actions__home" @tap="goHome"
        >返回首页</button
      ><button
        v-if="order?.status === 'pending-payment'"
        class="actions__cancel"
        :disabled="cancelling"
        @tap="openCancel"
        >{{ cancelling ? "正在取消…" : "取消订单" }}</button
      ></view
    ></view
  >
  <CartOverlay />
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64rpx 40rpx 48rpx;
}
.banner__check {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary, $primary-dark);
  color: #fff;
  font-size: 64rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 32rpx rgba(7, 136, 59, 0.28);
}
.banner__title {
  font-size: 44rpx;
  font-weight: 900;
  margin-top: 28rpx;
}
.banner__sub {
  color: $muted;
  margin-top: 12rpx;
}
.order {
  padding: 28rpx;
}
/* 订单卡骨架（2026-08-24）：shimmer 与全端同款 */
.success-skeleton__row {
  height: 44rpx;
  border-radius: 12rpx;
  margin: 22rpx 0;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: success-pulse 1.2s infinite;
}
@keyframes success-pulse {
  50% {
    opacity: 0.55;
  }
}
/* 广告位（IKA57E）：左图右文横条，点击进图文详情 */
.ad {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  overflow: hidden;
}
.ad__image {
  width: 168rpx;
  height: 120rpx;
  border-radius: 16rpx;
  flex-shrink: 0;
  background: $line;
}
.ad__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6rpx;
}
.ad__title {
  font-size: 28rpx;
  font-weight: 700;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ad__sub {
  font-size: 24rpx;
  color: $muted;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ad__go {
  font-size: 24rpx;
  color: $primary;
  font-weight: 600;
}
.order__row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
}
.order__amount {
  font-weight: 900;
  color: $primary-dark;
}
.actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 18rpx 28rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-shadow: 0 -10rpx 30rpx rgba(21, 75, 38, 0.09);
  z-index: 20;
}
.actions button {
  margin: 0;
  width: 100%;
}
.actions__home {
  min-height: 96rpx;
  font-size: 32rpx;
}
.actions__cancel {
  min-height: 80rpx;
  background: transparent;
  color: #9aa39d;
  font-size: 26rpx;
}
.actions__cancel::after {
  border: none;
}
</style>
