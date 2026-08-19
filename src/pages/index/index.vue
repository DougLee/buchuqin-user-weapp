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
/** 分类图标按 id 稳定映射（IK9AWT）：同一分类恒定同图，列表变动或超 6 个不漂移 */
function categoryImage(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return categoryImages[h % categoryImages.length];
}
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
/** 首页 Banner 帧：品牌帧只有图，其余帧叠 tag/title/sub 文案。 */
interface Banner {
  id: string;
  theme: string;
  image?: string;
  tag: string;
  title?: string;
  sub?: string;
}
const banners: readonly Banner[] = [
  {
    // 品牌帧：原首页 hero 大图（c87ff6f 引入、892f382 移除引用）复活为首帧 Banner。
    // 图自带文案（不出寝食社·校园零食日用送到寝室），故不叠文字。
    id: "brand",
    theme: "green",
    image: "/static/home-hero-v3.jpg",
    tag: "",
  },
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
    sub: "每单提成 + 月度底薪，虚位以待",
  },
] as const;
const add = (p: Product) => cart.set(p, cart.quantity(p.id) + 1);
/** 计数器减件（IK9AWL）：ProductCard 数量>0 时展开 − n ＋ */
const remove = (p: Product) => cart.set(p, cart.quantity(p.id) - 1);
const open = (id: string) =>
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
const goCategory = () => uni.switchTab({ url: "/pages/category/index" });
/** 首页真搜索（IK9AWP）：确认后带关键词去分类页（switchTab 不支持参数，走 storage 传递） */
const keyword = ref("");
function search() {
  uni.setStorageSync("searchKeyword", keyword.value.trim());
  goCategory();
}
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
    <view class="search"
      ><text class="search__glass">⌕</text
      ><input
        v-model="keyword"
        class="search__input"
        placeholder="今天想吃什么？"
        placeholder-class="search__placeholder"
        confirm-type="search"
        @confirm="search"
      /><text class="search__button" @tap="search">搜索</text></view
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
          ><image
            v-if="'image' in banner"
            class="hero__bg"
            :src="banner.image"
            mode="aspectFill"
          /><view class="hero__mask" v-if="'image' in banner && banner.tag"></view
          ><text v-if="banner.tag" class="hero__tag">{{ banner.tag }}</text
          ><text v-if="banner.title" class="hero__title">{{ banner.title }}</text
          ><text v-if="banner.sub" class="hero__sub">{{ banner.sub }}</text></view
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
            >本楼楼长 <text class="delivery__online">●</text> 在线接单</text
          ></view
        ><text class="delivery__mark">›</text></view
      ></view
    >
    <view class="categories card"
      ><view
        v-for="item in categories"
        :key="item.id"
        class="category"
        @tap="goCategory"
        ><view class="category__image"
          ><image :src="categoryImage(item.id)" mode="aspectFit" /></view
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
        @remove="remove"
        @open="open"
    /></view>
  ></view
  >
  <CartOverlay />
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
.search__input {
  flex: 1;
  color: $ink;
  margin-left: 12rpx;
  font-size: 25rpx;
  height: 100%;
}
.search__placeholder {
  color: #707973;
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
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 44rpx 40rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}
/* 真图 Banner：背景图铺满 + 底部深色渐变遮罩，文字置顶保证可读 */
.hero__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.hero__mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(7, 40, 20, 0.05) 0%,
    rgba(7, 40, 20, 0.35) 55%,
    rgba(7, 40, 20, 0.72) 100%
  );
}
.hero__slide > text {
  position: relative;
  z-index: 1;
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
