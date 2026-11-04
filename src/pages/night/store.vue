<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShareAppMessage, onShow } from "@dcloudio/uni-app";
import { isRetryable } from "../../api/request";
import { nightApi } from "../../api/night";
import { useNightCartStore } from "../../stores/nightCart";
import { useSessionStore } from "../../stores/session";
import { fenToYuan } from "../../utils/money";
import type {
  NightClaimableCoupon,
  NightProduct,
  NightStoreRow,
} from "../../types/night";
import PhoneGate from "../../components/PhoneGate.vue";

/**
 * 夜宵店铺页（IKSW1F 三态）：
 * - no-manager：招募中提示页（不可进店，buildings 页已拦，这里兜底态）；
 * - resting：店头显示「XX:00 开门营业」，商品可浏览、加购/结算禁用；
 * - open：商品平铺卡片流 + 底部购物车条（本地暂存车）+ 店内领券。
 * 页面形态独立简洁：店头（楼栋名+状态+公告）+ 平铺商品 + 购物车条，
 * 不做分类侧栏（商品量 10~30）。分享带店铺参数，接收者落楼栋选择页
 * 过楼栋确认后才进店。
 */
const cart = useNightCartStore();
const session = useSessionStore();
const storeId = ref("");
const buildingId = ref("");
const store = ref<NightStoreRow>();
const sessionInfo = ref<NightStoreRow["session"]>();
const products = ref<NightProduct[]>([]);
const loading = ref(true);
const error = ref(false);
/** 领券区数据（marketingEnabled=false 时 claimable 为空数组） */
const claimable = ref<NightClaimableCoupon[]>([]);
const mineCount = ref(0);
const claimingId = ref("");
/** IKE3HT 同款收网：未绑手机号点加购先弹授权层（可关闭，结算页兜底） */
const phoneGateOpen = ref(false);
let pendingProduct: NightProduct | undefined;

const isOpen = computed(() => store.value?.state === "open");
/** 未开业店头文案：休息中给开门时间窗；无楼长给招募语 */
const openHint = computed(() => {
  if (store.value?.state === "no-manager")
    return "本楼夜宵店招募楼长中，暂未开业";
  const s = sessionInfo.value;
  if (s?.nightStartAt && s?.nightEndAt)
    return `${s.nightStartAt} 开门营业`;
  return "楼长休息中，开门后可下单";
});
const cartLines = computed(() => cart.linesOf(storeId.value));
const cartCount = computed(() => cart.countOf(storeId.value));
const cartAmount = computed(() => cart.amountOf(storeId.value));

async function load() {
  if (!storeId.value) return;
  loading.value = !store.value;
  error.value = false;
  try {
    // 详情（三态+场次）与商品（可购清单）并行；券静默降级（营销未开通不阻塞）
    const [detail, goods] = await Promise.all([
      nightApi.storeDetail(storeId.value),
      nightApi.storeProducts(storeId.value),
    ]);
    store.value = detail;
    sessionInfo.value = detail.session;
    if (detail.buildingId) buildingId.value = detail.buildingId;
    products.value = goods;
    void loadCoupons();
  } catch (e) {
    if (isRetryable(e)) error.value = true;
  } finally {
    loading.value = false;
  }
}
async function loadCoupons() {
  try {
    const bundle = await nightApi.coupons();
    claimable.value = bundle.claimable;
    mineCount.value = bundle.mine.filter(
      (x) => x.status === "claimed" || x.status === "released",
    ).length;
  } catch {
    claimable.value = [];
  }
}
onLoad((q) => {
  storeId.value = String(q?.storeId || "");
  buildingId.value = String(q?.buildingId || "");
  uni.setNavigationBarTitle({ title: "夜宵店" });
});
onShow(() => {
  void session.ensureLogin().catch(() => {});
  load();
});
/* ---------- 加购（本地暂存车） ---------- */
function quantityOf(product: NightProduct) {
  return cart.quantityOf(storeId.value, product.id);
}
function add(product: NightProduct) {
  if (!isOpen.value) {
    uni.showToast({ title: `${openHint.value}，先逛逛吧`, icon: "none" });
    return;
  }
  // IKE3HT 收网：未绑手机号先弹授权，绑定成功（@bound）补执行加购
  if (session.needsPhone) {
    pendingProduct = product;
    phoneGateOpen.value = true;
    return;
  }
  cart.setQuantity(
    {
      id: storeId.value,
      buildingId: buildingId.value,
      buildingName: store.value?.buildingName ?? "",
    },
    product,
    quantityOf(product) + 1,
  );
}
function removeLine(product: NightProduct) {
  cart.setQuantity(
    {
      id: storeId.value,
      buildingId: buildingId.value,
      buildingName: store.value?.buildingName ?? "",
    },
    product,
    quantityOf(product) - 1,
  );
}
function onPhoneBound() {
  phoneGateOpen.value = false;
  if (pendingProduct) {
    const product = pendingProduct;
    pendingProduct = undefined;
    if (isOpen.value)
      cart.setQuantity(
        {
          id: storeId.value,
          buildingId: buildingId.value,
          buildingName: store.value?.buildingName ?? "",
        },
        product,
        quantityOf(product) + 1,
      );
  }
}
/* ---------- 领券（夜宵券与白天券双向隔离） ---------- */
async function claim(coupon: NightClaimableCoupon) {
  if (claimingId.value) return;
  claimingId.value = coupon.id;
  try {
    await nightApi.claimCoupon(coupon.id);
    uni.showToast({ title: "领取成功", icon: "success" });
    await loadCoupons();
  } catch {
    // 业务原因（领完/限领）request 层已 toast
  } finally {
    claimingId.value = "";
  }
}
/* ---------- 结算 ---------- */
function goCheckout() {
  if (!cartCount.value) {
    uni.showToast({ title: "先挑点夜宵吧", icon: "none" });
    return;
  }
  if (!isOpen.value) {
    uni.showToast({ title: `${openHint.value}，暂时不能下单`, icon: "none" });
    return;
  }
  uni.navigateTo({
    url: `/pages/night/checkout?storeId=${storeId.value}&buildingId=${buildingId.value}`,
  });
}
/* ---------- 分享：带店铺参数，接收者落楼栋页过楼栋确认 ---------- */
onShareAppMessage(() => {
  const name = store.value?.buildingName ?? "夜宵店";
  return {
    title: `🌙 ${name}夜宵店开业中，零食送到寝室`,
    path: `/pages/night/buildings?buildingId=${buildingId.value}`,
  };
});
</script>

<template>
  <view class="page night-store"
    ><view v-if="error" class="retry card" @tap="load"
      ><text class="retry__title">店铺加载失败</text
      ><text class="muted">网络异常，点击重试</text></view
    ><view v-else-if="loading && !store" class="skeleton"
      ><view class="skeleton__head" /><view class="skeleton__grid"
        ><view v-for="n in 4" :key="n" class="skeleton__card" /></view
    ></view
    ><template v-else-if="store"
    ><!-- 店头：楼栋名+营业状态+公告位（一期恒空，有值才渲染） -->
    <view class="shop-head"
      ><view class="shop-head__row"
        ><text class="shop-head__name">{{ store.buildingName }}·夜宵店</text
        ><text
          class="shop-head__state"
          :class="`shop-head__state--${store.state}`"
          >{{
            store.state === "open"
              ? "营业中"
              : store.state === "resting"
                ? "休息中"
                : "招募楼长中"
          }}</text
        ></view
      ><text class="shop-head__hint">{{ openHint }}</text
      ><text v-if="store.announcement" class="shop-head__notice">{{
        store.announcement
      }}</text></view
    ><!-- 领券区（marketingEnabled=false / 无可领券整块不渲染） -->
    <view v-if="claimable.length || mineCount" class="coupons card"
      ><view class="coupons__head"
        ><text class="coupons__title">夜宵券</text
        ><text v-if="mineCount" class="coupons__mine"
          >已有 {{ mineCount }} 张可用</text
        ></view
      ><view
        v-for="coupon in claimable"
        :key="coupon.id"
        class="coupons__row"
        ><view class="coupons__info"
          ><text class="coupons__name">{{ coupon.name }}</text
          ><text class="coupons__desc"
            >满 {{ fenToYuan(coupon.threshold) }} 元可用 ·
            {{ fenToYuan(coupon.amount) }} 元</text
          ></view
        ><button
          class="coupons__claim"
          :disabled="claimingId === coupon.id"
          @tap="claim(coupon)"
        >
          {{ claimingId === coupon.id ? "领取中" : "领取" }}
        </button></view
      ></view
    ><!-- 商品平铺卡片流（无分类侧栏，10~30 件直排两列） -->
    <view v-if="!products.length" class="empty"
      ><text class="empty__mark">🌙</text
      ><text class="empty__title">货架空着</text
      ><text class="muted">楼长备货后这里就热闹了</text></view
    ><view v-else class="grid"
      ><view v-for="p in products" :key="p.id" class="goods card"
        ><image class="goods__image" :src="p.image" mode="aspectFit" /><text
          class="goods__name"
          >{{ p.name }}</text
        ><text v-if="p.subtitle" class="goods__subtitle">{{
          p.subtitle
        }}</text><view class="goods__bottom"
          ><text class="price"
            ><text class="price__symbol">¥</text
            >{{ fenToYuan(p.price) }}</text
          ><!-- 数量控制：0 显示单加号，>0 展开 − n ＋（夜间小目标热区 64rpx 起） -->
          <view v-if="quantityOf(p) > 0" class="stepper"
            ><text class="stepper__btn" @tap.stop="removeLine(p)">−</text
            ><text class="stepper__num">{{ quantityOf(p) }}</text
            ><text
              class="stepper__btn stepper__btn--add"
              @tap.stop="add(p)"
              >＋</text
            ></view
          ><text
            v-else
            class="goods__add"
            :class="{ 'goods__add--dim': !isOpen }"
            @tap.stop="add(p)"
            >＋</text
          ></view
        ></view
      ></view
    ></template
    ><!-- 底部购物车条：件数+金额+去结算（未开业置灰并给开门时间） -->
    <view v-if="store" class="cart-bar safe-bottom"
      ><view class="cart-bar__left"
        ><view class="cart-bar__badge" :class="{ 'cart-bar__badge--dim': !cartCount }"
          >🛒<text v-if="cartCount" class="cart-bar__count">{{
            cartCount
          }}</text></view
        ><text class="cart-bar__amount"
          >¥{{ fenToYuan(cartAmount) }}</text
        ></view
      ><button
        class="cart-bar__btn"
        :disabled="!cartCount || !isOpen"
        @tap="goCheckout"
      >
        {{
          isOpen
            ? cartCount
              ? "去结算"
              : "购物车是空的"
            : "未开业，先逛逛"
        }}
      </button></view
    >
    <PhoneGate
      v-if="phoneGateOpen && session.needsPhone"
      @bound="onPhoneBound"
      @close="phoneGateOpen = false"
    />
  </view>
</template>

<style scoped lang="scss">
@import "../../styles/theme.scss";
/* 页面自带购物车条：底部留白让位（条高约 130rpx + 安全区） */
.page.night-store {
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
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
.skeleton__head {
  height: 180rpx;
  border-radius: 28rpx;
  margin-bottom: 22rpx;
  background: linear-gradient(90deg, #232b26, #2f4436, #232b26);
  animation: night-pulse 1.2s infinite;
}
.skeleton__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
}
.skeleton__card {
  height: 390rpx;
  border-radius: 26rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: night-pulse 1.2s infinite;
}
@keyframes night-pulse {
  50% {
    opacity: 0.55;
  }
}
/* ---------- 店头：夜色卡（与白天店头视觉强区隔） ---------- */
.shop-head {
  border-radius: 28rpx;
  padding: 34rpx 30rpx;
  background: linear-gradient(120deg, #1e2520 0%, #17332a 70%, #0d5d31 160%);
  color: #fff;
  box-shadow: 0 12rpx 30rpx rgba(10, 34, 24, 0.26);
}
.shop-head__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.shop-head__name {
  font-size: 38rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}
.shop-head__state {
  flex-shrink: 0;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 800;
}
.shop-head__state--open {
  background: rgba(102, 227, 141, 0.22);
  border: 2rpx solid rgba(102, 227, 141, 0.55);
  color: #7dffab;
}
.shop-head__state--resting {
  background: rgba(255, 224, 130, 0.14);
  border: 2rpx solid rgba(255, 224, 130, 0.4);
  color: #ffe082;
}
.shop-head__state--no-manager {
  background: rgba(255, 255, 255, 0.1);
  border: 2rpx solid rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.75);
}
.shop-head__hint {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.78);
}
.shop-head__notice {
  display: block;
  margin-top: 14rpx;
  padding: 14rpx 18rpx;
  border-radius: 14rpx;
  background: rgba(255, 255, 255, 0.08);
  font-size: 22rpx;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.85);
}
/* ---------- 领券区 ---------- */
.coupons {
  margin-top: 22rpx;
  padding: 10rpx 26rpx;
}
.coupons__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 0 6rpx;
}
.coupons__title {
  font-size: 28rpx;
  font-weight: 900;
}
.coupons__mine {
  font-size: 21rpx;
  color: $muted;
}
.coupons__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 0;
  border-bottom: 2rpx solid $line;
}
.coupons__row:last-child {
  border-bottom: none;
}
.coupons__info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}
.coupons__name {
  font-weight: 800;
  font-size: 26rpx;
}
.coupons__desc {
  font-size: 22rpx;
  color: #667069;
}
.coupons__claim {
  flex-shrink: 0;
  min-height: 72rpx;
  margin: 0;
  padding: 0 34rpx;
  line-height: 72rpx;
  border-radius: 36rpx;
  background: $primary;
  color: #fff;
  font-size: 24rpx;
  font-weight: 800;
}
.coupons__claim[disabled] {
  opacity: 0.6;
}
/* ---------- 商品平铺卡片流 ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
  margin-top: 22rpx;
}
.goods {
  padding: 20rpx;
  display: flex;
  flex-direction: column;
}
.goods__image {
  width: 100%;
  height: 240rpx;
  border-radius: 18rpx;
  background: $primary-soft;
}
.goods__name {
  margin-top: 14rpx;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.goods__subtitle {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: $muted;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.goods__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 14rpx;
  min-height: 64rpx;
}
.goods__bottom .price {
  font-size: 30rpx;
}
.goods__add {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $primary;
  color: #fff;
  font-size: 38rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.goods__add--dim {
  background: #c7cdc8;
}
.stepper {
  display: flex;
  align-items: center;
  gap: 4rpx;
}
.stepper__btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $primary-soft;
  color: $primary-dark;
  font-size: 36rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stepper__btn--add {
  background: $primary;
  color: #fff;
}
.stepper__num {
  min-width: 56rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 800;
}
.empty {
  text-align: center;
  padding-top: 100rpx;
}
.empty__mark {
  display: flex;
  width: 140rpx;
  height: 140rpx;
  margin: auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #1e2520;
  font-size: 54rpx;
}
.empty__title {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
  margin: 30rpx 0 10rpx;
}
/* ---------- 底部购物车条 ---------- */
.cart-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  background: #fff;
  border-top: 2rpx solid rgba(32, 74, 45, 0.08);
  box-shadow: 0 -8rpx 26rpx rgba(21, 75, 38, 0.08);
  padding: 16rpx 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.cart-bar__left {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}
.cart-bar__badge {
  position: relative;
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
  background: #1e2520;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  margin-top: -40rpx;
  box-shadow: 0 8rpx 20rpx rgba(10, 34, 24, 0.3);
}
.cart-bar__badge--dim {
  background: #c7cdc8;
}
.cart-bar__count {
  position: absolute;
  top: -6rpx;
  right: -6rpx;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 8rpx;
  border-radius: 18rpx;
  background: #ff4d2e;
  color: #fff;
  font-size: 20rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #fff;
  box-sizing: content-box;
}
.cart-bar__amount {
  font-size: 36rpx;
  font-weight: 900;
  color: #ff4d18;
}
.cart-bar__btn {
  flex-shrink: 0;
  min-width: 260rpx;
  min-height: 88rpx;
  margin: 0;
  line-height: 88rpx;
  border-radius: 44rpx;
  background: linear-gradient(135deg, $primary-dark, $primary);
  color: #fff;
  font-size: 28rpx;
  font-weight: 800;
}
.cart-bar__btn[disabled] {
  opacity: 0.55;
  background: #c7cdc8;
  color: #fff;
}
</style>
