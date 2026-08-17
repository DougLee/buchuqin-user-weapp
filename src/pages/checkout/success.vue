<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import { fenToYuan } from "../../utils/money";
import type { Order } from "../../types";
const orderId = ref(""),
  order = ref<Order>(),
  cancelling = ref(false);
onLoad(async (q) => {
  orderId.value = String(q?.id || "");
  if (orderId.value) order.value = await api.order(orderId.value);
});
function goHome() {
  uni.switchTab({ url: "/pages/index/index" });
}
/**
 * 取消确认（IK9AWR）：后端 cancel 接口暂无 reason 字段，
 * 原原因选择弹窗收集后不上传属 UI 表演，已移除；接口支持后再恢复选择并上传。
 */
function openCancel() {
  uni.showModal({
    title: "取消订单",
    content:
      order.value?.status === "pending-payment"
        ? "订单尚未支付，取消后直接关闭"
        : "取消后将按支付渠道发起退款",
    confirmColor: "#d4380d",
    success: async (m) => {
      if (!m.confirm || !order.value || cancelling.value) return;
      cancelling.value = true;
      try {
        await api.cancelOrder(order.value.id);
        uni.showToast({ title: "订单已取消", icon: "success" });
        setTimeout(() => uni.switchTab({ url: "/pages/orders/index" }), 600);
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
    ><view v-if="order" class="order card"
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
    ><view class="actions safe-bottom"
      ><button class="primary-btn actions__home" @tap="goHome"
        >返回首页</button
      ><button
        v-if="order && ['paid', 'pending-payment'].includes(order.status)"
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
