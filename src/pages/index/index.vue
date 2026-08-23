<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import ProductCard from "../../components/ProductCard.vue";
import { useCartStore } from "../../stores/cart";
import { useSessionStore } from "../../stores/session";
import { categoryImage } from "../../utils/categoryImage";
import type { Address, Banner, Category, Product } from "../../types";

const cart = useCartStore(),
  campus = ref("湖北工业大学"),
  defaultAddress = ref<Address | null>(null),
  categories = ref<Category[]>([]),
  products = ref<Product[]>([]),
  /** 首页轮播（IK9RX2）：DB 数据为准，本地渐变仅为兜底占位（后台无 Banner 时极简展示） */
  banners = ref<Banner[]>([]),
  loading = ref(true);
/** 分类图标：共享 categoryImage（IK9VD3），商品页侧栏同款回退，两边恒一致 */
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
  banners.value = home.banners;
  products.value = home.hotProducts;
  await cart.load();
  loading.value = false;
});
/** Banner 主题：预置键映射渐变，自定义 hex 走内联底色。 */
const BANNER_THEMES: Record<string, string> = {
  green: "linear-gradient(120deg, #07883b 0%, #25b95a 60%, #41ce69 100%)",
  orange: "linear-gradient(120deg, #e25c05 0%, #ff7a21 60%, #ffa24d 100%)",
  dark: "linear-gradient(120deg, #1e2520 0%, #2f4436 60%, #159447 100%)",
};
function bannerStyle(banner: Banner) {
  const theme = BANNER_THEMES[banner.color];
  if (theme) return { background: theme };
  // 自定义 hex：纯色底，文字白字可读
  return { background: banner.color || "#07883b" };
}
/**
 * Banner 点击跳图文详情（IK9SNN）：后台配了 content 才可点，
 * 数据经 storage 传给图文页（/home 已拉全量，不建详情端点）。
 */
function openBanner(banner: Banner) {
  if (!banner.content?.trim()) return; // 无内容 Banner 不跳转
  uni.setStorageSync(
    "bannerContent",
    JSON.stringify({
      title: banner.title,
      subtitle: banner.subtitle,
      badge: banner.badge,
      image: banner.image,
      content: banner.content,
    }),
  );
  uni.navigateTo({ url: "/pages/content/detail" });
}
const add = (p: Product) => cart.set(p, cart.quantity(p.id) + 1);
/** 首页分类横滑条：与商品页侧栏同源同序，含「全部」（DB 配图）；
 *  横滑一行浏览全部分类（2026-08-22 需求），不再按 6 列折行，仅留防御上限 */
const rowCategories = computed(() => categories.value.slice(0, 24));
/** 计数器减件（IK9AWL）：ProductCard 数量>0 时展开 − n ＋ */
const remove = (p: Product) => cart.set(p, cart.quantity(p.id) - 1);
const open = (id: string) =>
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
const goCategory = () => uni.switchTab({ url: "/pages/category/index" });
/**
 * 金刚区点击带分类 id 跳商品页（IK9SOB）：switchTab 不支持 query，
 * 与搜索词同走 storage 传递；商品页 onShow 消费后选中对应分类。
 */
function pickCategory(item: Category) {
  uni.setStorageSync("categoryPick", item.id);
  goCategory();
}
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
      v-if="banners.length"
      class="hero"
      autoplay
      circular
      :interval="4000"
      :duration="400"
      indicator-dots
      indicator-color="rgba(255, 255, 255, 0.45)"
      indicator-active-color="#ffffff"
      ><swiper-item v-for="banner in banners" :key="banner.id"
        ><view
          class="hero__slide"
          :class="{ 'hero__slide--link': banner.content?.trim() }"
          :style="bannerStyle(banner)"
          @tap="openBanner(banner)"
          ><image
            v-if="banner.image"
            class="hero__bg"
            :src="banner.image"
            mode="aspectFill"
          /><view class="hero__mask" v-if="banner.image && banner.badge"></view
          ><text v-if="banner.badge" class="hero__tag">{{ banner.badge }}</text
          ><text v-if="banner.title" class="hero__title">{{ banner.title }}</text
          ><text v-if="banner.subtitle" class="hero__sub">{{
            banner.subtitle
          }}</text></view
        ></swiper-item
      ></swiper
    >
    <!-- 空 Banner 降级（IK9RX2）：后台未配置时给一个品牌占位帧，不让轮播区塌掉 -->
    <view v-else class="hero hero--empty"
      ><view class="hero__slide hero__slide--green"
        ><text class="hero__title">今天不出寝</text
        ><text class="hero__sub">想吃的照样有</text></view
      ></view
    >
    <view class="delivery"
      ><view class="delivery__item delivery__item--green"
        ><view
          ><text class="delivery__title">不出寝点单</text
          ><text class="delivery__sub">零食饮料 寝室直达</text></view
        ></view
      ><view class="delivery__item delivery__item--orange"
        ><view
          ><text class="delivery__title">最快30分钟送达</text
          ><text class="delivery__sub">楼长接力送到门口</text></view
        ></view
      ></view
    >
    <!-- 分类横滑条（2026-08-22）：单行展示，左右滑动看更多；右缘渐隐暗示可滑 -->
    <view class="categories card"
      ><scroll-view
        scroll-x
        class="categories__scroll"
        enhanced
        :show-scrollbar="false"
        ><view class="categories__row"
          ><view
            v-for="item in rowCategories"
            :key="item.id"
            class="category"
            @tap="pickCategory(item)"
            ><view class="category__image"
              ><image :src="categoryImage(item)" mode="aspectFit" /></view
            ><text class="category__name">{{ item.name }}</text></view
          ></view
        ></scroll-view
      ></view
    >
    <view class="section-title"
      ><text class="section-title__main">为你推荐</text
      ><text class="section-title__sub" @tap="goCategory"
        ><!-- IK9VQ3：chevron 形状即 >，改 chip 暗示可点 -->
        <text class="link-chip">更多</text></text
    ></view
    >
    <view v-if="loading" class="grid"
      ><view v-for="n in 4" :key="n" class="skeleton" /></view
    ><view v-else-if="!products.length" class="grid-empty"
      ><text class="muted">货架暂时空着，去「商品」页逛逛</text></view
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
  </view>

  <TabBar :current="0" />
  <CartOverlay />
</template>

<style scoped lang="scss">
@import "../../styles/theme.scss";
.home {
  padding-top: calc(30rpx + env(safe-area-inset-top));
  /* 底部补偿（2026-08-23）：推荐网格末行不压在自绘 TabBar 下 */
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
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
/* 可点击 Banner（IK9SNN）：轻按压反馈 */
.hero__slide--link:active {
  opacity: 0.92;
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
/* 空 Banner 占位（IK9RX2）：与轮播同高圆角，承载单帧品牌文案 */
.hero--empty {
  aspect-ratio: 2.55/1;
  border-radius: 28rpx;
  overflow: hidden;
  margin-top: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(21, 117, 54, 0.1);
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
/* 分类横滑条（2026-08-22）：单行 scroll-x，项不压缩；右缘白色渐隐提示可滑 */
/* IKAHBA 方案A：整条放大一档（图标 88→112 / 文字 20→24 加粗 / 项宽 112→136 /
   间距 24→28），触控目标≥44px、间距≥8px；横滑与渐隐逻辑不动 */
.categories {
  position: relative;
  margin-top: 22rpx;
  padding: 28rpx 0;
  overflow: hidden;
}
.categories__scroll {
  width: 100%;
  white-space: nowrap;
}
/* H5 端隐藏滚动条（微信端靠 enhanced show-scrollbar） */
.categories__scroll ::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.categories__row {
  display: inline-flex;
  gap: 28rpx;
  padding: 0 28rpx;
}
.category {
  flex-shrink: 0;
  width: 136rpx;
  text-align: center;
  font-size: 24rpx;
  color: $ink;
  font-weight: 700;
}
.category__name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.categories::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 48rpx;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), #fff);
  pointer-events: none;
}
.category__image {
  width: 112rpx;
  height: 112rpx;
  margin: 0 auto 12rpx;
  border-radius: 50%;
  background: $primary-soft;
  overflow: hidden;
  transition: transform 0.12s ease;
}
/* IKAHBA：按压反馈，图标缩到 0.92 不移位 */
.category:active .category__image {
  transform: scale(0.92);
}
.category:nth-child(2n) .category__image {
  background: $cream;
}
.category__image image {
  width: 100%;
  height: 100%;
}
.grid-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 390rpx;
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
