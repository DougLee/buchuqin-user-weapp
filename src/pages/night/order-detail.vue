<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { isRetryable } from "../../api/request";
import { nightApi } from "../../api/night";
import { fenToYuan } from "../../utils/money";
import { startNightPayFlow } from "../../utils/nightPayment";
import { setupDefaultShare } from "../../utils/share";
import type { NightOrder } from "../../types/night";
import { NIGHT_AFTER_SALE_TYPES } from "../../utils/nightAfterSale";

/**
 * 夜宵订单详情（IKSW1F）：夜宵单独立标识 + 轻量状态时间线。
 * - 待支付：继续支付（timeoutAt 倒计时）/ 取消（直接关单）；
 * - 已支付未接单：取消（货款原路退回）；
 * - 已送达：确认收货（completed，佣金转待结算）；
 * - 已送达/已完成：售后申请（一期轻量：类型+文字描述，退款服务端处理）；
 * - 售后处理中（afterSaleStatus=requested）：徽标提示 + 隐藏重复入口。
 */
setupDefaultShare();
const orderId = ref("");
const order = ref<NightOrder>();
const paying = ref(false);
const confirming = ref(false);
const loading = ref(true);
const error = ref(false);
const nowTick = ref(Date.now());
const payTimer = setInterval(() => (nowTick.value = Date.now()), 30_000);
onUnmounted(() => clearInterval(payTimer));

onLoad((q) => {
  orderId.value = String(q?.id || "");
});
onShow(() => {
  refresh();
});
async function refresh() {
  if (!orderId.value) return;
  loading.value = !order.value;
  error.value = false;
  try {
    order.value = await nightApi.order(orderId.value);
  } catch (e) {
    if (isRetryable(e)) error.value = true;
  } finally {
    loading.value = false;
  }
}
/** 待支付倒计时（timeoutAt 服务端下发） */
function countdownText(): string {
  const timeoutAt = order.value?.timeoutAt;
  if (!timeoutAt) return "";
  const remaining = new Date(timeoutAt).getTime() - nowTick.value;
  if (remaining <= 0) return "支付超时，订单即将关闭";
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `剩 ${minutes}:${String(seconds).padStart(2, "0")} 自动关闭`;
}
async function payAgain() {
  if (!order.value || paying.value) return;
  paying.value = true;
  try {
    const paid = await startNightPayFlow(order.value.id, order.value.store?.id);
    if (paid) {
      uni.showToast({ title: "支付成功", icon: "success" });
      await refresh();
    } else {
      uni.showToast({ title: "支付未完成，可稍后再试", icon: "none" });
      await refresh();
    }
  } finally {
    paying.value = false;
  }
}
/** 取消：待支付直接关单；已支付未接单全额原路退款（接单后不可取消） */
async function cancel() {
  if (!order.value) return;
  const paid = !!order.value.paidAt;
  const res = await uni.showModal({
    title: "确认取消订单？",
    content: paid
      ? "已支付未接单，取消后货款将原路退回"
      : "订单尚未支付，取消后将直接关闭",
  });
  if (!res.confirm) return;
  order.value = await nightApi.cancelOrder(order.value.id, "用户取消");
  uni.showToast({ title: "订单已取消", icon: "success" });
}
async function confirmReceipt() {
  if (!order.value || confirming.value) return;
  const res = await uni.showModal({
    title: "确认收货？",
    content: "确认后订单完成，楼长佣金随之结算",
  });
  if (!res.confirm) return;
  confirming.value = true;
  try {
    order.value = await nightApi.confirmOrder(order.value.id);
    uni.showToast({ title: "已完成", icon: "success" });
  } finally {
    confirming.value = false;
  }
}
/* ---------- 售后申请（一期轻量：类型 + 文字描述） ---------- */
const sheetOpen = ref(false);
const saleType = ref("missing");
const saleDesc = ref("");
const saleSubmitting = ref(false);
function openAfterSale() {
  saleType.value = "missing";
  saleDesc.value = "";
  sheetOpen.value = true;
}
async function submitAfterSale() {
  if (!order.value || saleSubmitting.value) return;
  if (saleDesc.value.trim().length < 5) {
    uni.showToast({ title: "请简单描述遇到的问题", icon: "none" });
    return;
  }
  saleSubmitting.value = true;
  try {
    await nightApi.applyAfterSale(order.value.id, {
      type: saleType.value,
      description: saleDesc.value.trim(),
    });
    sheetOpen.value = false;
    uni.showToast({ title: "售后申请已提交", icon: "success" });
    await refresh();
  } finally {
    saleSubmitting.value = false;
  }
}
function backHome() {
  uni.switchTab({
    url: "/pages/index/index",
    fail: () => uni.reLaunch({ url: "/pages/index/index" }),
  });
}
const canAfterSale = () =>
  !!order.value &&
  ["delivered", "completed"].includes(order.value.status) &&
  !order.value.afterSaleStatus;
</script>

<template>
  <view v-if="error" class="page detail"
    ><view class="detail-retry card" @tap="refresh"
      ><text class="detail-retry__title">夜宵订单加载失败</text
      ><text class="muted">网络异常或订单不存在，点击重试</text></view
    ></view
  >
  <view v-else-if="loading && !order" class="page detail"
    ><view class="detail-skeleton"
      ><view v-for="n in 3" :key="n" class="skeleton-block" /></view
  ></view>
  <view v-else-if="order" class="page detail"
    ><!-- 夜宵单状态头：夜色渐变与白天单强区分 -->
    <view class="status"
      ><view class="status__row"
        ><text class="status__eyebrow">🌙 夜宵订单</text
        ><text
          v-if="order.afterSaleStatus === 'requested'"
          class="status__sale"
          >售后处理中</text
        ></view
      ><text class="status__title">{{ order.statusText }}</text
      ><text class="status__sub">{{
        order.status === "pending-payment"
          ? countdownText() || "15 分钟内完成支付，超时订单将自动关闭"
          : order.status === "pending-accept"
            ? "楼长确认后立即配送，请保持手机畅通"
            : order.status === "delivering"
              ? "楼长正在送往寝室的路上"
              : order.status === "delivered"
                ? "已送达寝室门口，请确认收货"
                : order.status === "cancelled"
                  ? order.cancelReason || "订单已取消"
                  : "感谢信任，夜宵愉快"
      }}</text></view
    ><!-- 时间线：服务端 timeline 透传（submit/paid/accept/delivered/completed…） -->
    <view class="timeline card"
      ><view
        v-for="(step, i) in order.timeline"
        :key="step.key + String(i)"
        class="step"
        ><view class="step__rail"
          ><view class="step__dot" /><view
            v-if="i < order.timeline.length - 1"
            class="step__line" /></view
        ><view
          ><text class="step__title">{{ step.title }}</text
          ><text v-if="step.time" class="step__time">{{
            step.time.slice(5, 16).replace("T", " ")
          }}</text></view
        ></view
      ></view
    ><view class="address card"
      ><text class="address__label">送达寝室</text
      ><text class="address__main"
        >{{ order.address.buildingName }} · {{ order.address.room }}</text
      ><text class="muted"
        >{{ order.address.contactName }} {{ order.address.phone }}</text
      ></view
    ><view class="summary card"
      ><view v-for="line in order.items" :key="line.nightProductId"
        ><text>{{ line.name }} × {{ line.quantity }}</text
        ><text>¥{{ fenToYuan(line.price * line.quantity) }}</text></view
      ><view
        ><text>配送费</text
        ><text>¥{{ fenToYuan(order.deliveryFee) }}</text></view
      ><view v-if="order.couponDiscount > 0" class="summary__coupon"
        ><text>{{ order.couponSnapshot?.name || "夜宵券" }}</text
        ><text>−¥{{ fenToYuan(order.couponDiscount) }}</text></view
      ><view class="summary__total"
        ><text>{{ order.paidAt ? "实付" : "应付" }}</text
        ><text>¥{{ fenToYuan(order.payableAmount) }}</text></view
      ><text class="muted summary__no">夜宵单号 {{ order.orderNo }}</text></view
    ><!-- 操作区吸底：语义配色沿用白天单（绿=推进/资金、白底描边=逆向、浅绿=导航） -->
    <view class="action-bar"
      ><view class="action-bar__row"
        ><button
          v-if="order.status === 'pending-payment' || order.status === 'pending-accept'"
          class="bar-btn bar-btn--ghost"
          @tap="cancel"
        >
          {{ order.paidAt ? "取消并退款" : "取消订单" }}</button
        ><button
          v-if="order.status !== 'pending-payment'"
          class="bar-btn bar-btn--soft"
          @tap="backHome"
        >
          返回首页</button
        ><button
          v-if="order.status === 'pending-payment'"
          class="bar-btn bar-btn--primary"
          :disabled="paying"
          @tap="payAgain"
        >
          {{ paying ? "正在拉起支付…" : "继续支付" }}</button
        ><button
          v-if="order.status === 'delivered'"
          class="bar-btn bar-btn--primary"
          :disabled="confirming"
          @tap="confirmReceipt"
        >
          {{ confirming ? "正在确认…" : "确认收货" }}</button
        ></view
      ><!-- 售后入口（送达/完成且无进行中售后；requested 期间状态头已出徽标） -->
      <view v-if="canAfterSale()" class="action-bar__svc"
        ><button class="svc-btn" @tap="openAfterSale"
          ><view class="svc-icon" /><text>申请售后（缺货／破损等）</text></button
        ></view
      ></view
    ><!-- 售后申请弹层（一期轻量：类型+文字，退款由服务端处理） -->
    <view v-if="sheetOpen" class="sheet-mask" @tap="sheetOpen = false">
      <view class="sheet" @tap.stop>
        <text class="sheet__title">申请售后</text>
        <text class="sheet__sub"
          >楼长送到寝室后发现问题可申请，退款由平台核实后原路退回</text
        >
        <view class="sheet__options"
          ><view
            v-for="item in NIGHT_AFTER_SALE_TYPES"
            :key="item[0]"
            class="sheet__option"
            :class="{ 'sheet__option--active': saleType === item[0] }"
            @tap="saleType = item[0]"
            >{{ item[1] }}</view
          ></view
        >
        <textarea
          v-model="saleDesc"
          class="sheet__textarea"
          :maxlength="300"
          placeholder="请说明遇到的问题（缺货／破损／少送等），至少 5 个字"
        />
        <button
          class="primary-btn sheet__submit"
          :disabled="saleSubmitting || saleDesc.trim().length < 5"
          @tap="submitAfterSale"
        >
          {{ saleSubmitting ? "提交中…" : "提交申请" }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import "../../styles/theme.scss";
.page.detail {
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom));
}
.status {
  background: linear-gradient(135deg, #1e2520 0%, #17332a 70%, #0d5d31 160%);
  color: #fff;
  border-radius: 34rpx;
  padding: 42rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 14rpx 32rpx rgba(10, 34, 24, 0.26);
}
.status__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.status__eyebrow {
  color: #ffe082;
  font-weight: 800;
}
.status__sale {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 122, 33, 0.18);
  border: 2rpx solid rgba(255, 122, 33, 0.5);
  color: #ffb37e;
  font-size: 21rpx;
  font-weight: 700;
}
.status__title {
  display: block;
  font-size: 48rpx;
  font-weight: 900;
  margin: 18rpx 0;
}
.status__sub {
  display: block;
  opacity: 0.86;
}
.timeline {
  padding: 32rpx;
}
.step {
  display: flex;
  gap: 24rpx;
  min-height: 110rpx;
  color: #667069;
}
.step__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.step__dot {
  width: 26rpx;
  height: 26rpx;
  margin-top: 8rpx;
  border-radius: 50%;
  background: #1e2520;
  border: 3rpx solid rgba(255, 224, 130, 0.6);
}
.step__line {
  width: 3rpx;
  flex: 1;
  background: $line;
}
.step__title {
  display: block;
  font-weight: 900;
  font-size: 30rpx;
  color: $ink;
}
.step__time {
  display: block;
  font-size: 21rpx;
  color: #9aa39d;
  margin-top: 6rpx;
}
.address,
.summary {
  padding: 28rpx;
  margin-top: 22rpx;
}
.address {
  border-left: 7rpx solid #17332a;
}
.address__label {
  display: block;
  color: #1d5c3c;
  font-size: 22rpx;
  font-weight: 800;
}
.address__main {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
  margin: 10rpx 0;
}
.summary > view {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
}
.summary__coupon {
  color: $primary-dark;
}
.summary__total {
  border-top: 2rpx dashed $line;
  margin-top: 12rpx;
  padding-top: 22rpx !important;
  font-size: 34rpx;
  font-weight: 900;
  color: $primary-dark;
}
.summary__no {
  display: block;
  padding-top: 14rpx;
  font-size: 21rpx;
}
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  background: #fff;
  border-top: 2rpx solid rgba(32, 74, 45, 0.08);
  box-shadow: 0 -6rpx 24rpx rgba(21, 75, 38, 0.06);
  padding: 12rpx 28rpx calc(12rpx + env(safe-area-inset-bottom));
}
.action-bar__row {
  display: flex;
  gap: 18rpx;
}
.bar-btn {
  flex: 1;
  min-height: 88rpx;
  margin: 0;
  padding: 0 20rpx;
  border: 0;
  border-radius: 44rpx;
  font-size: 29rpx;
  font-weight: 700;
  line-height: 1.2;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: transparent;
}
.bar-btn::after {
  border: none;
}
.bar-btn--primary {
  flex: 1.5;
  background: linear-gradient(135deg, $primary-dark, $primary);
  color: #fff;
  box-shadow: 0 10rpx 24rpx rgba(7, 136, 59, 0.18);
}
.bar-btn--ghost {
  background: #fff;
  border: 2rpx solid $line;
  color: #566159;
}
.bar-btn--soft {
  background: $primary-soft;
  color: $primary-dark;
}
.bar-btn[disabled] {
  opacity: 0.65;
}
/* 售后次级按钮：浅绿底描边胶囊（与白天单 svc-btn 同语言，降档于主按钮） */
.action-bar__svc {
  display: flex;
  justify-content: center;
  margin-top: 14rpx;
}
.svc-btn {
  flex: 0 0 auto;
  min-width: 320rpx;
  min-height: 76rpx;
  margin: 0;
  padding: 0 26rpx;
  border: 2rpx solid rgba(7, 136, 59, 0.35);
  border-radius: 40rpx;
  background: $primary-soft;
  color: $primary-dark;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  box-sizing: border-box;
  box-shadow: 0 4rpx 14rpx rgba(7, 136, 59, 0.1);
}
.svc-btn::after {
  border: none;
}
.svc-btn:active {
  transform: translateY(2rpx);
  background: #ddf3da;
}
/* 纯 CSS 盾牌图标（不用 emoji） */
.svc-icon {
  flex: 0 0 auto;
  width: 22rpx;
  height: 26rpx;
  border: 3rpx solid currentColor;
  border-radius: 5rpx 5rpx 11rpx 11rpx;
}
.detail-retry {
  padding: 120rpx 30rpx;
  text-align: center;
}
.detail-retry__title {
  display: block;
  font-weight: 900;
  color: $primary-dark;
  margin-bottom: 8rpx;
}
.detail-skeleton {
  padding-top: 10rpx;
}
.skeleton-block {
  height: 220rpx;
  border-radius: 28rpx;
  margin-bottom: 22rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: detail-pulse 1.2s infinite;
}
@keyframes detail-pulse {
  50% {
    opacity: 0.55;
  }
}
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(20, 30, 24, 0.45);
  z-index: 99;
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  background: #fff;
  border-radius: 34rpx 34rpx 0 0;
  padding: 38rpx 34rpx calc(38rpx + env(safe-area-inset-bottom));
}
.sheet__title {
  display: block;
  font-size: 36rpx;
  font-weight: 900;
}
.sheet__sub {
  display: block;
  color: #667069;
  font-size: 23rpx;
  margin-top: 10rpx;
}
.sheet__options {
  display: flex;
  gap: 14rpx;
  flex-wrap: wrap;
  margin-top: 26rpx;
}
.sheet__option {
  min-height: 72rpx;
  padding: 14rpx 26rpx;
  border: 2rpx solid $line;
  border-radius: 36rpx;
  font-size: 25rpx;
  display: flex;
  align-items: center;
}
.sheet__option--active {
  background: #1e2520;
  color: #ffe082;
  border-color: #1e2520;
}
.sheet__textarea {
  width: 100%;
  height: 200rpx;
  background: $paper;
  border: 2rpx solid $line;
  border-radius: 22rpx;
  padding: 20rpx;
  margin-top: 24rpx;
  line-height: 1.6;
  box-sizing: border-box;
}
.sheet__submit {
  margin-top: 28rpx;
}
</style>
