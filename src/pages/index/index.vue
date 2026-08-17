<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import ProductCard from "../../components/ProductCard.vue";
import { useCartStore } from "../../stores/cart";
import { useSessionStore } from "../../stores/session";
import type { Address, Category, Product } from "../../types";

const categoryImages = [
  "/static/products/chips.svg",
  "/static/products/soda.svg",
  "/static/products/noodle.svg",
  "/static/products/tissue.svg",
  "/static/products/grape.svg",
  "/static/products/biscuit.svg",
];
const cart = useCartStore(),
  campus = ref("湖北工业大学"),
  defaultAddress = ref<Address | null>(null),
  categories = ref<Category[]>([]),
  products = ref<Product[]>([]),
  loading = ref(true);
/** 地址栏：默认地址的楼栋+寝室；无地址时引导去选择 */
const addressText = computed(() =>
  defaultAddress.value
    ? `${defaultAddress.value.buildingName} ${defaultAddress.value.room}`
    : "请选择地址",
);
onShow(async () => {
  await useSessionStore().ensureLogin();
  const [home, addresses] = await Promise.all([api.home(), api.addresses()]);
  campus.value = home.campus.name;
  defaultAddress.value =
    addresses.find((item) => item.isDefault) || addresses[0] || null;
  categories.value = home.categories;
  products.value = home.hotProducts;
  await cart.load();
  loading.value = false;
});
const banners = [
  {
    id: "fresh",
    theme: "green",
    tag: "今日爆款",
    title: "零食饮料 寝室直达",
    sub: "楼下自提柜 · 熄灯前都能送",
  },
  {
    id: "night",
    theme: "orange",
    tag: "夜宵专场",
    title: "泡面卤味 热乎到楼",
    sub: "每晚 21:00-23:30 加急配送",
  },
  {
    id: "recruit",
    theme: "dark",
    tag: "楼长招募令",
    title: "本楼楼长虚位以待",
    sub: "每单提成 + 月度底薪，扫码报名",
  },
] as const;
const add = (p: Product) => cart.set(p, cart.quantity(p.id) + 1);
const open = (id: string) =>
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
const goCategory = () => uni.switchTab({ url: "/pages/category/index" });
</script>

<template>
  <view class="page home">
    <view class="brand-row"
      ><text class="brand">不出寝食社</text><view class="brand-dot"
    /></view>
    <view
      class="location"
      @tap="uni.navigateTo({ url: '/pages/address/index' })"
      ><text class="pin">●</text
      ><text>配送至：{{ campus }} · {{ addressText }}</text
      ><text class="down">⌄</text></view
    >
    <view class="search" @tap="goCategory"
      ><text class="search__glass">⌕</text
      ><text class="search__hint">搜索商品：请输入商品名称</text
      ><text class="search__button">搜索</text></view
    >
    <swiper
      class="hero"
      autoplay
      circular
      :interval="4000"
      :duration="400"
      indicator-dots
      indicator-color="rgba(255, 255, 255, 0.45)"
      indicator-active-color="#ffffff"
      ><swiper-item v-for="banner in banners" :key="banner.id"
        ><view class="hero__slide" :class="`hero__slide--${banner.theme}`"
          ><text class="hero__tag">{{ banner.tag }}</text
          ><text class="hero__title">{{ banner.title }}</text
          ><text class="hero__sub">{{ banner.sub }}</text></view
        ></swiper-item
      ></swiper
    >
    <view class="delivery"
      ><view class="delivery__item delivery__item--green"
        ><view
          ><text class="delivery__title">立即配送</text
          ><text class="delivery__sub">最快 30 分钟送达</text></view
        ><text class="delivery__mark">›</text></view
      ><view class="delivery__item delivery__item--orange"
        ><view
          ><text class="delivery__title">⚡ 30-60 分钟到楼</text
          ><text class="delivery__sub"
            >本楼楼长 王同学 <text class="delivery__online">●</text> 在线</text
          ></view
        ><text class="delivery__mark">›</text></view
      ></view
    >
    <view class="categories card"
      ><view
        v-for="(item, index) in categories"
        :key="item.id"
        class="category"
        @tap="goCategory"
        ><view class="category__image"
          ><image
            :src="categoryImages[index % categoryImages.length]"
            mode="aspectFit" /></view
        ><text>{{ item.name === "全部" ? "零食饮料" : item.name }}</text></view
      ></view
    >
    <view class="section-title"
      ><text class="section-title__main">为你推荐</text
      ><text class="section-title__sub" @tap="goCategory">更多 ›</text></view
    >
    <view v-if="loading" class="grid"
      ><view v-for="n in 4" :key="n" class="skeleton" /></view
    ><view v-else class="grid"
      ><ProductCard
        v-for="p in products"
        :key="p.id"
        :product="p"
        :quantity="cart.quantity(p.id)"
        @add="add"
        @open="open"
    /></view>
  </view>
</template>

<style scoped lang="scss">
@import "../../styles/theme.scss";
.home {
  padding-top: calc(30rpx + env(safe-area-inset-top));
}
.brand-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.brand {
  font-size: 40rpx;
  font-weight: 900;
  color: $primary-dark;
  letter-spacing: 1rpx;
}
.brand-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: $primary;
}
.location {
  min-height: 82rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-weight: 700;
}
.pin {
  color: $primary;
  font-size: 30rpx;
}
.down {
  color: $primary-dark;
}
.search {
  height: 84rpx;
  background: #fff;
  border: 3rpx solid $primary;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  padding-left: 24rpx;
  overflow: hidden;
}
.search__glass {
  font-size: 40rpx;
  color: $muted;
}
.search__hint {
  flex: 1;
  color: #707973;
  margin-left: 12rpx;
  font-size: 25rpx;
}
.search__button {
  align-self: stretch;
  min-width: 126rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #41ce69, $primary);
  color: #fff;
  font-weight: 800;
  font-size: 28rpx;
}
.hero {
  aspect-ratio: 2.55/1;
  border-radius: 28rpx;
  overflow: hidden;
  margin-top: 24rpx;
  background: $primary-soft;
  box-shadow: 0 12rpx 32rpx rgba(21, 117, 54, 0.1);
}
.hero__slide {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 44rpx 40rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.hero__slide--green {
  background: linear-gradient(120deg, #07883b 0%, #25b95a 60%, #41ce69 100%);
}
.hero__slide--orange {
  background: linear-gradient(120deg, #e25c05 0%, #ff7a21 60%, #ffa24d 100%);
}
.hero__slide--dark {
  background: linear-gradient(120deg, #1e2520 0%, #2f4436 60%, #159447 100%);
}
.hero__tag {
  align-self: flex-start;
  font-size: 20rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(255, 255, 255, 0.55);
  border-radius: 999rpx;
  padding: 6rpx 20rpx;
}
.hero__title {
  margin-top: 20rpx;
  font-size: 44rpx;
  font-weight: 900;
  color: #fff;
  letter-spacing: 2rpx;
}
.hero__sub {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}
.delivery {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-top: 20rpx;
}
.delivery__item {
  min-height: 116rpx;
  border-radius: 24rpx;
  padding: 22rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 2rpx solid rgba(21, 148, 71, 0.06);
}
.delivery__item--green {
  background: linear-gradient(135deg, #edfae9, #f8fff5);
  color: $primary-dark;
}
.delivery__item--orange {
  background: linear-gradient(135deg, #fff4e8, #fffaf3);
  color: $orange;
}
.delivery__title,
.delivery__sub {
  display: block;
}
.delivery__title {
  font-size: 30rpx;
  font-weight: 900;
}
.delivery__sub {
  font-size: 21rpx;
  color: $muted;
  margin-top: 8rpx;
}
.delivery__mark {
  font-size: 48rpx;
  font-weight: 300;
}
.delivery__online {
  color: $primary;
  font-size: 18rpx;
}
.categories {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8rpx;
  margin-top: 22rpx;
  padding: 24rpx 10rpx;
}
.category {
  text-align: center;
  font-size: 20rpx;
  min-width: 0;
}
.category__image {
  width: 88rpx;
  height: 88rpx;
  margin: 0 auto 10rpx;
  border-radius: 50%;
  background: $primary-soft;
  overflow: hidden;
}
.category:nth-child(2n) .category__image {
  background: $cream;
}
.category__image image {
  width: 100%;
  height: 100%;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
}
.skeleton {
  height: 390rpx;
  border-radius: 26rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: pulse 1.2s infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
