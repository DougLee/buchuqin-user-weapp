<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import { fenToYuan } from "../../utils/money";
import type { Banner, Order } from "../../types";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
const orderId = ref(""),
  order = ref<Order>(),
  cancelling = ref(false),
  /** 订单卡加载中（2026-08-24）：拉单期间给同构占位，卡片不突兀弹入 */
  loading = ref(true),
  /** 支付成功页广告位（IKA57E→IKB87P 大卡版）：最多 2 条，空数组不渲染 */
  ads = ref<Banner[]>([]);
onLoad(async (q) => {
  orderId.value = String(q?.id || "");
  // 广告位拉取失败静默（不影响支付结果展示）
  api
    .paySuccessBanners()
    .then((list) => (ads.value = (list ?? []).slice(0, 2)))
    .catch(() => {});
  try {
    if (orderId.value) order.value = await api.order(orderId.value);
  } finally {
    loading.value = false;
  }
});
/** 广告点击进图文详情（IKA57E）：复用 Banner 图文基建，storage 传参 */
function openAd(banner: Banner) {
  uni.setStorageSync("bannerContent", JSON.stringify(banner));
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
    ><!-- 支付成功页广告位（IKA57E→IKB87P 大卡版）：图上文下，最多 2 条，未配置不占位 -->
    <view v-if="ads.length" class="ads">
      <text class="ads__caption">为你推荐</text>
      <view
        v-for="banner in ads"
        :key="banner.id"
        class="ad card"
        role="button"
        @tap="openAd(banner)"
        ><view
          class="ad__media"
          :class="`ad__media--${banner.color || 'green'}`"
          ><image
            v-if="banner.image"
            class="ad__image"
            :src="banner.image"
            mode="aspectFill"
          /><text v-if="banner.badge" class="ad__badge">{{
            banner.badge
          }}</text></view
        ><view class="ad__meta"
          ><text class="ad__title">{{ banner.title }}</text
          ><text v-if="banner.subtitle" class="ad__sub">{{
            banner.subtitle
          }}</text
          ><text class="ad__go">查看详情 ›</text></view
        ></view
      >
    </view><view class="actions safe-bottom"
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
/* 广告位大卡（IKA57E→IKB87P）：图上文下、图满卡宽，整卡可点；
   IKB5PB 间距保留（与支付信息卡 28rpx），两卡之间 24rpx */
.ads {
  margin-top: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.ads__caption {
  color: $muted;
  font-size: 24rpx;
  padding-left: 4rpx;
}
.ad {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* 媒体区：有图铺图（aspectFill 防跳版），无图落主题色块（角标仍在） */
.ad__media {
  position: relative;
  height: 300rpx;
  background: linear-gradient(135deg, $primary, $primary-dark);
}
.ad__media--orange {
  background: linear-gradient(135deg, #ffa04d, $orange);
}
.ad__media--dark {
  background: linear-gradient(135deg, #3c5a4e, #1f2e28);
}
.ad__image {
  width: 100%;
  height: 100%;
}
.ad__badge {
  position: absolute;
  left: 20rpx;
  top: 20rpx;
  background: rgba(255, 255, 255, 0.94);
  color: $primary-dark;
  font-size: 22rpx;
  font-weight: 700;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
}
.ad__meta {
  padding: 26rpx 28rpx 28rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.ad__title {
  font-size: 32rpx;
  font-weight: 800;
  color: $ink;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ad__sub {
  margin-top: 10rpx;
  font-size: 26rpx;
  color: $muted;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ad__go {
  margin-top: 18rpx;
  font-size: 26rpx;
  color: $primary;
  font-weight: 700;
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
