<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { nightApi } from "../../api/night";
import { businessUrl, resolveBusinessType, type BusinessType } from "../../utils/businessContext";
import ProofImagePicker from "../../components/ProofImagePicker.vue";
const businessType = ref<BusinessType>('day');
const orderLoaded = ref(false), loadError = ref(false);
const contact = ref<{ phone: string; qrcode: string; kfUrl: string; corpId: string }>({ phone: '', qrcode: '', kfUrl: '', corpId: '' });
let requestedType: unknown = 'day', loadGeneration = 0;
import { AFTER_SALE_TYPES } from "../../utils/afterSale";
import ServiceSheet from "../../components/ServiceSheet.vue";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
const orderId = ref(""),
  /** IKKTWM 售后页浮动客服入口（道哥 2026-10-11） */
  serviceOpen = ref(false),
  submitting = ref(false),
  uploading = ref(false),
  /** IKHZKA v2：订单商品行（部分退款勾选用） */
  lines = ref<Array<{ id: string; name: string; price: number; quantity: number }>>([]),
  selected = ref<string[]>([]),
  /** 道哥 2026-09-28：默认整单退，点商品行切单品退 */
  refundAll = ref(true),
  form = reactive({
    type: "quality",
    description: "",
    images: [] as string[],
  });
onLoad((q) => {
  orderId.value = String(q?.orderId || "");
  requestedType = q?.businessType || "day";
});
onShow(loadOrder);
async function loadOrder() {
  const generation = ++loadGeneration;
  const identity = uni.getStorageSync('token');
  orderLoaded.value = false; loadError.value = false;
  try {
    if (!orderId.value) throw Error('缺少订单信息');
    const type = await resolveBusinessType(requestedType);
    businessType.value = type;
    if (type === 'night') {
      const order = await nightApi.order(orderId.value);
      if (generation !== loadGeneration || identity !== uni.getStorageSync('token')) return;
      lines.value = order.items.map(line => ({ id: line.nightProductId, name: line.name, price: line.price, quantity: line.quantity }));
      refundableMax.value = Math.max(0, order.payableAmount - order.deliveryFee - (order.refund?.status === 'succeeded' ? order.refund.amount : 0));
      contact.value = order.support || { phone: '', qrcode: '', kfUrl: '', corpId: '' };
    } else {
      const [order, refunds] = await Promise.all([api.order(orderId.value), api.refunds()]);
      if (generation !== loadGeneration || identity !== uni.getStorageSync('token')) return;
      contact.value = order.support || { phone: '', qrcode: '', kfUrl: '', corpId: '' };
      lines.value = order.items.map(line => ({ id: line.product.id, name: line.product.name, price: line.product.price, quantity: line.quantity }));
      refundableMax.value = Math.max(0, order.payableAmount - (order.deliveryFee || 0) - refunds.filter(record => record.orderId === order.id && record.status === 'refunded').reduce((amount, record) => amount + record.amount, 0));
    }
    orderLoaded.value = true;
  } catch { if (generation === loadGeneration) loadError.value = true; }
}
const refundableMax = ref(0);
/** 勾选金额是否超可退上限（超限禁止提交，道哥 2026-09-28） */
const overLimit = computed(
  () => !refundAll.value && partTotal.value > refundableMax.value,
);
function toggleLine(id: string) {
  if (refundAll.value) {
    // 整单退状态下点商品行 = 切到单品退并勾上该行
    refundAll.value = false;
    selected.value = [id];
    return;
  }
  const i = selected.value.indexOf(id);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push(id);
  if (!selected.value.length) refundAll.value = true; // 全取消回到整单退
}
/** 部分退合计（分） */
const partTotal = computed(() =>
  lines.value
    .filter((l) => selected.value.includes(l.id))
    .reduce((sum, l) => sum + l.price * l.quantity, 0),
);
async function submit() {
  if (submitting.value || !orderLoaded.value) return;
  if (uploading.value) {
    uni.showToast({ title: "凭证还在上传中，稍等一下", icon: "none" });
    return;
  }
  if (form.description.length < 5) {
    uni.showToast({ title: "请详细描述问题", icon: "none" });
    return;
  }
  if (!form.images.length) {
    uni.showToast({ title: "请上传至少一张问题凭证", icon: "none" });
    return;
  }
  submitting.value = true;
  try {
    if (overLimit.value) {
      uni.showToast({
        title: `退款金额超过可退上限 ¥${(refundableMax.value / 100).toFixed(2)}`,
        icon: "none",
      });
      return;
    }
    const submitAfterSale = businessType.value === "night" ? nightApi.applyAfterSale : api.createAfterSale;
    await submitAfterSale(orderId.value, {
      ...form,
      // v2 部分退款：单品退传勾选行；整单退不传（兼容 v1 口径）
      productIds: refundAll.value ? undefined : [...selected.value],
    });
    uni.showToast({ title: "售后申请已提交", icon: "success" });
    setTimeout(() => uni.redirectTo({ url: businessUrl("/pages/after-sales/index", businessType.value) }), 600);
  } finally {
    submitting.value = false;
  }
}
</script>
<template>
  <view class="page"
    ><view v-if="loadError" class="tip" @tap="loadOrder">订单加载失败，点击重试</view><view v-else-if="!orderLoaded" class="tip">正在核对订单与可退金额…</view><view class="tip">请在送达后 24 小时内提交，平台审核后处理退款。</view
    ><!-- v2 退款商品：默认整单退，点商品行切单品退（道哥 2026-09-28） -->
    <view v-if="lines.length" class="form card"
      ><text class="label">退款商品</text
      ><view class="mode-row"
        ><view
          class="mode-pill"
          :class="{ 'mode-pill--active': refundAll }"
          @tap="
            refundAll = true;
            selected = [];
          "
          >全部退款</view
        ><view
          class="mode-pill"
          :class="{ 'mode-pill--active': !refundAll }"
          @tap="
            refundAll = false;
            selected = lines.length ? [lines[0].id] : [];
          "
          >单品退款</view
        ></view
      ><view
        v-for="line in lines"
        :key="line.id"
        class="line"
        :class="{
          'line--active': !refundAll && selected.includes(line.id),
          'line--muted': refundAll,
        }"
        @tap="toggleLine(line.id)"
        ><text class="line__name">{{ line.name }} × {{ line.quantity }}</text
        ><text class="line__price">¥{{ (line.price * line.quantity / 100).toFixed(2) }}</text
        ><view
          v-if="!refundAll"
          class="line__check"
          :class="{ 'line__check--on': selected.includes(line.id) }"
          >{{ selected.includes(line.id) ? "✓" : "" }}</view
        ></view
      ><view class="lines-total"
        ><text>退款金额</text
        ><text class="lines-total__num">{{
          refundAll
            ? "整单退款（实付金额，配送费不退）"
            : `¥${(partTotal / 100).toFixed(2)}`
        }}</text></view
      ><view
        v-if="!refundAll"
        class="lines-total"
        :class="{ 'lines-total--over': overLimit }"
        ><text>可退上限</text
        ><text class="lines-total__num">¥{{ (refundableMax / 100).toFixed(2) }}</text></view
      ><text
        v-if="overLimit"
        class="over-tip"
        >勾选金额超过可退上限，请调整后再提交</text
      ></view
    ><view class="form card"
      ><text class="label">问题类型</text
      ><view class="types"
        ><view
          v-for="item in AFTER_SALE_TYPES"
          :key="item[0]"
          class="type"
          :class="{ 'type--active': form.type === item[0] }"
          @tap="form.type = item[0]"
          >{{ item[1] }}</view
        ></view
      ><text class="label">问题描述</text
      ><textarea
        v-model="form.description"
        maxlength="300"
        placeholder="请说明商品出现了什么问题"
      /><text class="label">问题凭证</text
      ><view class="proof"><view v-for="image in form.images" :key="image" class="proof-item"><image :src="api.toAbsoluteUrl(image)" mode="aspectFill" @tap="uni.previewImage({ current: image, urls: form.images.map(api.toAbsoluteUrl) })" /><button :disabled="uploading || submitting" @tap="form.images = form.images.filter(url => url !== image)">移除</button></view></view>
      <ProofImagePicker v-model="form.images" :max="3" :disabled="submitting || !orderLoaded" label="上传问题凭证（至少1张）" @busy="uploading = $event" />
      </view
    ><button
      class="primary-btn"
      :disabled="submitting || uploading || !orderLoaded"
      @tap="submit"
    >
      {{ submitting ? "正在提交…" : uploading ? "凭证上传中…" : "提交售后申请" }}
    </button
    ><!-- 浮动客服球（道哥 2026-10-11）：填售后遇到疑问随时召唤校区客服，
        图标纯 CSS 耳机（不依赖 emoji/位图，老内核稳） --><view
      class="service-fab"
      hover-class="service-fab--hover"
      aria-label="联系客服"
      @tap="serviceOpen = true"
      ><view class="service-fab__icon"
        ><view class="ic-band"></view><view class="ic-pad ic-pad--l"></view
        ><view class="ic-pad ic-pad--r"></view></view
      ></view
    ></view
  >
  <ServiceSheet :contact="contact" :visible="serviceOpen" @close="serviceOpen = false" />
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.tip {
  background: $primary-soft;
  color: $primary-dark;
  padding: 22rpx;
  border-radius: 22rpx;
  margin-bottom: 22rpx;
  border: 2rpx solid rgba(37, 185, 90, 0.12);
}
.form {
  padding: 30rpx;
}
.mode-row {
  display: flex;
  gap: 14rpx;
  margin: -6rpx 0 14rpx;
}
.mode-pill {
  min-height: 68rpx;
  padding: 12rpx 28rpx;
  border: 2rpx solid $line;
  border-radius: 34rpx;
  font-size: 24rpx;
  display: flex;
  align-items: center;
}
.mode-pill--active {
  background: $primary;
  color: #fff;
  border-color: $primary;
  font-weight: 800;
}
.line--muted {
  opacity: 0.55;
}
.lines-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 2rpx dashed $line;
  margin-top: 6rpx;
  padding-top: 16rpx;
  font-size: 24rpx;
  color: #667069;
}
.lines-total__num {
  font-weight: 900;
  color: $primary-dark;
}
.lines-total--over .lines-total__num {
  color: #c0392b;
}
.over-tip {
  display: block;
  color: #c0392b;
  font-size: 22rpx;
  margin-top: 8rpx;
}
.line {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx 16rpx;
  border: 2rpx solid $line;
  border-radius: 18rpx;
  margin-bottom: 12rpx;
}
.line--active {
  border-color: $primary;
  background: rgba(37, 185, 90, 0.06);
}
.line__name {
  flex: 1;
  font-size: 24rpx;
}
.line__price {
  font-size: 23rpx;
  color: $primary-dark;
  font-weight: 800;
}
.line__check {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid $line;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #fff;
}
.line__check--on {
  background: $primary;
  border-color: $primary;
}
.label {
  display: block;
  font-weight: 900;
  margin: 22rpx 0 14rpx;
}
.types {
  display: flex;
  gap: 14rpx;
  flex-wrap: wrap;
}
.type {
  min-height: 72rpx;
  padding: 14rpx 22rpx;
  border: 2rpx solid $line;
  border-radius: 36rpx;
  font-size: 23rpx;
  display: flex;
  align-items: center;
}
.type--active {
  background: $primary;
  color: #fff;
  border-color: $primary;
}
.form textarea {
  width: 100%;
  height: 220rpx;
  background: $paper;
  border: 2rpx solid $line;
  border-radius: 22rpx;
  padding: 20rpx;
  line-height: 1.6;
}
.proof {
  min-height: 174rpx;
  border: 3rpx dashed rgba(37, 185, 90, 0.35);
  background: #f8fff9;
  border-radius: 22rpx;
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: center;
  color: #667069;
  padding: 12rpx;
}
.proof image {
  width: 120rpx;
  height: 120rpx;
  border-radius: 18rpx;
}
.primary-btn {
  margin-top: 30rpx;
}
/* 浮动客服球（道哥 2026-10-11）：底部留白加大，防悬浮球压到提交按钮 */
.page {
  padding-bottom: calc(340rpx + env(safe-area-inset-bottom));
}
.service-fab {
  position: fixed;
  right: 28rpx;
  bottom: calc(48rpx + env(safe-area-inset-bottom));
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary-dark, $primary);
  box-shadow: 0 12rpx 30rpx rgba(7, 136, 59, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  /* ServiceSheet 弹层 60 之下 */
  z-index: 50;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}
.service-fab--hover {
  transform: scale(0.94);
  box-shadow: 0 6rpx 18rpx rgba(7, 136, 59, 0.28);
}
/* 纯 CSS 耳机图标：头梁 + 双耳罩 */
.service-fab__icon {
  position: relative;
  width: 52rpx;
  height: 48rpx;
}
.ic-band {
  position: absolute;
  left: 7rpx;
  right: 7rpx;
  top: 6rpx;
  height: 24rpx;
  border: 5rpx solid #fff;
  border-bottom: none;
  border-radius: 26rpx 26rpx 0 0;
  box-sizing: border-box;
}
.ic-pad {
  position: absolute;
  top: 26rpx;
  width: 11rpx;
  height: 17rpx;
  background: #fff;
  border-radius: 6rpx;
}
.ic-pad--l {
  left: 4rpx;
}
.ic-pad--r {
  right: 4rpx;
}
</style>
