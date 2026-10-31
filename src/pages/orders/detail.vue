<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
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
/** IKRSJ3 #115：delivered 态显示 48h 自动确认倒计时（分钟粒度，30s 刷新） */
const nowTick = ref(Date.now());
const autoTimer = setInterval(() => (nowTick.value = Date.now()), 30_000);
onUnmounted(() => clearInterval(autoTimer));
const autoConfirmHint = computed(() => {
  if (order.value?.status !== "delivered") return "";
  const deliveredIso = (order.value.timeline ?? [])
    .filter((s) => s.time)
    .at(-1)?.time;
  if (!deliveredIso) return "";
  const remainMs =
    new Date(deliveredIso).getTime() + 48 * 3600_000 - nowTick.value;
  if (remainMs <= 0) return "即将自动确认收货";
  const h = Math.floor(remainMs / 3600_000);
  const m = Math.floor((remainMs % 3600_000) / 60_000);
  return `如未手动确认，约 ${h} 小时 ${m} 分后自动完成订单`;
});
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
/** 福利群卡（IKQXSD）：道哥 2026-10-28 改定——**不支持关闭**，✕ 收起能力
 *  整体移除（原「本会话记忆可收起」方案废弃），二维码常驻展示 */
/** 送货照片凭证（道哥 2026-10-16）：后端 package 整行透传，送达照/交接照
 *  两组分开渲染；图片为 COS 完整 URL，toAbsoluteUrl 兜底老的相对路径 */
const proofGroups = computed(() => {
  const pkg = order.value?.package;
  const fmt = (iso?: string) =>
    iso ? `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日 ${iso.slice(11, 16)}` : "";
  const groups: Array<{ label: string; images: string[]; remark: string; time: string }> = [];
  const proof = pkg?.proof;
  if (proof?.images?.length)
    groups.push({
      label: "送达照片",
      images: proof.images,
      remark: proof.remark || "",
      time: fmt(proof.time),
    });
  const handover = pkg?.handoverProof;
  if (handover?.images?.length)
    groups.push({
      label: "骑手交接",
      images: handover.images,
      remark: "",
      time: fmt(handover.time),
    });
  return groups;
});
function previewProof(images: string[], current: string) {
  const urls = images.map((img) => api.toAbsoluteUrl(img));
  uni.previewImage({ urls, current: api.toAbsoluteUrl(current) });
}
/** #107 配送人联系链：骑手/楼长（校区开启 showDeliveryContacts 且接口下发
 *  deliveryChain 才有值；成员 null=尚未接单/未指派，前端占位提示） */
const chainRider = computed(() => order.value?.deliveryChain?.rider ?? null);
const chainManager = computed(
  () => order.value?.deliveryChain?.manager ?? null,
);
/** 拨打配送人电话：先弹确认防误触，确认后拨真实号 */
async function callChainContact(
  role: "骑手" | "楼长",
  name: string,
  phone: string,
) {
  const res = await uni.showModal({
    title: "确认拨打电话？",
    content: `拨打${role} ${name} 的电话？`,
  });
  if (res.confirm) uni.makePhoneCall({ phoneNumber: phone });
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
            : order.status === "delivered"
              ? autoConfirmHint || "你的这一袋，正在校园里接力"
              : "你的这一袋，正在校园里接力"
      }}</text></view
    ><!-- 售后福利群 v2（IKQXSD；2026-10-28 改定不可关闭）--><view
      v-if="campusStore.afterSalesGroupQrcode"
      class="group-card"
      ><view class="group-card__head"
        ><view class="group-card__badge"></view
        ><view class="group-card__titles"
          ><text class="group-card__title">售后福利群</text
          ><!-- IKRSJ3 #114：文案校区可配（groupQrcodeTip），空=默认两行
          --><text class="group-card__sub">{{
            campusStore.groupQrcodeTip || "专属售后通道 · 福利优先享"
          }}</text></view
        ></view
      ><view class="group-card__body"
        ><image
          :src="campusStore.afterSalesGroupQrcode"
          class="group-card__qr"
          mode="aspectFit"
          show-menu-by-longpress
        /><view class="group-card__aside"
          ><text class="group-card__hint">长按识别二维码</text
          ><text
            v-if="!campusStore.groupQrcodeTip"
            class="group-card__hint group-card__hint--sub"
            >加入福利群，售后进度与专属优惠第一时间掌握</text
          ></view
        ></view
    ></view
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
<!-- 送货照片凭证（道哥 2026-10-16）：进度走完看现场——送达照/交接照
        两组数据驱动（有才渲染），点缩略图 uni.previewImage 看大图 -->
    <view v-if="proofGroups.length" class="proof card"
      ><view class="proof__head"
        ><view class="proof__title"
          ><view class="proof__icon"
            ><view class="proof__icon-lens" /><view class="proof__icon-flash" /></view
          ><text>送货凭证</text></view
        ><text class="proof__hint">点击照片查看大图</text></view
      ><view v-for="group in proofGroups" :key="group.label" class="proof__group"
        ><view class="proof__meta"
          ><text class="proof__badge">{{ group.label }}</text
          ><text v-if="group.time" class="proof__time">{{ group.time }}</text></view
        ><view class="proof__grid"
          ><image
            v-for="img in group.images"
            :key="img"
            class="proof__thumb"
            :class="{ 'proof__thumb--single': group.images.length === 1 }"
            :src="api.toAbsoluteUrl(img)"
            mode="aspectFill"
            @tap="previewProof(group.images, img)"
        /></view>
        <text v-if="group.remark" class="proof__remark">配送备注：{{ group.remark }}</text>
      </view></view
    ><view class="address card"
      ><text class="address__label">送达寝室</text
      ><text class="address__main"
        >{{ order.address.buildingName }} · {{ order.address.room }}</text
      ><text class="muted"
        >{{ order.address.contactName }} {{ order.address.phone }}</text
      ></view
    ><!-- #107 配送人联系：校区开启 showDeliveryContacts 且接口下发 deliveryChain
        才渲染；骑手/楼长都未指派时给「配送员接单后显示」占位 --><view
      v-if="campusStore.showDeliveryContacts && order.deliveryChain"
      class="chain card"
      ><text class="chain__title">配送人联系</text>
      <template v-if="chainRider || chainManager">
        <view v-if="chainRider" class="chain__row"
          ><view class="chain__who"
            ><text class="chain__role">配送骑手</text
            ><text class="chain__name">{{ chainRider.name }}</text
            ><text class="chain__phone">{{ chainRider.phone }}</text></view
          ><button
            class="chain__call"
            aria-label="拨打骑手电话"
            @tap="callChainContact('骑手', chainRider.name, chainRider.phone)"
          >
            联系骑手
          </button></view
        >
        <view v-if="chainManager" class="chain__row"
          ><view class="chain__who"
            ><text class="chain__role">楼长</text
            ><text class="chain__name">{{ chainManager.name }}</text
            ><text class="chain__phone">{{ chainManager.phone }}</text></view
          ><button
            class="chain__call"
            aria-label="拨打楼长电话"
            @tap="
              callChainContact('楼长', chainManager.name, chainManager.phone)
            "
          >
            联系楼长
          </button></view
        >
      </template>
      <text v-else class="chain__empty">配送员接单后显示</text></view
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
      ><!-- 售后/客服次级按钮（道哥 2026-10-15 加，2026-10-16 配色回归
          品牌绿）：浅绿底深绿描边胶囊+纯 CSS 图标，紧邻主按钮组下方；
          申请售后仅送达/完成态出（24h 窗口在 after-sales 页校验），
          联系客服开 ServiceSheet 弹层 -->
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
/* 送货凭证卡（道哥 2026-10-16）：品牌绿同族——胶囊徽章+缩略图网格+备注
   引用条；单图放大一档，点图 previewImage 看大图 */
.proof {
  padding: 28rpx 30rpx;
  margin-top: 22rpx;
}
.proof__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.proof__title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: $primary-dark;
  font-size: 26rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}
/* 纯 CSS 相机图标（不用 emoji）：机身+镜头+顶闪，currentColor 随标题深绿 */
.proof__icon {
  position: relative;
  width: 30rpx;
  height: 23rpx;
  border: 3rpx solid currentColor;
  border-radius: 6rpx;
}
.proof__icon-lens {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 9rpx;
  height: 9rpx;
  border: 3rpx solid currentColor;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.proof__icon-flash {
  position: absolute;
  top: -7rpx;
  left: 6rpx;
  width: 10rpx;
  height: 5rpx;
  background: currentColor;
  border-radius: 2rpx 2rpx 0 0;
}
.proof__hint {
  font-size: 20rpx;
  color: $muted;
}
.proof__group {
  margin-top: 24rpx;
}
.proof__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.proof__badge {
  padding: 5rpx 18rpx;
  border-radius: 999rpx;
  background: $primary-soft;
  color: $primary-dark;
  font-size: 21rpx;
  font-weight: 700;
}
.proof__time {
  font-size: 21rpx;
  color: #9aa39d;
}
.proof__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 16rpx;
}
.proof__thumb {
  width: 200rpx;
  height: 200rpx;
  border-radius: 18rpx;
  border: 1rpx solid rgba(32, 74, 45, 0.1);
  box-shadow: 0 4rpx 12rpx rgba(21, 75, 38, 0.08);
}
.proof__thumb--single {
  width: 320rpx;
  height: 320rpx;
}
.proof__remark {
  display: block;
  margin-top: 14rpx;
  padding: 12rpx 18rpx;
  background: $primary-soft;
  border-left: 6rpx solid rgba(7, 136, 59, 0.35);
  border-radius: 10rpx;
  font-size: 22rpx;
  color: #3d5745;
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
/* #107 配送人联系卡（校区开启+接口下发 deliveryChain 才渲染） */
.chain {
  padding: 24rpx 28rpx;
  margin-top: 22rpx;
}
.chain__title {
  display: block;
  color: $primary-dark;
  font-size: 22rpx;
  font-weight: 800;
}
.chain__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 0 4rpx;
}
.chain__who {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.chain__role {
  font-size: 20rpx;
  color: $muted;
}
.chain__name {
  font-size: 30rpx;
  font-weight: 900;
}
.chain__phone {
  font-size: 24rpx;
  color: $muted;
}
.chain__call {
  flex: 0 0 auto;
  min-height: 72rpx;
  margin: 0;
  padding: 0 32rpx;
  border: 2rpx solid rgba(7, 136, 59, 0.35);
  border-radius: 999rpx;
  background: $primary-soft;
  color: $primary-dark;
  font-size: 25rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chain__call::after {
  border: none;
}
.chain__empty {
  display: block;
  padding: 14rpx 0 4rpx;
  color: $muted;
  font-size: 24rpx;
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
/* 售后/客服次级按钮（道哥 2026-10-15 加，2026-10-16 回归品牌绿）：
   浅绿底深绿描边胶囊居中排在主按钮组下方，高度/字号比主按钮降一档
   维持层级；可点高度 76rpx ≥72rpx、字号 26rpx ≥26rpx
   （ui-ux-pro-max touch-target/legibility） */
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
  /* 品牌绿同源（道哥 2026-10-16：墨金不搭，回归项目清新绿体系）：
     浅绿底+深绿描边胶囊——比 ghost 醒目、比主按钮降档，服务动作
     介于两者层级；与 .bar-btn--soft 同族但带描边 */
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
/* 按下反馈：微沉+底色加深一档 */
.svc-btn:active {
  transform: translateY(2rpx);
  background: #ddf3da;
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
/* 对话气泡=联系客服：圆角矩形+左下小尾巴（补丁盖住气泡底边形成缺口，
   补丁色=按钮底色，随按钮配色同步改） */
.svc-icon--chat {
  position: relative;
  width: 26rpx;
  height: 20rpx;
  border: 3rpx solid currentColor;
  border-radius: 6rpx;
  background: $primary-soft;
}
.svc-icon--chat::after {
  content: "";
  position: absolute;
  left: 6rpx;
  bottom: -6rpx;
  width: 10rpx;
  height: 10rpx;
  background: $primary-soft;
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

/* 售后福利群卡片 v2（IKQXSD；2026-10-28 改定不可关闭）：状态头下·大码
   横排——码 400rpx 主视觉，右侧提示竖排 */
.group-card {
  margin-top: 22rpx;
  background: #fff;
  border-radius: 28rpx;
  box-shadow: 0 8rpx 28rpx rgba(21, 75, 38, 0.07);
  overflow: hidden;
}
.group-card__head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 28rpx;
  background: linear-gradient(135deg, $primary-dark, $primary);
  color: #fff;
}
.group-card__badge {
  position: relative;
  width: 44rpx;
  height: 36rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  border-radius: 12rpx;
  flex: 0 0 auto;
}
.group-card__badge::after {
  content: "";
  position: absolute;
  right: -10rpx;
  bottom: -6rpx;
  width: 16rpx;
  height: 14rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  border-radius: 6rpx 6rpx 6rpx 2rpx;
  background: linear-gradient(135deg, $primary-dark, $primary);
}
.group-card__titles {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  flex: 1;
  min-width: 0;
}
.group-card__title {
  font-size: 30rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}
.group-card__sub {
  font-size: 21rpx;
  opacity: 0.85;
}
.group-card__body {
  display: flex;
  align-items: center;
  gap: 30rpx;
  padding: 32rpx 34rpx;
}
.group-card__qr {
  width: 400rpx;
  height: 400rpx;
  border-radius: 20rpx;
  border: 1rpx solid rgba(32, 74, 45, 0.08);
  flex: 0 0 auto;
  background: #fafbfa;
}
.group-card__aside {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}
.group-card__hint {
  font-size: 26rpx;
  font-weight: 700;
  color: #153628;
  letter-spacing: 1rpx;
}
.group-card__hint--sub {
  font-size: 22rpx;
  font-weight: 400;
  color: $muted;
  line-height: 1.6;
  letter-spacing: 0;
}
</style>
