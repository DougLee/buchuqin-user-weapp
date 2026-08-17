<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useCartStore } from "../../stores/cart";
import { fenToYuan } from "../../utils/money";
import type { Category, Product } from "../../types";
const ALL = { id: "all", name: "全部" };
const active = ref("all"),
  keyword = ref(""),
  categories = ref<Category[]>([]),
  products = ref<Product[]>([]),
  cart = useCartStore();
async function load() {
  products.value = await api.products(active.value, keyword.value);
}
onShow(async () => {
  await cart.load();
  try {
    categories.value = await api.categories();
  } catch {
    categories.value = (await api.home()).categories;
  }
  await load();
});
async function pick(id: string) {
  active.value = id;
  await load();
}
const open = (id: string) =>
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
const currentName = () =>
  [ALL, ...categories.value].find((c) => c.id === active.value)?.name ||
  "全部商品";
</script>
<template>
  <view class="page"
    ><view class="search card"
      ><input
        v-model="keyword"
        placeholder="今天想吃什么？"
        confirm-type="search"
        @confirm="load"
      /><button @tap="load">搜索</button></view
    ><view class="body"
      ><scroll-view scroll-y class="side"
        ><view
          v-for="c in [ALL, ...categories]"
          :key="c.id"
          class="side__item"
          :class="{ 'side__item--active': active === c.id }"
          @tap="pick(c.id)"
          >{{ c.name }}</view
        ></scroll-view
      ><scroll-view scroll-y class="main"
        ><view class="main__title">{{ currentName() }}</view
        ><view v-if="!products.length" class="main__empty muted"
          >这个分类暂时没货，去看看别的吧</view
        ><view
          v-for="p in products"
          :key="p.id"
          class="item card"
          @tap="open(p.id)"
          ><image
            class="item__image"
            :src="p.image"
            mode="aspectFit"
            :alt="p.name"
          /><view class="item__main"
            ><text class="item__name">{{ p.name }}</text
            ><text class="item__sub">{{ p.subtitle }}</text
            ><view class="item__bottom"
              ><text class="price"
                ><text class="price__symbol">¥</text
                >{{ fenToYuan(p.price) }}</text
              ><button
                class="add"
                aria-label="加入购物车"
                @tap.stop="cart.set(p, cart.quantity(p.id) + 1)"
              >
                {{ cart.quantity(p.id) ? cart.quantity(p.id) : "＋" }}
              </button></view
            ></view
          ></view
        ></scroll-view
      ></view
  ></view>
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding-bottom: 0;
}
.search {
  height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 8rpx 0 26rpx;
  border: 3rpx solid $primary;
  flex-shrink: 0;
}
.search input {
  flex: 1;
  font-size: 28rpx;
}
.search button {
  min-height: 68rpx;
  margin: 0;
  background: $primary;
  color: #fff;
  border-radius: 34rpx;
  font-size: 24rpx;
  padding: 0 30rpx;
}
.body {
  flex: 1;
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
  min-height: 0;
}
.side {
  width: 196rpx;
  flex-shrink: 0;
  height: 100%;
  background: $surface;
  border-radius: 28rpx;
  border: 2rpx solid rgba(32, 74, 45, 0.07);
}
.side__item {
  min-height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx 16rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: $ink;
  text-align: center;
  border-left: 8rpx solid transparent;
}
.side__item--active {
  background: $primary-soft;
  color: $primary-dark;
  border-left-color: $primary;
}
.main {
  flex: 1;
  height: 100%;
  min-width: 0;
}
.main__title {
  font-size: 34rpx;
  font-weight: 900;
  margin: 6rpx 4rpx 20rpx;
}
.main__empty {
  text-align: center;
  padding: 80rpx 0;
  font-size: 26rpx;
}
.item {
  display: flex;
  padding: 18rpx;
  margin-bottom: 18rpx;
  border-radius: 24rpx;
}
.item__image {
  width: 150rpx;
  height: 150rpx;
  border-radius: 20rpx;
  background: $primary-soft;
  flex-shrink: 0;
}
.item__main {
  flex: 1;
  margin-left: 18rpx;
  min-width: 0;
}
.item__name {
  display: block;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.4;
}
.item__sub {
  display: block;
  color: $muted;
  font-size: 20rpx;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}
.add {
  margin: 0;
  width: 58rpx;
  height: 58rpx;
  line-height: 54rpx;
  padding: 0;
  border-radius: 50%;
  background: $primary;
  color: #fff;
  font-weight: 900;
  font-size: 32rpx;
  box-shadow: none;
}
</style>
