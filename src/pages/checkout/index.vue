<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { startPayFlow } from "../../utils/payment";
import type { Address, Cart, UserCoupon } from "../../types";
interface Settlement {
  productAmount: number;
  deliveryFee: number;
  discount: number;
  payableAmount: number;
}
const address = ref<Address>(),
  cart = ref<Cart>(),
  mode = ref<"instant" | "scheduled">("instant"),
  slot = ref("20:00-21:00"),
  settlement = ref<Settlement>(),
  submitting = ref(false),
  slots = ref<Array<{ id: string; label: string; available: boolean }>>([]);
const usableCoupons = ref<UserCoupon[]>([]),
  selectedCouponId = ref<string>();
const selectedCoupon = computed(
  () =>
    usableCoupons.value.find((item) => item.id === selectedCouponId.value) ??
    null,
);
const payload = computed<Record<string, unknown>>(() => ({
  addressId: address.value?.id,
  deliveryMode: mode.value,
  deliverySlot: mode.value === "scheduled" ? slot.value : undefined,
  couponId: selectedCoupon.value?.id,
}));
function meetsThreshold(item: UserCoupon) {
  return (cart.value?.productAmount ?? 0) >= item.coupon.threshold;
}
async function refresh() {
  settlement.value = await api.checkout(payload.value);
}
onShow(async () => {
  const [a, c, s, bundle] = await Promise.all([
    api.addresses(),
    api.cart(),
    api.slots(),
    api.coupons(),
  ]);
  const selected = uni.getStorageSync("selectedAddressId");
  address.value = a.find((item) => item.id === selected) || a[0];
  cart.value = c;
  slots.value = s;
  const now = Date.now();
  usableCoupons.value = bundle.mine.filter(
    (item) =>
      (item.status === "claimed" || item.status === "released") &&
      new Date(item.coupon.expiresAt).getTime() > now,
  );
  // 默认选用抵扣最多的可用券
  const best = usableCoupons.value
    .filter(meetsThreshold)
    .sort((x, y) => y.coupon.amount - x.coupon.amount)[0];
  selectedCouponId.value = best?.id;
  await refresh();
});
async function setMode(value: "instant" | "scheduled") {
  mode.value = value;
  await refresh();
}
async function selectSlot(label: string, available: boolean) {
  if (!available) return;
  slot.value = label;
  await refresh();
}
async function chooseCoupon(item: UserCoupon | null) {
  if (item && !meetsThreshold(item)) {
    uni.showToast({
      title: `满 ${item.coupon.threshold} 元才能用这张券`,
      icon: "none",
    });
    return;
  }
  selectedCouponId.value = item?.id;
  await refresh();
}
async function submit() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const created = await api.createOrder(payload.value);
    let paid = false;
    try {
      paid = await startPayFlow(created.id);
    } catch {
      // 支付请求异常不吞掉订单：落到详情页继续支付，不留死路
    }
    uni.showToast({
      title: paid ? "支付成功" : "支付未完成，可继续支付",
      icon: paid ? "success" : "none",
    });
    setTimeout(
      () => uni.redirectTo({ url: `/pages/orders/detail?id=${created.id}` }),
      500,
    );
  } finally {
    submitting.value = false;
  }
}
</script>
<template>
  <view class="page checkout"
    ><view
      v-if="address"
      class="address card"
      @tap="uni.navigateTo({ url: '/pages/address/index' })"
      ><text class="address__flag">送到这里</text
      ><text class="address__room"
        >{{ address.buildingName }} · {{ address.room }} 寝室</text
      ><text class="muted"
        >{{ address.contactName }} {{ address.phone }}　›</text
      ></view
    ><view class="section-title"
      ><text class="section-title__main">怎么送到寝</text></view
    ><view class="modes"
      ><view
        class="mode card"
        :class="{ 'mode--active': mode === 'instant' }"
        @tap="setMode('instant')"
        ><text class="mode__title">立即配送</text
        ><text class="mode__time">30-60 分钟</text
        ><text class="muted">现在就想要</text></view
      ><view
        class="mode card"
        :class="{ 'mode--active': mode === 'scheduled' }"
        @tap="setMode('scheduled')"
        ><text class="mode__title">省心送达</text
        ><text class="mode__time">2 小时内</text
        ><text class="muted">运费更省</text></view
      ></view
    ><view v-if="mode === 'scheduled'" class="slots card"
      ><text class="slots__title">选择时间</text
      ><view
        v-for="s in slots"
        :key="s.id"
        class="slot"
        :class="{
          'slot--active': slot === s.label,
          'slot--disabled': !s.available,
        }"
        @tap="selectSlot(s.label, s.available)"
        >{{ s.label }}</view
      ></view
    ><view class="section-title"
      ><text class="section-title__main">这袋有这些</text></view
    ><view class="goods card"
      ><view
        v-for="line in cart?.items"
        :key="line.product.id"
        class="goods__line"
        ><image :src="line.product.image" mode="aspectFit" /><text
          >{{ line.product.name }} × {{ line.quantity }}</text
        ><text
          >¥{{ (line.product.price * line.quantity).toFixed(2) }}</text
        ></view
      ></view
    ><view class="section-title"
      ><text class="section-title__main">优惠券</text></view
    ><view class="coupon-list card"
      ><view
        class="coupon-opt"
        :class="{ 'coupon-opt--active': !selectedCouponId }"
        @tap="chooseCoupon(null)"
        ><text class="coupon-opt__name">不使用优惠券</text
        ><text class="coupon-opt__mark">✓</text></view
      ><view
        v-for="item in usableCoupons"
        :key="item.id"
        class="coupon-opt"
        :class="{
          'coupon-opt--active': selectedCouponId === item.id,
          'coupon-opt--disabled': !meetsThreshold(item),
        }"
        @tap="chooseCoupon(item)"
        ><view class="coupon-opt__info"
          ><text class="coupon-opt__name">{{ item.coupon.name }}</text
          ><text class="coupon-opt__desc"
          >满 {{ item.coupon.threshold }} 元可用 · 可省 ¥{{ item.coupon.amount }}
          元</text
          ></view
        ><text class="coupon-opt__mark">✓</text></view
      ><view v-if="!usableCoupons.length" class="coupon-opt coupon-opt--empty"
        ><text>暂无可用优惠券，去「我的 → 优惠券」领一张</text></view
      ></view
    ><view v-if="settlement" class="bill card"
      ><view
        ><text>商品金额</text><text>¥{{ settlement.productAmount }}</text></view
      ><view
        ><text>配送费</text><text>¥{{ settlement.deliveryFee }}</text></view
      ><view class="bill__coupon"
        ><text>{{ selectedCoupon?.coupon.name || "未使用优惠券" }}</text
        ><text>−¥{{ settlement.discount }}</text></view
      ><view class="bill__total"
        ><text>合计</text><text>¥{{ settlement.payableAmount }}</text></view
      ></view
    ><view class="submit safe-bottom"
      ><view
        ><text class="muted">微信支付</text
        ><text class="submit__price"
          >¥{{ settlement?.payableAmount || "--" }}</text
        ></view
      ><button class="primary-btn" :disabled="submitting" @tap="submit">
        {{ submitting ? "正在支付…" : "确认支付" }}
      </button></view
    ></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.address {
  padding: 30rpx;
  border-left: 8rpx solid $primary;
  background: linear-gradient(135deg, $primary-soft, #fff);
}
.address__flag {
  display: block;
  color: $primary-dark;
  font-size: 22rpx;
  font-weight: 800;
}
.address__room {
  display: block;
  font-size: 36rpx;
  font-weight: 900;
  margin: 10rpx 0;
}
.modes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}
.mode {
  padding: 26rpx;
  border: 4rpx solid transparent;
}
.mode--active {
  border-color: $primary;
  background: $primary-soft;
}
.mode__title,
.mode__time {
  display: block;
}
.mode__title {
  font-weight: 900;
}
.mode__time {
  font-size: 32rpx;
  font-weight: 900;
  margin: 12rpx 0;
  color: $primary-dark;
}
.slots {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 20rpx;
  padding: 22rpx;
  overflow: hidden;
}
.slots__title {
  font-weight: 800;
}
.slot {
  min-height: 64rpx;
  padding: 12rpx 16rpx;
  border: 2rpx solid $line;
  border-radius: 32rpx;
  font-size: 21rpx;
  display: flex;
  align-items: center;
}
.slot--active {
  background: $primary;
  color: #fff;
  border-color: $primary;
}
.slot--disabled {
  opacity: 0.45;
  text-decoration: line-through;
}
.goods {
  padding: 12rpx 24rpx;
}
.goods__line {
  display: grid;
  grid-template-columns: 80rpx 1fr auto;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 2rpx solid $line;
}
.goods__line image {
  width: 80rpx;
  height: 80rpx;
  background: $primary-soft;
  border-radius: 18rpx;
}
.bill {
  margin-top: 22rpx;
  padding: 26rpx;
}
.coupon-list {
  padding: 6rpx 26rpx;
}
.coupon-opt {
  min-height: 104rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  border-bottom: 2rpx solid $line;
}
.coupon-opt:last-child {
  border-bottom: none;
}
.coupon-opt__info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.coupon-opt__name {
  font-weight: 800;
}
.coupon-opt__desc {
  font-size: 22rpx;
  color: #667069;
}
.coupon-opt__mark {
  width: 44rpx;
  height: 44rpx;
  border: 2rpx solid $line;
  border-radius: 50%;
  color: #fff;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.coupon-opt--active {
  .coupon-opt__name {
    color: $primary-dark;
  }
  .coupon-opt__mark {
    background: $primary;
    border-color: $primary;
  }
}
.coupon-opt--disabled {
  opacity: 0.5;
}
.coupon-opt--empty {
  color: #667069;
  font-size: 24rpx;
  justify-content: center;
}
.bill > view {
  display: flex;
  justify-content: space-between;
  padding: 12rpx;
}
.bill__coupon {
  color: $primary-dark;
}
.bill__total {
  border-top: 2rpx dashed $line;
  margin-top: 12rpx;
  padding-top: 24rpx !important;
  font-weight: 900;
  font-size: 34rpx;
}
.submit {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 18rpx 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 -10rpx 30rpx rgba(21, 75, 38, 0.09);
  z-index: 20;
}
.submit__price {
  display: block;
  font-size: 40rpx;
  font-weight: 900;
  color: #ff4d18;
}
.submit .primary-btn {
  width: 300rpx;
  margin: 0;
}
</style>
