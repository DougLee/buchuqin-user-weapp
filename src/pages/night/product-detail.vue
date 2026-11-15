<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow, onHide, onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import { nightApi } from "../../api/night";
import { createBusinessRequestScope } from "../../utils/businessContext";
import { useVisibleNow } from "../../utils/visibleNow";
import { track } from "../../utils/track";
import PhoneGate from "../../components/PhoneGate.vue";
import ServiceSheet from "../../components/ServiceSheet.vue";
import { useNightCartStore } from "../../stores/nightCart";
import { useSessionStore } from "../../stores/session";
import { fenToYuan } from "../../utils/money";
import {
  countdownText,
  PROMO_TAG,
} from "../../utils/promotion";
import type { NightProduct } from "../../types/night";

/**
 * 夜宵商品详情页（IKU0KZ 道哥 2026-11-09）：与白天详情页同构——多图轮播/
 * 价格（秒杀生效价）/促销倒计时/售罄与限购标注/服务保障/临期合规/商品介绍/
 * 底栏客服+分享+购物车+加购。数据源=本店货架（storeProducts 按 id 取行，
 * 夜店商品量小单次请求够用，后端零改动）；加购走夜宵购物车，口径与货架一致。
 */
const cart = useNightCartStore();
const session = useSessionStore();
const storeId = ref("");
const buildingId = ref("");
const productId = ref("");
const promotionId = ref("");
const scope = createBusinessRequestScope();
const identity = () => `${uni.getStorageSync("token") || ""}:${uni.getStorageSync("nightCartOwner") || ""}`;
let loadedIdentity = "";
onHide(() => { scope.invalidate(); storeOpen.value = false; });
onShow(() => { if (productId.value) void load(); });
const product = ref<NightProduct>();
const loading = ref(true);
const error = ref(false);
/* 促销倒计时：详情页秒级跳动，离开页面即清（同白天详情页） */
const now = useVisibleNow();
onLoad((q) => {
  storeId.value = String(q?.storeId || "");
  buildingId.value = String(q?.buildingId || "");
  productId.value = String(q?.id || "");
  promotionId.value = String(q?.promotionId || "");
  track("page_view", "night-product");
});
async function load() {
  if (!storeId.value || !productId.value) {
    error.value = true;
    loading.value = false;
    return;
  }
  let current = scope.begin();
  loading.value = true;
  error.value = false;
  storeOpen.value = false;
  product.value = undefined;
  try {
    await session.ensureLogin();
    // 登录可能更新 token：在登录完成后重新绑定请求身份。
    if (!current.isLatest()) return;
    current = scope.begin();
    const [detail, rows] = await Promise.all([
      nightApi.storeDetail(storeId.value), nightApi.storeProducts(storeId.value),
    ]);
    if (!current()) return;
    const row = rows.find(p => p.id === productId.value);
    if (!row || (promotionId.value && row.seckill?.id !== promotionId.value)) {
      error.value = true;
      return;
    }
    product.value = { ...row, asSeckill: !!promotionId.value };
    buildingId.value = detail.buildingId;
    storeOpen.value = detail.state === "open";
    loadedIdentity = identity();
  } catch {
    if (current.isLatest()) error.value = true;
  } finally {
    if (current.isLatest()) {
      loading.value = false;
      if (!current()) error.value = true;
    }
  }
}
/** 生效价（秒杀口径同首页/货架）：秒杀身份行价格=秒杀价，划线=夜售价 */
const onSeckill = computed(
  () => !!product.value?.asSeckill && !!product.value?.seckill,
);
const price = computed(() =>
  onSeckill.value && product.value?.seckill
    ? product.value.seckill.price
    : product.value?.price ?? 0,
);
const originalPrice = computed(() => {
  const p = product.value;
  if (!p) return 0;
  return onSeckill.value ? p.price : p.originalPrice ?? 0;
});
/** 促销/秒杀倒计时统一挂 promotion 位（秒杀价签与倒计时同源展示） */
const promo = computed(() => {
  const p = product.value;
  if (!p) return null;
  if (onSeckill.value && p.seckill)
    return { type: "seckill", endsAt: p.seckill.endsAt };
  return p.promotion;
});
/** 详情多图（IK9SNR 同口径）：images[] 优先，无则退单图 */
const gallery = computed(() => {
  const images = (product.value?.images ?? []).filter(
    (url): url is string => typeof url === "string" && !!url,
  );
  return images.length
    ? images
    : product.value?.image
      ? [product.value.image]
      : [];
});
const soldOut = computed(() => !!product.value?.soldOut);
const stockHint = computed(() => {
  const rest = product.value?.stock ?? 0;
  return rest > 0 && rest <= 5 ? `仅剩 ${rest} 件` : "";
});
/** 限购标注：周期限购常驻；秒杀生效时常驻「每人限购 1 件」（同白天） */
const limitText = computed(() => {
  const p = product.value;
  if (!p) return "";
  if (onSeckill.value) return "每人限购 1 件";
  if (p.purchaseLimitMeta)
    return (
      (({ once: "每人终身", weekly: "每人每周", monthly: "每人每月" } as Record<
        string,
        string
      >)[p.purchaseLimitMeta.kind] || "每人") + `限购 ${p.purchaseLimitMeta.qty} 件`
    );
  return "";
});
/** 店铺营业态：休息中可看详情，加购拦截（服务端窗口校验兜底） */
const storeOpen = ref(false);
const qty = computed(() =>
  product.value
    ? cart.quantityOf(
        storeId.value,
        product.value.id,
        onSeckill.value,
        onSeckill.value ? product.value.seckill?.id : undefined,
      )
    : 0,
);
const add = async () => {
  const p = product.value;
  if (!p || loading.value || error.value) return;
  if (loadedIdentity !== identity()) {
    error.value = true; storeOpen.value = false;
    return;
  }
  if (!storeOpen.value) {
    uni.showToast({ title: "店铺休息中，开门后再来选购", icon: "none" });
    return;
  }
  if (onSeckill.value && p.seckill && new Date(p.seckill.endsAt).getTime() <= Date.now()) {
    uni.showToast({ title: "秒杀活动已结束，请刷新店铺", icon: "none" });
    return;
  }
  if (soldOut.value || qty.value >= Math.min(p.stock, onSeckill.value ? 1 : 999, p.purchaseLimitMeta?.qty ?? 999)) {
    uni.showToast({ title: p.stock ? "已达到可购数量" : "已抢完，看看别的吧", icon: "none" });
    return;
  }
  if (session.needsPhone) {
    phoneGateOpen.value = true;
    return;
  }
  const result = cart.setQuantity(
    { id: storeId.value, buildingId: buildingId.value, buildingName: "" },
    onSeckill.value && p.seckill
      ? { ...p, asSeckill: true, price: p.seckill.price, originalPrice: p.price, promotion: { ...p.seckill, type: "seckill" } }
      : p,
    qty.value + 1,
  );
  if (result === false) {
    uni.showToast({
      title:
        onSeckill.value &&
        cart.linesOf(storeId.value).some((l) => l.asSeckill && l.productId !== p.id)
          ? "每单仅支持一种秒杀商品"
          : "请先移除购物车中的该商品，再切换购买方式",
      icon: "none",
    });
    return;
  }
  uni.showToast({ title: "已放进购物车", icon: "success" });
};
const phoneGateOpen = ref(false);
const onPhoneBound = () => {
  phoneGateOpen.value = false;
  void add();
};
/** 购物车入口：夜场无弹层（与首页同口径），跳购物车 Tab */
const goCart = () => uni.switchTab({ url: "/pages/cart/index" });
/** 分享：落首页（businessType=night），接收者按地址定店（与夜分享链路一致） */
onShareAppMessage(() => {
  track("share", productId.value);
  const p = product.value;
  const c = session.user?.campusId;
  if (!p)
    return {
      title: "本楼夜宵店，好物送到寝室",
      path: c ? `/pages/index/index?campus=${c}&businessType=night` : "/pages/index/index?businessType=night",
    };
  return {
    title: `¥${fenToYuan(price.value)} ${p.name} 点击抢购>>`,
    path: c ? `/pages/index/index?campus=${c}&businessType=night` : "/pages/index/index?businessType=night",
    imageUrl: p.image || undefined,
  };
});
onShareTimeline(() => {
  const p = product.value;
  const c = session.user?.campusId;
  if (!p) return { title: "本楼夜宵店，好物送到寝室" };
  return {
    title: `¥${fenToYuan(price.value)} ${p.name} 点击抢购>>`,
    query: c ? `campus=${c}&businessType=night` : "businessType=night",
  };
});
const serviceOpen = ref(false);
</script>
<template>
  <view v-if="error" class="detail-error card" @tap="load"
    ><text class="detail-error__title">商品加载失败</text
    ><text class="muted">网络异常或商品已下架，点击重试</text></view
  >
  <view v-else-if="loading || !product" class="detail"
    ><view class="visual detail-skeleton__visual" /><view class="content"
      ><view class="card detail-skeleton__block" /><view
        class="card detail-skeleton__block detail-skeleton__block--short"
      /></view
    ></view
  >
  <view v-else class="detail"
    ><view class="visual"
      ><swiper
        class="visual__swiper"
        :indicator-dots="gallery.length > 1"
        indicator-color="rgba(21, 75, 38, 0.25)"
        indicator-active-color="#159447"
        :circular="gallery.length > 1"
      >
        <swiper-item v-for="(img, i) in gallery" :key="i">
          <image :src="img" mode="aspectFit" :alt="product.name" />
        </swiper-item>
      </swiper>
      <text
        class="visual__tag"
        :class="{ 'visual__tag--promo': promo }"
        >{{ promo ? PROMO_TAG[promo.type] : "" }}</text
      ></view
    ><view class="content"
      ><view class="card info"
        ><text class="info__name">{{ product.name }}</text
        ><text class="info__sub">{{ product.subtitle }}</text
        ><view class="info__price"
          ><text class="price"
            ><text class="price__symbol">¥</text>{{ fenToYuan(price) }}</text
          ><text v-if="originalPrice > price" class="original">¥{{ fenToYuan(originalPrice) }}</text
          ><text v-if="promo" class="promo-count"
            >{{ PROMO_TAG[promo.type] }} · 距结束
            {{ countdownText(promo.endsAt, now) }}</text
          ><text v-if="soldOut" class="stock-flag stock-flag--out">已抢完</text
          ><text v-else-if="stockHint" class="stock-flag">{{ stockHint }}</text
          ><text v-if="limitText" class="stock-flag">{{ limitText }}</text
          ></view
        ></view
      ><view class="card guarantee"
        ><view
          ><text class="guarantee__title">本楼夜宵店现货</text
          ><text class="muted">楼长备足才开门营业</text></view
        ><view
          ><text class="guarantee__title">下单即送</text
          ><text class="muted">楼长亲自送到寝室</text></view
        ></view
      ><!-- 临期合规提示（IKAHFH 同口径）：clearance 活动硬性展示项 --><view
        v-if="promo?.type === 'clearance'"
        class="card clearance"
        ><text class="clearance__title">临期特惠</text
        ><text class="clearance__text"
          >本商品临近保质期，请在保质期内尽快食用；介意慎拍，售出后不支持以此为由退换。</text
        ></view
      ><view v-if="product.description" class="card desc"
        ><text class="desc__title">商品介绍</text
        ><text class="desc__text">{{ product.description }}</text
        ></view
      ><view v-if="limitText && product.purchaseLimitMeta" class="card desc"
        ><text class="desc__text">含待支付订单计算限购；未支付订单超时关单后额度自动释放。</text
        ></view
      ><view class="story"
        ><text class="story__eyebrow">本楼夜宵店</text
        ><text class="story__title">夜里饿了，不用下楼。</text
        ><text class="muted">楼长自营本楼夜宵店，营业中下单，直接送到你的寝室门口。</text
        ></view
      ></view
    ><view class="bottom safe-bottom"
      ><!-- #ifdef MP-WEIXIN -->
      <button class="service-mini" aria-label="客服" @tap="serviceOpen = true">
        客服
      </button>
      <button class="service-mini" open-type="share" aria-label="分享">
        分享
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <button class="service-mini" @tap="serviceOpen = true" aria-label="客服">
        客服
      </button>
      <!-- #endif -->
      <button class="bag" @tap="goCart">
        购物车 {{ cart.countOf(storeId) || "" }}</button
      ><button class="primary-btn" :disabled="soldOut" @tap="add">
        {{ soldOut ? "已抢完" : "加入购物车" }}
      </button></view
    ></view
  >
  <PhoneGate
    v-if="phoneGateOpen && session.needsPhone"
    @bound="onPhoneBound"
    @close="phoneGateOpen = false"
  />
  <ServiceSheet :visible="serviceOpen" @close="serviceOpen = false" />
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.detail {
  min-height: 100vh;
  background: $paper;
  padding-bottom: 170rpx;
}
.visual {
  height: 600rpx;
  background: radial-gradient(
    circle at 50% 45%,
    #fff 0,
    $primary-soft 58%,
    #d9f4df 100%
  );
  position: relative;
}
.visual__swiper,
.visual__swiper swiper-item,
.visual image {
  width: 100%;
  height: 100%;
}
.visual__swiper {
  height: 100%;
}
.visual__tag {
  position: absolute;
  left: 32rpx;
  bottom: 30rpx;
  background: $primary;
  color: #fff;
  padding: 12rpx 22rpx;
  border-radius: 28rpx;
  font-weight: 800;
}
.content {
  padding: 0 28rpx;
  margin-top: -24rpx;
  position: relative;
}
.info {
  padding: 32rpx;
}
.info__name {
  display: block;
  font-size: 44rpx;
  font-weight: 900;
}
.info__sub {
  display: block;
  color: #667069;
  margin-top: 10rpx;
}
.info__price {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-top: 28rpx;
  flex-wrap: wrap;
}
.info__price .price {
  font-size: 48rpx;
}
.original {
  text-decoration: line-through;
  color: #667069;
}
.promo-count {
  align-self: center;
  padding: 4rpx 14rpx;
  border-radius: 18rpx;
  font-size: 20rpx;
  font-weight: 800;
  color: $orange;
  background: $cream;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.visual__tag--promo {
  background: $orange;
}
.stock-flag {
  align-self: center;
  padding: 4rpx 14rpx;
  border-radius: 18rpx;
  font-size: 20rpx;
  font-weight: 800;
  color: $orange;
  background: $cream;
}
.stock-flag--out {
  color: #fff;
  background: $orange;
}
.primary-btn[disabled] {
  opacity: 0.55;
}
.service-mini {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: $paper;
  color: #8a938d;
  border: 2rpx solid $line;
  font-size: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  flex-shrink: 0;
}
.guarantee {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 22rpx;
  padding: 26rpx;
  background: linear-gradient(135deg, #f3fff5, #fff);
}
.clearance {
  margin-top: 22rpx;
  padding: 26rpx;
  background: linear-gradient(135deg, #fff8ec, #fff);
  border: 2rpx solid rgba(230, 162, 60, 0.35);
}
.clearance__title {
  display: block;
  font-size: 28rpx;
  font-weight: 900;
  color: #b1560f;
  margin-bottom: 12rpx;
}
.clearance__text {
  display: block;
  font-size: 25rpx;
  line-height: 1.8;
  color: $ink;
}
.desc {
  margin-top: 22rpx;
  padding: 26rpx;
}
.desc__title {
  display: block;
  font-size: 28rpx;
  font-weight: 900;
  margin-bottom: 12rpx;
}
.desc__text {
  display: block;
  font-size: 25rpx;
  line-height: 1.8;
  color: $ink;
  white-space: pre-line;
  word-break: break-all;
}
.guarantee > view + view {
  border-left: 2rpx solid $line;
  padding-left: 28rpx;
}
.guarantee__title {
  display: block;
  font-weight: 800;
  margin-bottom: 6rpx;
  color: $primary-dark;
}
.story {
  padding: 48rpx 10rpx;
}
.story__eyebrow {
  color: $primary-dark;
  font-weight: 800;
}
.story__title {
  display: block;
  font-size: 38rpx;
  font-weight: 900;
  margin: 14rpx 0;
  line-height: 1.4;
}
.bottom {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 18rpx 28rpx;
  display: flex;
  gap: 18rpx;
  box-shadow: 0 -10rpx 30rpx rgba(21, 75, 38, 0.09);
  z-index: 20;
}
.bottom button {
  margin: 0;
  min-height: 92rpx;
}
.bag {
  width: 220rpx;
  border-radius: 46rpx;
  background: $primary-soft;
  color: $primary-dark;
  border: 2rpx solid rgba(37, 185, 90, 0.18);
  font-weight: 800;
}
.bottom .primary-btn {
  flex: 1;
}
.detail-error {
  margin: 28rpx;
  padding: 160rpx 30rpx;
  text-align: center;
}
.detail-error__title {
  display: block;
  font-weight: 900;
  color: $primary-dark;
  margin-bottom: 8rpx;
}
.detail-skeleton__visual {
  animation: detail-pulse 1.2s infinite;
}
.detail-skeleton__block {
  height: 260rpx;
  margin-top: 22rpx;
  animation: detail-pulse 1.2s infinite;
}
.detail-skeleton__block--short {
  height: 160rpx;
}
@keyframes detail-pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
