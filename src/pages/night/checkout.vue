<script setup lang="ts">
import { useVisibleNow } from "../../utils/visibleNow";
import { nightCartIssue } from "../../utils/nightCartValidation";
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { ApiError } from "../../api/request";
import { nightApi } from "../../api/night";
import PhoneGate from "../../components/PhoneGate.vue";
import { useNightCartStore } from "../../stores/nightCart";
import { useSessionStore } from "../../stores/session";
import { fenToYuan } from "../../utils/money";
import { startNightPayFlow } from "../../utils/nightPayment";
import type {
  NightClaimableCoupon,
  NightEntry,
  NightProduct,
  NightStoreRow,
  NightUserCoupon,
} from "../../types/night";
import type { Address } from "../../types";

/**
 * 夜宵确认订单页（IKSW1F）：
 * - 地址限本楼：仅展示 buildingId 匹配的地址（服务端强校验兜底——
 *   非本楼地址提交直接被拒「夜宵订单仅支持本楼配送，请重新选店」）；
 * - 本地先重验购物车（失效行标红可一键移除），提交时服务端再全量重验；
 * - 夜宵券选择器：可用/不可用（门槛差价）+ 领取入口，与白天券完全隔离；
 * - 账单：商品原价合计 / 券优惠 / 配送费 / 应付；
 * - 提交 → POST /night/orders → 拉起微信支付 → 跳夜宵订单详情。
 */
const cart = useNightCartStore();
const session = useSessionStore();
const storeId = ref("");
const buildingId = ref("");
const store = ref<NightStoreRow>();
const entry = ref<NightEntry>();
const products = ref<NightProduct[]>([]);
const productsLoaded = ref(false);
const addresses = ref<Address[]>([]);
const addressId = ref("");
const remark = ref("");
const mineCoupons = ref<NightUserCoupon[]>([]);
const claimable = ref<NightClaimableCoupon[]>([]);
const selectedCouponId = ref("");
const submitting = ref(false);
const loading = ref(true);
const error = ref(false);
/** 授权层关闭态（方案C：关闭后可浏览，提交时守卫重置重新弹出） */
const gateDismissed = ref(false);

const cartLines = computed(() => cart.linesOf(storeId.value));
const productAmount = computed(() => cart.amountOf(storeId.value));
/** 本地重验：商品已下架/停售/不在可购清单 = 失效；数量超当前库存 = 失效 */
const expiryNow = useVisibleNow();
const invalidLineIds = computed(() => {
  // 商品清单未就绪（加载中/失败）时不做本地预检：服务端提交时全量重验兜底，
  // 避免误标全行失效阻塞下单（2026-11-05 H5 实测竞态）
  if (!productsLoaded.value) return [];
  const invalid: string[] = [];
  for (const line of cartLines.value) {
    const product = products.value.find((p) => p.id === line.productId);
    if (nightCartIssue(line, product, expiryNow.value))
      invalid.push(line.productId);
  }
  return invalid;
});
const hasInvalid = computed(() => invalidLineIds.value.length > 0);
/** 本楼地址（夜宵订单仅支持本楼配送） */
const buildingAddresses = computed(() =>
  addresses.value.filter((a) => a.buildingId === buildingId.value),
);
const currentAddress = computed(() =>
  buildingAddresses.value.find((a) => a.id === addressId.value) ??
    buildingAddresses.value[0] ??
    null,
);
/** 夜宵券：可下单用的 = claimed/released 且未过期且门槛够 */
function eligibleAmount(coupon: { nightProductIds?: string[] }) {
  if (!coupon.nightProductIds?.length) return productAmount.value;
  return cartLines.value.reduce((sum, line) => {
    const p = products.value.find(p => p.id === line.productId);
    return sum + (p && coupon.nightProductIds!.includes(p.catalogProductId) ? line.price * line.quantity : 0);
  }, 0);
}
const hasPromotion = computed(() => cartLines.value.some(line => line.asSeckill || products.value.find(product => product.id === line.productId)?.promotion));
const usableCoupons = computed(() =>
  mineCoupons.value.filter(
    (item) =>
      !hasPromotion.value &&
      (item.status === "claimed" || item.status === "released") &&
      (!item.coupon.expiresAt ||
        new Date(item.coupon.expiresAt).getTime() > Date.now()) &&
      eligibleAmount(item.coupon) > 0 && item.coupon.threshold <= eligibleAmount(item.coupon),
  ),
);
const selectedCoupon = computed(
  () =>
    usableCoupons.value.find((item) => item.id === selectedCouponId.value) ??
    null,
);
/** 不可用原因（门槛不够就地标差价；过期/已锁定直接隐藏不误导） */
function couponReason(item: NightUserCoupon): string {
  if (hasPromotion.value) return '活动价不可叠加优惠券';
  if (item.status === 'used') return '已使用';
  if (item.status === 'locked') return '已被待支付订单占用';
  if (
    item.coupon.expiresAt &&
    new Date(item.coupon.expiresAt).getTime() <= Date.now()
  )
    return "已过期";
  if (!eligibleAmount(item.coupon)) return '本次未选购适用商品';
  if (item.coupon.threshold > eligibleAmount(item.coupon)) return `适用商品还差 ¥${fenToYuan(item.coupon.threshold - eligibleAmount(item.coupon))} 可用`;
  return "当前状态不可使用";
}
const disabledCoupons = computed(() =>
  mineCoupons.value.filter(item => !usableCoupons.value.some(usable => usable.id === item.id)),
);
/** 券不抵配送费且优惠不超商品金额（PRD 6.9：不找零） */
const effectiveDiscount = computed(() =>
  selectedCoupon.value
    ? Math.min(selectedCoupon.value.coupon.amount, eligibleAmount(selectedCoupon.value.coupon))
    : 0,
);
const deliveryFee = computed(() => entry.value?.nightDeliveryFee ?? 0);
const payableAmount = computed(
  () => productAmount.value - effectiveDiscount.value + deliveryFee.value,
);

async function load() {
  if (!storeId.value) { error.value = true; loading.value = false; return; }
  loading.value = true;
  productsLoaded.value = false;
  error.value = false;
  const [detail, goods, entryData, addressList, coupons] =
    await Promise.allSettled([
      nightApi.storeDetail(storeId.value),
      nightApi.storeProducts(storeId.value),
      nightApi.entry(),
      nightApi.addresses(),
      nightApi.coupons(),
    ]);
  if (detail.status === "fulfilled") {
    store.value = detail.value;
    if (detail.value.buildingId) buildingId.value = detail.value.buildingId;
  }
  if (goods.status === "fulfilled") {
    products.value = goods.value;
    productsLoaded.value = true;
    if (cart.refreshProducts(storeId.value, goods.value)) uni.showToast({ title: "商品价格已更新，请核对金额", icon: "none" });
  }
  if (entryData.status === "fulfilled") entry.value = entryData.value;
  if (addressList.status === "fulfilled") {
    addresses.value = addressList.value.filter(
      (a) => a.buildingId === buildingId.value,
    );
    if (!addressId.value || !addresses.value.some(a => a.id === addressId.value)) {
      const preferred = String(uni.getStorageSync('selectedAddressId') || '');
      addressId.value = addresses.value.find(a => a.id === preferred)?.id || addresses.value[0]?.id || '';
    }
  }
  if (coupons.status === "fulfilled") {
    mineCoupons.value = coupons.value.mine;
    claimable.value = coupons.value.claimable;
  }
  // 地址与账单加载失败时应重试，不能把失败伪装成“没有地址/优惠券”。
  error.value = [detail, goods, entryData, addressList, coupons].some(result => result.status === 'rejected');
  loading.value = false;
}
onLoad((q) => {
  storeId.value = String(q?.storeId || "");
  buildingId.value = String(q?.buildingId || "");
});
function manageAddresses() {
  if (currentAddress.value) uni.setStorageSync('selectedAddressId', currentAddress.value.id);
  addressId.value = '';
  uni.navigateTo({ url: '/pages/address/index' });
}
onShow(async () => {
  try { await session.ensureLogin(); await load(); }
  catch { loading.value = false; error.value = true; }
});
/* ---------- 券操作 ---------- */
function chooseCoupon(item: NightUserCoupon | null) {
  if (item && !usableCoupons.value.some(coupon => coupon.id === item.id)) {
    uni.showToast({
      title: couponReason(item),
      icon: "none",
    });
    return;
  }
  selectedCouponId.value = item?.id ?? "";
}
async function claim(coupon: NightClaimableCoupon) {
  try {
    await nightApi.claimCoupon(coupon.id);
    uni.showToast({ title: "领取成功", icon: "success" });
    const bundle = await nightApi.coupons();
    mineCoupons.value = bundle.mine;
    claimable.value = bundle.claimable;
  } catch {
    // 业务原因 request 层已 toast
  }
}
/** 一键移除失效行（本地重验标记的） */
function removeInvalid() {
  cart.removeLines(storeId.value, invalidLineIds.value);
}
/* ---------- 提交 + 支付 ---------- */
async function submit() {
  if (submitting.value) return;
  if (session.needsPhone) {
    gateDismissed.value = false;
    uni.showToast({ title: "需绑定手机号后才能下单", icon: "none" });
    return;
  }
  if (!currentAddress.value) {
    uni.showToast({
      title: "夜宵订单仅支持本楼配送，请先添加本楼寝室地址",
      icon: "none",
    });
    uni.navigateTo({ url: "/pages/address/edit" });
    return;
  }
  expiryNow.value = Date.now();
  if (hasInvalid.value) {
    uni.showToast({ title: "有商品已失效，请先移除后再下单", icon: "none" });
    return;
  }
  if (!cartLines.value.length) {
    uni.showToast({ title: "购物车是空的", icon: "none" });
    return;
  }
  submitting.value = true;
  const intentKey = `nightCheckoutIntent:${cart.ownerId}:${storeId.value}`;
  try {
    let payload: Parameters<typeof nightApi.submitOrder>[0] = {
      requestId: `NC-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`,
      expectedProductAmount: productAmount.value,
      expectedDeliveryFee: deliveryFee.value,
      storeId: storeId.value,
      items: cartLines.value.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        asSeckill: !!line.asSeckill,
        ...(line.asSeckill ? { promotionId: line.promotionId } : {}),
      })),
      couponId: selectedCoupon.value?.id || undefined,
      addressId: currentAddress.value.id,
      remark: remark.value.trim() || undefined,
    };
    const saved = uni.getStorageSync(intentKey);
    if (saved) {
      try {
        const prior = JSON.parse(saved);
        if (prior.storeId === storeId.value && typeof prior.requestId === 'string' && Array.isArray(prior.items)) { payload = prior; uni.showToast({ title: '先核对上次提交的订单', icon: 'none' }); }
      } catch { uni.removeStorageSync(intentKey); }
    }
    uni.setStorageSync(intentKey, JSON.stringify(payload));
    const created = await nightApi.submitOrder(payload);
    uni.removeStorageSync(intentKey);
    let paid = false;
    try {
      paid = await startNightPayFlow(created.id, storeId.value);
    } catch {
      // 支付请求异常不吞掉订单：落到详情页继续支付，不留死路
    }
    if (paid) {
      uni.redirectTo({
        url: `/pages/checkout/success?id=${created.id}&businessType=night`,
      });
      return;
    }
    uni.showToast({ title: "支付未完成，可继续支付", icon: "none" });
    setTimeout(
      () =>
        uni.redirectTo({ url: `/pages/night/order-detail?id=${created.id}` }),
      500,
    );
  } catch (e) {
    if (e instanceof ApiError && e.kind === 'business') uni.removeStorageSync(intentKey);
    // 请求层已提示原因；重拉库存和价格，保留地址/备注及可重试的购物车。
    await load();
  } finally {
    submitting.value = false;
  }
}
function goStore() {
  uni.navigateTo({
    url: `/pages/night/store?storeId=${storeId.value}&buildingId=${buildingId.value}`,
  });
}
</script>

<template>
  <view class="page night-checkout"
    ><view v-if="loading" class="checkout-skeleton"
      ><view v-for="n in 4" :key="n" class="skeleton-block" /></view
    ><view v-else-if="error" class="retry card" @tap="load"
      ><text class="retry__title">加载失败</text
      ><text class="muted">网络异常，点击重试</text></view
    ><template v-else
    ><!-- 本楼地址卡：夜宵订单仅支持本楼配送（服务端强校验，前端先过滤） -->
    <view v-if="buildingAddresses.length" class="address card"
      ><view class="address__head"><text class="address__flag">送到本楼寝室</text><button class="address__manage" @tap="manageAddresses">管理地址</button></view
      ><view
        v-for="a in buildingAddresses"
        :key="a.id"
        class="address__opt"
        :class="{ 'address__opt--active': currentAddress?.id === a.id }"
        @tap="addressId = a.id"
        ><text class="address__room"
          >{{ a.buildingName }} · {{ a.room }} 寝室</text
        ><text class="muted">{{ a.contactName }} {{ a.phone }}</text
        ><view
          class="address__check"
          :class="{ 'address__check--on': currentAddress?.id === a.id }"
          >{{ currentAddress?.id === a.id ? "✓" : "" }}</view
        ></view
      ></view
    ><view
      v-else
      class="address address--empty card"
      @tap="uni.navigateTo({ url: '/pages/address/edit' })"
      ><text class="address__flag">送到本楼寝室</text
      ><text class="address__room">还没有本楼寝室地址</text
      ><text class="muted"
        >夜宵订单仅支持本楼配送；换楼栋请回店铺页重新选店</text
      ></view
    ><!-- 失效行警示（本地重验标记；提交时服务端还会再全量重验） -->
    <view v-if="hasInvalid" class="invalid card"
      ><view class="invalid__texts"
        ><text class="invalid__title">有 {{ invalidLineIds.length }} 件商品已失效</text
        ><text class="muted">可能已下架、库存不足或活动已结束，请移除后重新选购</text></view
      ><button class="invalid__btn" @tap="removeInvalid">移除失效商品</button></view
    ><!-- 店铺未营业软提示：可继续选地址/券，提交会被服务端拦截 -->
    <view v-if="store && store.state !== 'open'" class="window-tip"
      >夜宵店当前未营业，可先选好商品与地址，{{
        store.state === "resting" ? "开门营业后" : "本店开业后"
      }}再来提交</view
    ><!-- 商品清单 -->
    <view class="section-title"
      ><text class="section-title__main">这袋有这些</text
      ><text class="section-title__sub" @tap="goStore">回店铺加购</text></view
    ><view class="goods card"
      ><view
        v-for="line in cartLines"
        :key="line.productId"
        class="goods__line"
        :class="{ 'goods__line--invalid': invalidLineIds.includes(line.productId) }"
        ><image :src="line.image" mode="aspectFit" /><text class="goods__name"
          >{{ line.asSeckill ? '秒杀 · ' : '' }}{{ line.name }} × {{ line.quantity }}</text
        ><text>¥{{ fenToYuan(line.price * line.quantity) }}</text></view
      ></view
    ><!-- 夜宵券选择器：可用券 + 不可用原因 + 领取入口（与白天券隔离） -->
    <view class="section-title"
      ><text class="section-title__main">夜宵券</text
      ><text class="section-title__sub">仅限夜宵订单使用</text></view
    ><view class="coupon-list card"
      ><view
        class="coupon-opt"
        :class="{ 'coupon-opt--active': !selectedCouponId }"
        @tap="chooseCoupon(null)"
        ><text class="coupon-opt__name">不使用夜宵券</text
        ><text class="coupon-opt__mark">✓</text></view
      ><view
        v-for="item in usableCoupons"
        :key="item.id"
        class="coupon-opt"
        :class="{ 'coupon-opt--active': selectedCouponId === item.id }"
        @tap="chooseCoupon(item)"
        ><view class="coupon-opt__info"
          ><text class="coupon-opt__name">{{ item.coupon.name }}</text
          ><text class="coupon-opt__desc"
            >满 {{ fenToYuan(item.coupon.threshold) }} 元可用 · 可省
            ¥{{ fenToYuan(item.coupon.amount) }} 元</text
          ></view
        ><text class="coupon-opt__mark">✓</text></view
      ><view
        v-for="item in disabledCoupons"
        :key="item.id"
        class="coupon-opt coupon-opt--disabled"
        @tap="chooseCoupon(item)"
        ><view class="coupon-opt__info"
          ><text class="coupon-opt__name">{{ item.coupon.name }}</text
          ><text class="coupon-opt__desc">{{ couponReason(item) }}</text></view
        ></view
      ><view v-if="!usableCoupons.length && !disabledCoupons.length" class="coupon-opt coupon-opt--empty"
        ><text>{{ claimable.length ? '暂无夜宵券，下方可领取' : '暂无可用夜宵券' }}</text></view
      ></view
    ><view v-if="claimable.length" class="coupon-claim card"
      ><view
        v-for="coupon in claimable"
        :key="coupon.id"
        class="coupon-claim__row"
        ><view class="coupon-claim__info"
          ><text class="coupon-claim__name">{{ coupon.name }}</text
          ><text class="coupon-claim__desc"
            >满 {{ fenToYuan(coupon.threshold) }} 元可用 ·
            {{ fenToYuan(coupon.amount) }} 元</text
          ></view
        ><button class="coupon-claim__btn" @tap="claim(coupon)">领取</button></view
      ></view
    ><!-- 备注（DTO 上限 60 字） -->
    <view class="section-title"
      ><text class="section-title__main">订单备注</text></view
    ><view class="remark card"
      ><input
        v-model="remark"
        class="remark__input"
        maxlength="60"
        placeholder="选填，给楼长捎句话（60 字内）"
        placeholder-class="remark__placeholder"
      /></view
    ><!-- 账单：原价合计/券优惠/配送费/应付 -->
    <view class="bill card"
      ><view
        ><text>商品金额</text
        ><text>¥{{ fenToYuan(productAmount) }}</text></view
      ><view
        ><text>配送费</text
        ><text>¥{{ fenToYuan(deliveryFee) }}</text></view
      ><view class="bill__coupon"
        ><text>{{ selectedCoupon?.coupon.name || "夜宵券优惠" }}</text
        ><text>−¥{{ fenToYuan(effectiveDiscount) }}</text></view
      ><view class="bill__total"
        ><text>应付</text
        ><text>¥{{ fenToYuan(payableAmount) }}</text></view
      ></view
    ><view class="submit safe-bottom"
      ><view
        ><text class="muted">楼长送到寝室 · 微信支付</text
        ><text class="submit__price">¥{{ fenToYuan(payableAmount) }}</text></view
      ><button
        class="primary-btn"
        :disabled="submitting || !currentAddress || !cartLines.length"
        @tap="submit"
      >
        {{ submitting ? "正在支付…" : "确认支付" }}
      </button></view
    ></template
    >
    <PhoneGate
      v-if="session.needsPhone && !gateDismissed"
      @close="gateDismissed = true"
    />
  </view>
</template>

<style scoped lang="scss">
@import "../../styles/theme.scss";
.page.night-checkout {
  padding-bottom: calc(200rpx + env(safe-area-inset-bottom));
}
.checkout-skeleton {
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
  margin-bottom: 8rpx;
}
.address {
  padding: 30rpx;
  border-left: 8rpx solid #17332a;
  background: linear-gradient(135deg, #f0f5e9, #fff 140%);
}
.address__flag {
  display: block;
  color: #1d5c3c;
  font-size: 22rpx;
  font-weight: 800;
}
.address__head { display: flex; align-items: center; justify-content: space-between; }
.address__manage { margin: -12rpx -12rpx -12rpx 0; padding: 0 12rpx; min-height: 44px; display: flex; align-items: center; color: #335e40; background: transparent; font-size: 24rpx; line-height: 1.4; }
.address__manage::after { border: none; }
.address--empty {
  border-left-color: #d4380d;
  background: linear-gradient(135deg, #fff1ec, #fff);
}
.address--empty .address__flag,
.address--empty .address__room {
  color: #d4380d;
}
.address__opt {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid $line;
}
.address__opt:last-child {
  border-bottom: none;
}
.address__opt--active .address__room {
  color: $primary-dark;
}
.address__room {
  flex: 1;
  min-width: 0;
  display: block;
  font-size: 30rpx;
  font-weight: 900;
  margin-bottom: 4rpx;
}
.address__check {
  flex-shrink: 0;
  width: 44rpx;
  height: 44rpx;
  border: 2rpx solid $line;
  border-radius: 50%;
  color: #fff;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.address__check--on {
  background: $primary;
  border-color: $primary;
}
.invalid {
  margin-top: 22rpx;
  padding: 24rpx 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  border: 2rpx solid rgba(212, 56, 13, 0.35);
  background: #fff7f3;
}
/* 店铺未营业软提示（营业窗口外仍可浏览结算准备） */
.window-tip {
  margin-top: 22rpx;
  background: #f2f4f2;
  border: 2rpx solid rgba(30, 37, 32, 0.1);
  border-radius: 20rpx;
  padding: 18rpx 24rpx;
  font-size: 22rpx;
  color: #566159;
  line-height: 1.6;
}
.invalid__title {
  display: block;
  color: #d4380d;
  font-weight: 800;
  font-size: 26rpx;
  margin-bottom: 6rpx;
}
.invalid__btn {
  flex-shrink: 0;
  min-height: 72rpx;
  margin: 0;
  padding: 0 28rpx;
  line-height: 72rpx;
  border-radius: 36rpx;
  background: #fff;
  border: 2rpx solid rgba(212, 56, 13, 0.45);
  color: #d4380d;
  font-size: 23rpx;
  font-weight: 700;
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
.goods__line:last-child {
  border-bottom: none;
}
.goods__line--invalid {
  opacity: 0.5;
}
.goods__line image {
  width: 80rpx;
  height: 80rpx;
  background: $primary-soft;
  border-radius: 18rpx;
}
.goods__name {
  font-size: 25rpx;
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
.coupon-claim {
  margin-top: 18rpx;
  padding: 6rpx 26rpx;
}
.coupon-claim__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 0;
  border-bottom: 2rpx solid $line;
}
.coupon-claim__row:last-child {
  border-bottom: none;
}
.coupon-claim__info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}
.coupon-claim__name {
  font-weight: 800;
  font-size: 25rpx;
}
.coupon-claim__desc {
  font-size: 21rpx;
  color: #667069;
}
.coupon-claim__btn {
  flex-shrink: 0;
  min-height: 68rpx;
  margin: 0;
  padding: 0 30rpx;
  line-height: 68rpx;
  border-radius: 34rpx;
  background: $primary-soft;
  border: 2rpx solid rgba(7, 136, 59, 0.35);
  color: $primary-dark;
  font-size: 23rpx;
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
.bill {
  margin-top: 22rpx;
  padding: 26rpx;
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
