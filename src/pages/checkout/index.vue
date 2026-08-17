<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { fenToYuan } from "../../utils/money";
import { startPayFlow } from "../../utils/payment";
import type { Address, Cart, UserCoupon } from "../../types";
/** 结算金额字段单位均为分（契约 API-3），展示统一经 fenToYuan */
interface Settlement {
  productAmount: number;
  deliveryFee: number;
  discount: number;
  payableAmount: number;
}
const address = ref<Address>(),
  cart = ref<Cart>(),
  mode = ref<"instant" | "scheduled">("instant"),
  slot = ref(""),
  remark = ref(""),
  settlement = ref<Settlement>(),
  submitting = ref(false),
  /** 三态（IK9AWK）：购物车等核心数据失败给整页重试，弱项缺省不阻塞 */
  loading = ref(true),
  error = ref(false),
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
  remark: remark.value.trim() || undefined,
}));
/** 门槛判断：商品金额与券门槛同为分值，直接比较 */
function meetsThreshold(item: UserCoupon) {
  return (cart.value?.productAmount ?? 0) >= item.coupon.threshold;
}
async function refresh() {
  settlement.value = await api.checkout(payload.value);
}
/** 低于起送门槛时禁付并提示差额（IK9AWN） */
const belowThreshold = computed(
  () =>
    (cart.value?.productAmount ?? 0) > 0 &&
    (cart.value?.productAmount ?? 0) <
      (cart.value?.deliveryThreshold ?? 1000),
);
const thresholdGap = computed(() =>
  fenToYuan(
    (cart.value?.deliveryThreshold ?? 1000) -
      (cart.value?.productAmount ?? 0),
  ),
);
async function load() {
  loading.value = true;
  error.value = false;
  // 各请求独立容错（IK9AWK）：地址/时段/优惠券缺省不阻塞结算，购物车挂了才整页重试
  const [a, c, s, b] = await Promise.allSettled([
    api.addresses(),
    api.cart(),
    api.slots(),
    api.coupons(),
  ]);
  if (a.status === "fulfilled") {
    const selected = uni.getStorageSync("selectedAddressId");
    address.value =
      a.value.find((item) => item.id === selected) || a.value[0];
  }
  if (c.status === "fulfilled") cart.value = c.value;
  if (s.status === "fulfilled") {
    slots.value = s.value;
    // 默认选中第一个可用时段，不再硬编码 label（IK9AWN）
    if (!slot.value || !s.value.some((x) => x.label === slot.value && x.available))
      slot.value = s.value.find((x) => x.available)?.label ?? "";
  }
  if (b.status === "fulfilled") {
    const now = Date.now();
    usableCoupons.value = b.value.mine.filter(
      (item) =>
        (item.status === "claimed" || item.status === "released") &&
        new Date(item.coupon.expiresAt).getTime() > now,
    );
    // 默认选用抵扣最多的可用券
    const best = usableCoupons.value
      .filter(meetsThreshold)
      .sort((x, y) => y.coupon.amount - x.coupon.amount)[0];
    selectedCouponId.value = best?.id;
  }
  if (!cart.value) {
    error.value = true;
    loading.value = false;
    return;
  }
  try {
    await refresh();
  } catch {
    error.value = true;
  }
  loading.value = false;
}
onShow(load);
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
    // 门槛文案取整数元（IK9AWT：去掉"满 10.00 元"的多余小数）
    uni.showToast({
      title: `满 ${Number(fenToYuan(item.coupon.threshold))} 元才能用这张券`,
      icon: "none",
    });
    return;
  }
  selectedCouponId.value = item?.id;
  await refresh();
}
async function submit() {
  if (submitting.value) return;
  // 无地址前置校验（IK9AWI）：不再等后端报错
  if (!address.value) {
    uni.showToast({ title: "请先添加寝室地址", icon: "none" });
    uni.navigateTo({ url: "/pages/address/edit" });
    return;
  }
  if (belowThreshold.value) {
    uni.showToast({ title: "还差一点起送金额，再去挑一件吧", icon: "none" });
    return;
  }
  submitting.value = true;
  try {
    const created = await api.createOrder(payload.value);
    let paid = false;
    try {
      paid = await startPayFlow(created.id);
    } catch {
      // 支付请求异常不吞掉订单：落到详情页继续支付，不留死路
    }
    if (paid) {
      // 模拟支付成功：直达支付成功页（IK97FE/IK97FH）
      uni.redirectTo({ url: `/pages/checkout/success?id=${created.id}` });
      return;
    }
    uni.showToast({ title: "支付未完成，可继续支付", icon: "none" });
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
    ><view v-if="loading" class="checkout__skeleton"
      ><view v-for="n in 4" :key="n" class="skeleton-block" /></view
    ><view v-else-if="error" class="retry card" @tap="load"
      ><text class="retry__title">加载失败</text
      ><text class="muted">网络异常，点击重试</text></view
    ><template v-else
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
    ><view
      v-else
      class="address address--empty card"
      @tap="uni.navigateTo({ url: '/pages/address/edit' })"
      ><text class="address__flag">送到这里</text
      ><text class="address__room">还没有寝室地址</text
      ><text class="muted">点击添加，楼长才知道送到哪　›</text></view
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
        ><text class="mode__title">预约配送</text
        ><text class="mode__time">2 小时送达</text
        ><text class="mode__gift">赠送 2 元全品类优惠券</text></view
      ></view
    ><scroll-view
      v-if="mode === 'scheduled'"
      scroll-x
      class="slots card"
      :show-scrollbar="false"
      ><view class="slots__inner"
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
      ></scroll-view
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
          >¥{{ fenToYuan(line.product.price * line.quantity) }}</text
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
          >满 {{ fenToYuan(item.coupon.threshold) }} 元可用 · 可省 ¥{{
            fenToYuan(item.coupon.amount)
          }}
          元</text
          ></view
        ><text class="coupon-opt__mark">✓</text></view
      ><view v-if="!usableCoupons.length" class="coupon-opt coupon-opt--empty"
        ><text>暂无可用优惠券，去「我的 → 优惠券」领一张</text></view
      ></view
    ><view class="section-title"
      ><text class="section-title__main">订单备注</text></view
    ><view class="remark card"
      ><input
        v-model="remark"
        class="remark__input"
        maxlength="50"
        placeholder="选填，给配送员捎句话（50 字内）"
        placeholder-class="remark__placeholder"
      /></view
    ><view v-if="settlement" class="bill card"
      ><view
        ><text>商品金额</text
        ><text>¥{{ fenToYuan(settlement.productAmount) }}</text></view
      ><view
        ><text>配送费</text
        ><text>¥{{ fenToYuan(settlement.deliveryFee) }}</text></view
      ><view class="bill__coupon"
        ><text>{{ selectedCoupon?.coupon.name || "未使用优惠券" }}</text
        ><text>−¥{{ fenToYuan(settlement.discount) }}</text></view
      ><view class="bill__total"
        ><text>合计</text
        ><text>¥{{ fenToYuan(settlement.payableAmount) }}</text></view
      ></view
    ><view class="submit safe-bottom"
      ><view
        ><text class="muted">{{
          belowThreshold ? "还差 ¥" + thresholdGap + " 起送" : "微信支付"
        }}</text
        ><text class="submit__price"
          >¥{{
            settlement ? fenToYuan(settlement.payableAmount) : "--"
          }}</text
        ></view
      ><button
        class="primary-btn"
        :disabled="submitting || !address || belowThreshold"
        @tap="submit"
      >
        {{
          belowThreshold
            ? "还差起送金额"
            : submitting
              ? "正在支付…"
              : "确认支付"
        }}
      </button></view
    ></template
    ></view
  >
  <CartOverlay />
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
/* 无地址引导卡（IK9AWI） */
.address--empty .address__room {
  color: $primary-dark;
}
.checkout__skeleton {
  padding-top: 20rpx;
}
.skeleton-block {
  height: 180rpx;
  border-radius: 28rpx;
  margin-bottom: 22rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: checkout-pulse 1.2s infinite;
}
@keyframes checkout-pulse {
  50% {
    opacity: 0.55;
  }
}
.retry {
  padding: 90rpx 30rpx;
  text-align: center;
}
.retry__title {
  display: block;
  font-weight: 900;
  color: $primary-dark;
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
.mode__gift {
  display: block;
  font-size: 22rpx;
  color: $orange;
  font-weight: 800;
}
.remark {
  padding: 8rpx 26rpx;
}
.remark__input {
  min-height: 88rpx;
  font-size: 28rpx;
}
.remark__placeholder {
  color: #9aa39d;
}
/* 时段横向滚动（IK9AWN：时段多时不裁切） */
.slots {
  margin-top: 20rpx;
  white-space: nowrap;
}
.slots__inner {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  padding: 22rpx;
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
  flex-shrink: 0;
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
