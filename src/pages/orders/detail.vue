<script setup lang="ts">
import { ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useCartStore } from "../../stores/cart";
import { useCampusStore } from "../../stores/campus";
import { isRetryable } from "../../api/request";
import { fenToYuan } from "../../utils/money";
import { preloadPayTemplates, startPayFlow } from "../../utils/payment";
import ServiceSheet from "../../components/ServiceSheet.vue";
import type { Order } from "../../types";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
const campusStore = useCampusStore(),
  /** IKKTWM 客服弹层（替代 open-type=contact） */
  serviceOpen = ref(false),
  orderId = ref(""),
  order = ref<Order>(),
  confirming = ref(false),
  paying = ref(false),
  /** 三态（IK9AWK）：加载骨架 + 错误重试 */
  loading = ref(true),
  error = ref(false);
// onShow 每次进页都拉最新进度（从支付页/列表返回、后台推进状态后都能看到新状态）
onLoad((q) => {
  orderId.value = String(q?.id || "");
});
onShow(() => {
  void preloadPayTemplates();
  refresh();
});
async function refresh() {
  if (!orderId.value) return;
  loading.value = !order.value;
  error.value = false;
  try {
    order.value = await api.order(orderId.value);
  } catch (e) {
    // ADR-0005(IKA00Q)：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
    if (isRetryable(e)) error.value = true;
  } finally {
    loading.value = false;
  }
}
async function cancel() {
  if (!order.value) return;
  const res = await uni.showModal({
    title: "确认取消订单？",
    content: "订单尚未支付，取消后将直接关闭",
  });
  if (res.confirm) order.value = await api.cancelOrder(order.value.id);
}
/** 未发货退款（IKHZKA）：已支付未出库可申请；原因必填（道哥 2026-09-23 改），弹层表单校验 */
const refundSheet = ref(false),
  refundReason = ref(""),
  refundSubmitting = ref(false);
function openRefundSheet() {
  refundReason.value = "";
  refundSheet.value = true;
}
async function submitRefund() {
  if (!order.value || refundSubmitting.value) return;
  const reason = refundReason.value.trim();
  if (!reason) {
    uni.showToast({ title: "请填写退款原因", icon: "none" });
    return;
  }
  refundSubmitting.value = true;
  try {
    await api.applyRefund(order.value.id, reason);
    refundSheet.value = false;
    uni.showToast({ title: "已提交，等待审核", icon: "success" });
    await refresh();
  } finally {
    refundSubmitting.value = false;
  }
}
/** 售后申请入口（IKHZKA v2）：送达后 24h 内可申请，勾选商品支持部分退款 */
function applyAfterSale() {
  if (!order.value) return;
  uni.navigateTo({
    url: `/pages/after-sales/apply?orderId=${order.value.id}`,
  });
}
/** 撤销退款申请（审核前可撤，订单回到原状态） */
async function cancelRefund() {
  if (!order.value) return;
  const res = await uni.showModal({
    title: "撤销退款申请？",
    content: "撤销后订单将继续正常履约",
  });
  if (!res.confirm) return;
  const list = await api.refunds();
  const mine = list.find((r) => r.orderId === order.value!.id);
  if (!mine) {
    uni.showToast({ title: "未找到退款申请", icon: "none" });
    return;
  }
  await api.cancelAfterSale(mine.id);
  uni.showToast({ title: "已撤销", icon: "success" });
  await refresh();
}
async function payAgain() {
  if (!order.value || paying.value) return;
  paying.value = true;
  try {
    const paid = await startPayFlow(order.value.id);
    if (paid) {
      uni.showToast({ title: "支付成功", icon: "success" });
      // 支付成功清空本地购物车（IKA08U，服务端落账时已清）
      useCartStore().clearLocal();
      await refresh();
    } else {
      uni.showToast({ title: "支付未完成，可稍后再试", icon: "none" });
      await refresh();
    }
  } finally {
    paying.value = false;
  }
}
async function confirmReceipt() {
  if (!order.value || confirming.value) return;
  confirming.value = true;
  try {
    order.value = await api.confirmReceipt(order.value.id);
    uni.showToast({ title: "已确认收货，订单完成", icon: "success" });
  } finally {
    confirming.value = false;
  }
}
function backHome() {
  // IK9SNY：switchTab 失败兜底 reLaunch，确保落到首页而非上一页
  uni.switchTab({
    url: "/pages/index/index",
    fail: () => uni.reLaunch({ url: "/pages/index/index" }),
  });
}
</script>
<template>
  <view v-if="error" class="page detail"
    ><view class="detail-retry card" @tap="refresh"
      ><text class="detail-retry__title">订单加载失败</text
      ><text class="muted">网络异常或订单不存在，点击重试</text></view
    ></view
  >
  <view v-else-if="loading && !order" class="page detail"
    ><view class="detail-skeleton"
      ><view v-for="n in 3" :key="n" class="skeleton-block" /></view
  ></view>
  <view v-else-if="order" class="page detail"
    ><view class="status" :class="{ 'status--exception': order.status === 'exception' }"
      ><text class="status__eyebrow">{{ order.estimatedArrival }}</text
      ><text class="status__title">{{ order.statusText }}</text
      ><text class="status__sub">{{
        order.status === "exception"
          ? `别担心，客服正在跟进处理，可来电 ${campusStore.phone}`
          : order.status === "pending-payment"
            ? "15 分钟内完成支付，超时订单将自动关闭"
            : "你的这一袋，正在校园里接力"
      }}</text></view
    ><view class="timeline card"
      ><view
        v-for="(step, i) in order.timeline"
        :key="step.key"
        class="step"
        :class="{ 'step--done': step.done }"
        ><view class="step__rail"
          ><view class="step__dot">{{ i + 1 }}</view
          ><view
            v-if="i < order.timeline.length - 1"
            class="step__line" /></view
        ><view
          ><text class="step__title">{{ step.title }}</text
          ><text class="step__desc">{{ step.description }}</text
          ><text v-if="step.time" class="step__time">{{
            step.time.slice(11, 16)
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
      ><view v-for="line in order.items" :key="line.product.id"
        ><text>{{ line.product.name }} × {{ line.quantity }}</text
        ><text
          >¥{{ fenToYuan(line.product.price * line.quantity) }}</text
        ></view
      ><view class="summary__total"
        ><text>实付</text
        ><text>¥{{ fenToYuan(order.payableAmount) }}</text></view
      ></view
    ><!-- 操作区吸底（道哥 2026-10-11；2026-10-15 道哥反馈售后/客服文字链
        太不显眼）：按钮按语义配色——绿=推进/资金（继续支付/确认收货）、
        橙=需人工介入（异常单联系客服）、白底描边=逆向操作（取消/退款类）、
        浅绿=导航（返回首页，待支付态让位取消）；售后/客服由文字链升级为
        白底描边次级胶囊按钮，紧邻主按钮组下方，高度/字号降档维持
        「主操作 > 服务动作」层级；异常单不重复出服务入口（已有
        「联系客服处理」主按钮） -->
    <view class="action-bar"
      ><view class="action-bar__row"
        ><button
          v-if="order.status === 'pending-payment'"
          class="bar-btn bar-btn--ghost"
          @tap="cancel"
        >
          取消订单</button
        ><!-- 未发货退款（IKHZKA）：已支付未出库可申请 --><button
          v-if="order.status === 'paid'"
          class="bar-btn bar-btn--ghost"
          @tap="openRefundSheet"
        >
          申请退款</button
        ><!-- 审核中可撤销 --><button
          v-if="order.status === 'after-sales'"
          class="bar-btn bar-btn--ghost"
          @tap="cancelRefund"
        >
          撤销退款申请</button
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
        ><!-- 异常单：警示橙，人工介入优先 --><button
          v-if="order.status === 'exception'"
          class="bar-btn bar-btn--warn"
          @tap="serviceOpen = true"
        >
          联系客服处理</button
        ></view
      ><!-- 售后/客服次级按钮（道哥 2026-10-15）：白底绿描边胶囊+纯 CSS
          图标，紧邻主按钮组下方；申请售后仅送达/完成态出（24h 窗口在
          after-sales 页校验），联系客服开 ServiceSheet 弹层 -->
      <view v-if="order.status !== 'exception'" class="action-bar__svc"
        ><button
          v-if="order.status === 'delivered' || order.status === 'completed'"
          class="svc-btn"
          @tap="applyAfterSale"
          ><view class="svc-icon svc-icon--shield" /><text>申请售后</text></button
        ><button class="svc-btn" @tap="serviceOpen = true"
          ><view class="svc-icon svc-icon--chat" /><text>联系客服</text></button
        ></view
      ></view
    ></view
  >
  <ServiceSheet :visible="serviceOpen" @close="serviceOpen = false" />
  <!-- 未发货退款弹层（IKHZKA）：原因必填 -->
  <view v-if="refundSheet" class="sheet-mask" @tap="refundSheet = false">
    <view class="sheet" @tap.stop>
      <text class="sheet__title">申请退款</text>
      <text class="sheet__sub"
        >退款金额为商品实付（配送费不退），审核通过后原路退回</text
      >
      <textarea
        v-model="refundReason"
        class="sheet__textarea"
        :maxlength="120"
        placeholder="请填写退款原因（必填），例如：下错单了／不想要了"
      />
      <button
        class="primary-btn sheet__submit"
        :disabled="refundSubmitting || !refundReason.trim()"
        @tap="submitRefund"
      >
        {{ refundSubmitting ? "提交中…" : "提交申请" }}
      </button>
    </view>
  </view>
  <CartOverlay />
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.status {
  background: linear-gradient(135deg, $primary-dark, $primary);
  color: #fff;
  border-radius: 34rpx;
  padding: 42rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 14rpx 32rpx rgba(7, 136, 59, 0.2);
}
.status--exception {
  background: linear-gradient(135deg, #b3471e, #e0702f);
  box-shadow: 0 14rpx 32rpx rgba(208, 92, 34, 0.22);
}
.status__eyebrow,
.status__title,
.status__sub {
  display: block;
}
.status__eyebrow {
  color: #dfffe6;
  font-weight: 800;
}
.status__title {
  font-size: 48rpx;
  font-weight: 900;
  margin: 18rpx 0;
}
.status__sub {
  opacity: 0.86;
}
.timeline {
  padding: 32rpx;
}
.step {
  display: flex;
  gap: 24rpx;
  min-height: 132rpx;
  color: #667069;
}
.step--done {
  color: $ink;
}
.step__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.step__dot {
  width: 54rpx;
  height: 54rpx;
  border-radius: 50%;
  border: 3rpx solid $line;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
}
.step--done .step__dot {
  background: $primary;
  color: #fff;
  border-color: $primary;
}
.step__line {
  width: 3rpx;
  flex: 1;
  background: $line;
}
.step--done .step__line {
  background: $primary;
}
.step__title,
.step__desc {
  display: block;
}
.step__title {
  font-weight: 900;
  font-size: 30rpx;
}
.step__desc {
  font-size: 23rpx;
  margin-top: 8rpx;
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
  border-left: 7rpx solid $primary;
}
.address__label {
  display: block;
  color: $primary-dark;
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
.summary__total {
  border-top: 2rpx dashed $line;
  margin-top: 12rpx;
  padding-top: 22rpx !important;
  font-size: 34rpx;
  font-weight: 900;
  color: $primary-dark;
}
/* 吸底操作条（道哥 2026-10-11；2026-10-15 服务入口升级为按钮排）：条体最高
   约 210rpx（主按钮排+服务按钮排+安全区），底部留白多打余量防内容贴条 */
.page.detail {
  padding-bottom: calc(320rpx + env(safe-area-inset-bottom));
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
/* 售后/客服次级按钮（道哥 2026-10-15）：白底绿描边胶囊居中排在主按钮组
   下方，高度/字号比主按钮降一档维持层级；可点高度 76rpx ≥72rpx、字号
   26rpx ≥26rpx（ui-ux-pro-max touch-target/legibility） */
.action-bar__svc {
  display: flex;
  justify-content: center;
  gap: 18rpx;
  margin-top: 14rpx;
}
.svc-btn {
  flex: 0 0 auto;
  min-width: 220rpx;
  min-height: 76rpx;
  margin: 0;
  padding: 0 26rpx;
  border: 2rpx solid rgba(7, 136, 59, 0.35);
  border-radius: 40rpx;
  background: #fff;
  color: $primary-dark;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  box-sizing: border-box;
}
.svc-btn::after {
  border: none;
}
/* 纯 CSS 图标（不用 emoji/图片）：盾牌=售后保障 */
.svc-icon {
  flex: 0 0 auto;
}
.svc-icon--shield {
  width: 22rpx;
  height: 26rpx;
  border: 3rpx solid currentColor;
  border-radius: 5rpx 5rpx 11rpx 11rpx;
}
/* 对话气泡=联系客服：圆角矩形+左下小尾巴（白底盖住气泡底边形成缺口） */
.svc-icon--chat {
  position: relative;
  width: 26rpx;
  height: 20rpx;
  border: 3rpx solid currentColor;
  border-radius: 6rpx;
  background: #fff;
}
.svc-icon--chat::after {
  content: "";
  position: absolute;
  left: 6rpx;
  bottom: -6rpx;
  width: 10rpx;
  height: 10rpx;
  background: #fff;
  border-left: 3rpx solid currentColor;
  border-bottom: 3rpx solid currentColor;
  transform: rotate(45deg);
}
.action-bar__row {
  display: flex;
  gap: 18rpx;
}
/* 吸底条按钮语义四色：绿=推进/资金、橙=人工介入、白底描边=逆向、浅绿=导航 */
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
/* 异常单客服：与 .status--exception 橙同系 */
.bar-btn--warn {
  flex: 1.5;
  background: linear-gradient(135deg, #c85a22, $orange);
  color: #fff;
  box-shadow: 0 10rpx 24rpx rgba(208, 92, 34, 0.2);
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
/* 三态（IK9AWK） */
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
/* 履约中快捷售后弹窗（IK97FI）：底部弹出层 */
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
  background: $primary;
  color: #fff;
  border-color: $primary;
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
