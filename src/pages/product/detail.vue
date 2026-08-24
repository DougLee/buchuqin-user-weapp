<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import { isRetryable } from "../../api/request";
import { useCartStore } from "../../stores/cart";
import { fenToYuan } from "../../utils/money";
import { countdownText, PROMO_TAG } from "../../utils/promotion";
import { SERVICE_PHONE } from "../../utils/service";
import type { Product } from "../../types";
const product = ref<Product>(),
  cart = useCartStore(),
  productId = ref(""),
  loading = ref(true),
  error = ref(false);
/* 促销倒计时（IKAHFG/ADR-0006）：详情页秒级跳动，离开页面即清 */
const now = ref(Date.now());
const promoTicker = setInterval(() => (now.value = Date.now()), 1000);
onUnmounted(() => clearInterval(promoTicker));
onLoad(async (q) => {
  productId.value = String(q?.id || "");
  await cart.load();
  await load();
});
/** 详情三态（IK9AWK）：加载骨架 / 失败重试 / 内容；无 id 视为链接无效 */
async function load() {
  if (!productId.value) {
    error.value = true;
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = false;
  try {
    product.value = await api.product(productId.value);
  } catch (e) {
    // ADR-0005(IKA00Q)：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
    if (isRetryable(e)) error.value = true;
  } finally {
    loading.value = false;
  }
}
/** 库存行内引导（ADR-0005/IKA00Q）：售罄置灰禁买、低库存提示余量 */
const soldOut = computed(() => (product.value?.stock ?? 0) <= 0);
const stockHint = computed(() => {
  const rest = product.value?.stock ?? 0;
  return rest > 0 && rest <= 5 ? `仅剩 ${rest} 件` : "";
});
const add = async () => {
  if (!product.value) return;
  if (soldOut.value) {
    uni.showToast({ title: "已抢完，看看别的吧", icon: "none" });
    return;
  }
  const ok = await cart.set(
    product.value,
    cart.quantity(product.value.id) + 1,
  );
  if (ok) uni.showToast({ title: "已放进购物车", icon: "success" });
};
// 跨工位契约：购物车悬浮窗由工位 B 全局挂载，emit open-cart 唤起，不 import 组件
const openCart = () => uni.$emit("open-cart");
// H5 端无 contact 能力，直接拨客服电话（IK9AWJ）
const onService = () => uni.makePhoneCall({ phoneNumber: SERVICE_PHONE });
/** 详情多图（IK9SNR）：后台 images[] 优先，无则退单图；至少一张保证轮播结构 */
const gallery = computed(() => {
  const images = (product.value?.images ?? []).filter(Boolean);
  return images.length ? images : product.value?.image ? [product.value.image] : [];
});
</script>
<template>
  <view v-if="error" class="detail-error card" @tap="load"
    ><text class="detail-error__title">商品加载失败</text
    ><text class="muted">网络异常或商品已下架，点击重试</text></view
  >
  <view v-else-if="loading || !product" class="detail"
    ><!-- 加载骨架（IK9AWK） -->
    <view class="visual detail-skeleton__visual" /><view class="content"
      ><view class="card detail-skeleton__block" /><view
        class="card detail-skeleton__block detail-skeleton__block--short"
      /></view
    ></view
  >
  <view v-else class="detail"
    ><view class="visual"
      ><!-- 详情多图（IK9SNR）：后台 images[] 轮播，多图时显示指示点 -->
      <swiper
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
        :class="{ 'visual__tag--promo': product.promotion }"
        >{{
          product.promotion ? PROMO_TAG[product.promotion.type] : product.tag
        }}</text
      ></view
    ><view class="content"
      ><view class="card info"
        ><text class="info__name">{{ product.name }}</text
        ><text class="info__sub">{{ product.subtitle }}</text
        ><view class="info__price"
          ><text class="price"
            ><text class="price__symbol">¥</text>{{ fenToYuan(product.price) }}</text
          ><text class="original">¥{{ fenToYuan(product.originalPrice) }}</text
          ><!-- 促销倒计时（IKAHFG/ADR-0006）：价格即促销价，划线为商品原价 --><text
            v-if="product.promotion"
            class="promo-count"
            >{{ PROMO_TAG[product.promotion.type] }} · 距结束
            {{ countdownText(product.promotion.endsAt, now) }}</text
          ><!-- 库存行内标注（ADR-0005/IKA00Q） --><text
            v-if="soldOut"
            class="stock-flag stock-flag--out"
            >已抢完</text
          ><text v-else-if="stockHint" class="stock-flag">{{ stockHint }}</text></view
        ></view
      ><view class="card guarantee"
        ><view
          ><text class="guarantee__title">校园仓现货</text
          ><text class="muted">仓里常备，随点随有</text></view
        ><view
          ><text class="guarantee__title">最快 30 分钟</text
          ><text class="muted">楼长送到寝室</text></view
        ></view
      ><!-- 临期合规提示（IKAHFH/ADR-0006）：clearance 活动硬性展示项，常驻不可关 --><view
        v-if="product.promotion?.type === 'clearance'"
        class="card clearance"
        ><text class="clearance__title">临期特惠</text
        ><text class="clearance__text"
          >本商品临近保质期，请在保质期内尽快食用；介意慎拍，售出后不支持以此为由退换。</text
        ></view
      ><!-- 商品介绍（IKAHAU）：后台维护的纯文本，空不渲染，换行保留 -->
      <view v-if="product.description" class="card desc"
        ><text class="desc__title">商品介绍</text
        ><text class="desc__text">{{ product.description }}</text
        ></view
      ><!-- 假「商品演示」卡已摘除（IK9AWT）：占位图+生成文案冒充商品信息，仅保留真实流程说明（下方 story） -->
      <view class="story"
        ><text class="story__eyebrow">今晚的快乐很简单</text
        ><text class="story__title">不用换鞋，不用下楼。</text
        ><text class="muted"
          >下单后从你所在校区的校园仓出发，经配送员送到楼下，再由楼长送到你的寝室门口。</text
        ></view
      ></view
    ><view class="bottom safe-bottom"
      ><!-- 客服入口移至购物车左侧（IK9SNU）：小图标弱化，不抢「加入购物车」焦点 -->
      <!-- #ifdef MP-WEIXIN -->
      <button class="service-mini" open-type="contact" aria-label="客服">
        客服
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <button class="service-mini" @tap="onService" aria-label="客服">
        客服
      </button>
      <!-- #endif -->
      <button class="bag" @tap="uni.$emit('open-cart')">
        购物车 {{ cart.cart.totalQuantity || "" }}</button
      ><!-- 售罄置灰禁买（ADR-0005/IKA00Q） --><button
        class="primary-btn"
        :disabled="soldOut"
        @tap="add"
      >
        {{ soldOut ? "已抢完" : "加入购物车" }}
      </button></view
    ></view
  >
  <CartOverlay />
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
}
.info__price .price {
  font-size: 48rpx;
}
.original {
  text-decoration: line-through;
  color: #667069;
}
/* 促销倒计时（IKAHFG/ADR-0006）：橙字等宽数字，价格即促销价 */
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
/* 库存行内标注（ADR-0005/IKA00Q）：低库存橙底浅 chip，售罄实底 */
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
/* 底栏客服小按钮（IK9SNU）：弱化的次级入口，灰字细边，别抢主按钮视觉 */
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
/* 商品介绍（IKAHAU）：pre-line 保留后台录入的换行 */
/* 临期合规提示（IKAHFH）：暖黄底强调但不吓退，条目常驻 */
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
