<script setup lang="ts">
import { reactive, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { fenToYuan } from "../../utils/money";
import { startPayFlow } from "../../utils/payment";
import type { Order } from "../../types";
const orderId = ref(""),
  order = ref<Order>(),
  confirming = ref(false),
  paying = ref(false),
  afterSaleOpen = ref(false),
  afterSaleSubmitting = ref(false);
/** 履约中（已拣货及之后、尚未送达）状态：不可取消但可申请售后（IK97FI） */
const IN_FULFILLMENT_STATUSES = [
  "picking",
  "waiting-first-mile",
  "first-mile",
  "waiting-handover",
  "last-mile",
];
/**
 * 快捷售后弹窗的预设选项（IK97FI）。
 * damaged/missing 沿用申请页已有枚举；wrong/other 为新增键，
 * AfterSale.type 契约是自由字符串，若后端后续收敛枚举需对齐。
 */
const AFTER_SALE_OPTIONS: Array<[string, string]> = [
  ["damaged", "商品破损"],
  ["missing", "漏发"],
  ["wrong", "错发"],
  ["other", "其他"],
];
const afterSaleForm = reactive({ type: "damaged", description: "" });
// onShow 每次进页都拉最新进度（从支付页/列表返回、后台推进状态后都能看到新状态）
onLoad((q) => {
  orderId.value = String(q?.id || "");
});
onShow(refresh);
async function refresh() {
  if (!orderId.value) return;
  order.value = await api.order(orderId.value);
}
async function cancel() {
  if (!order.value) return;
  const res = await uni.showModal({
    title: "确认取消订单？",
    content:
      order.value.status === "pending-payment"
        ? "订单尚未支付，将直接关闭"
        : "取消后将按支付渠道发起退款",
  });
  if (res.confirm) order.value = await api.cancelOrder(order.value.id);
}
async function payAgain() {
  if (!order.value || paying.value) return;
  paying.value = true;
  try {
    const paid = await startPayFlow(order.value.id);
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
function afterSale() {
  if (order.value)
    uni.navigateTo({
      url: `/pages/after-sales/apply?orderId=${order.value.id}`,
    });
}
/** 履约中快捷售后：打开预设选项弹窗（IK97FI） */
function openAfterSaleSheet() {
  afterSaleForm.type = "damaged";
  afterSaleForm.description = "";
  afterSaleOpen.value = true;
}
async function submitAfterSale() {
  if (!order.value || afterSaleSubmitting.value) return;
  if (afterSaleForm.description.trim().length < 5) {
    uni.showToast({ title: "请简单说明问题（至少 5 个字）", icon: "none" });
    return;
  }
  afterSaleSubmitting.value = true;
  try {
    // 快捷弹窗不收凭证图，详细凭证可在「售后与退款」补充申请页上传
    await api.createAfterSale(order.value.id, {
      type: afterSaleForm.type,
      description: afterSaleForm.description.trim(),
      images: [],
    });
    afterSaleOpen.value = false;
    uni.showToast({
      title: "已提交，可在「售后与退款」查看",
      icon: "none",
      duration: 2500,
    });
  } finally {
    afterSaleSubmitting.value = false;
  }
}
function backHome() {
  uni.switchTab({ url: "/pages/index/index" });
}
</script>
<template>
  <view v-if="order" class="page detail"
    ><view class="status" :class="{ 'status--exception': order.status === 'exception' }"
      ><text class="status__eyebrow">{{ order.estimatedArrival }}</text
      ><text class="status__title">{{ order.statusText }}</text
      ><text class="status__sub">{{
        order.status === "exception"
          ? "别担心，客服正在跟进处理，可来电 4008002026"
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
    ><button
      v-if="order.status === 'pending-payment'"
      class="primary-btn pay-again"
      :disabled="paying"
      @tap="payAgain"
    >
      {{ paying ? "正在拉起支付…" : "继续支付" }}
    </button
    ><button
      v-if="order.status === 'delivered'"
      class="primary-btn pay-again"
      :disabled="confirming"
      @tap="confirmReceipt"
    >
      {{ confirming ? "正在确认…" : "确认收货" }}
    </button
    ><button
      v-if="['paid', 'pending-payment'].includes(order.status)"
      class="cancel"
      @tap="cancel"
    >
      {{
        order.status === "paid" ? "取消订单并申请退款" : "取消未支付订单"
      }}</button
    ><button
      v-if="IN_FULFILLMENT_STATUSES.includes(order.status)"
      class="cancel"
      @tap="openAfterSaleSheet"
    >
      申请售后
    </button
    ><button
      v-if="['delivered', 'completed'].includes(order.status)"
      class="cancel"
      @tap="afterSale"
    >
      申请质量售后
    </button
    ><button
      v-if="order.status === 'exception'"
      class="cancel"
      @tap="uni.makePhoneCall({ phoneNumber: '4008002026' })"
    >
      联系客服处理
    </button
    ><button class="cancel" @tap="backHome"> 返回首页 </button
    ><view
      v-if="afterSaleOpen"
      class="sheet-mask"
      @tap="afterSaleOpen = false"
      ><view class="sheet" @tap.stop
        ><text class="sheet__title">申请售后</text
        ><text class="sheet__sub">订单正在配送途中，先登记问题，客服会跟进处理</text
        ><view class="sheet__options"
          ><view
            v-for="item in AFTER_SALE_OPTIONS"
            :key="item[0]"
            class="sheet__option"
            :class="{ 'sheet__option--active': afterSaleForm.type === item[0] }"
            @tap="afterSaleForm.type = item[0]"
            >{{ item[1] }}</view
          ></view
        ><textarea
          v-model="afterSaleForm.description"
          class="sheet__textarea"
          maxlength="300"
          placeholder="请简单说明遇到的问题（至少 5 个字）"
        /><button
          class="primary-btn sheet__submit"
          :disabled="afterSaleSubmitting"
          @tap="submitAfterSale"
        >
          {{ afterSaleSubmitting ? "正在提交…" : "提交售后申请" }}
        </button></view
      ></view
    ></view
  >
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
.pay-again {
  margin: 24rpx 0 0;
}
.cancel {
  min-height: 88rpx;
  width: 100%;
  margin-top: 24rpx;
  background: #fff;
  color: #566159;
  border: 2rpx solid $line;
  border-radius: 44rpx;
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
