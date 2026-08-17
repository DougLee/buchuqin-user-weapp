<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import { fenToYuan } from "../../utils/money";
import type { Order } from "../../types";
const orderId = ref(""),
  order = ref<Order>(),
  cancelVisible = ref(false),
  cancelReason = ref(""),
  cancelling = ref(false);
const cancelReasons = ["拍错了", "不想要了", "地址填错了", "其他"];
onLoad(async (q) => {
  orderId.value = String(q?.id || "");
  if (orderId.value) order.value = await api.order(orderId.value);
});
function goHome() {
  uni.switchTab({ url: "/pages/index/index" });
}
function openCancel() {
  cancelReason.value = cancelReasons[0];
  cancelVisible.value = true;
}
async function confirmCancel() {
  if (!order.value || cancelling.value) return;
  cancelling.value = true;
  try {
    await api.cancelOrder(order.value.id);
    cancelVisible.value = false;
    uni.showToast({ title: "订单已取消", icon: "success" });
    setTimeout(() => uni.switchTab({ url: "/pages/orders/index" }), 600);
  } finally {
    cancelling.value = false;
  }
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
        @tap="openCancel"
        >取消订单</button
      ></view
    ><view
      v-if="cancelVisible"
      class="mask"
      @tap="cancelVisible = false"
      ><view class="sheet" @tap.stop
        ><text class="sheet__title">取消原因</text
        ><view
          v-for="reason in cancelReasons"
          :key="reason"
          class="sheet__opt"
          :class="{ 'sheet__opt--active': cancelReason === reason }"
          @tap="cancelReason = reason"
          ><text>{{ reason }}</text
          ><text class="sheet__mark">✓</text></view
        ><view class="sheet__btns"
          ><button class="sheet__btn" @tap="cancelVisible = false"
            >再想想</button
          ><button
            class="sheet__btn sheet__btn--danger"
            :disabled="cancelling"
            @tap="confirmCancel"
            >{{ cancelling ? "正在取消…" : "确认取消" }}</button
          ></view
        ></view
      ></view
    ></view
  >
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
.mask {
  position: fixed;
  inset: 0;
  background: rgba(20, 30, 24, 0.45);
  display: flex;
  align-items: flex-end;
  z-index: 30;
}
.sheet {
  width: 100%;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx 28rpx 48rpx;
}
.sheet__title {
  display: block;
  font-size: 32rpx;
  font-weight: 900;
  text-align: center;
  margin-bottom: 16rpx;
}
.sheet__opt {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 96rpx;
  border-bottom: 2rpx solid $line;
  font-weight: 600;
}
.sheet__mark {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid $line;
  border-radius: 50%;
  color: transparent;
  font-size: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet__opt--active {
  color: $primary-dark;
  .sheet__mark {
    background: $primary;
    border-color: $primary;
    color: #fff;
  }
}
.sheet__btns {
  display: flex;
  gap: 18rpx;
  margin-top: 28rpx;
}
.sheet__btn {
  flex: 1;
  min-height: 88rpx;
  border-radius: 44rpx;
  background: $primary-soft;
  color: $primary-dark;
  font-weight: 800;
  margin: 0;
}
.sheet__btn--danger {
  background: #fff;
  color: #d4482a;
  border: 2rpx solid #f2c4b5;
}
</style>
