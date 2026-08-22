<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { isRetryable } from "../../api/request";
import { useCartStore } from "../../stores/cart";
import { fenToYuan } from "../../utils/money";
import type { Category, Product } from "../../types";
/**
 * 侧栏直接用 DB 分类字典（IK9VDJ）；active 初始 'all'，api.products('all') 后端已兼容。
 * 「全部」是 UI 概念（2026-08-21 数据清理）：原 id=all 的 DB 行随测试分类删除，
 * 接口列表无 all 时本地补齐，保证侧栏始终有「全部」入口可切回。
 */
const active = ref("all"),
  keyword = ref(""),
  categories = ref<Category[]>([]),
  products = ref<Product[]>([]),
  loading = ref(true),
  error = ref(false),
  cart = useCartStore();
/** 商品列表三态（IK9AWK）：加载骨架 / 失败重试 / 列表 */
async function load() {
  loading.value = true;
  error.value = false;
  try {
    products.value = await api.products(active.value, keyword.value);
  } catch (e) {
    // ADR-0005(IKA00Q)：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
    if (isRetryable(e)) error.value = true;
  } finally {
    loading.value = false;
  }
}
onShow(async () => {
  // 首页搜索关键词传递（IK9AWP）：switchTab 不支持 query，走 storage 携带
  const kw = (uni.getStorageSync("searchKeyword") as string) || "";
  if (kw !== keyword.value) {
    keyword.value = kw;
    active.value = "all";
  }
  uni.removeStorageSync("searchKeyword");
  // 首页金刚区带分类 id 跳转（IK9SOB）：storage 传递，选中对应分类
  const pick = (uni.getStorageSync("categoryPick") as string) || "";
  uni.removeStorageSync("categoryPick");
  await cart.load();
  try {
    categories.value = await api.categories();
  } catch {
    // 分类接口失败先退 home 接口；再失败合成裸「全部」保底 tab，商品区由 load 三态兜底
    try {
      categories.value = (await api.home()).categories;
    } catch {
      categories.value = [{ id: "all", name: "全部" }];
    }
  }
  // IK9VD3：pick 校验存在性——类别被删/接口降级时回退「全部」，避免侧栏无高亮、标题与列表错位
  if (!categories.value.some((c) => c.id === "all"))
    categories.value = [{ id: "all", name: "全部" }, ...categories.value];
  if (pick)
    active.value = categories.value.some((c) => c.id === pick) ? pick : "all";
  await load();
});
async function pick(id: string) {
  active.value = id;
  await load();
}
const open = (id: string) =>
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
const currentName = () =>
  categories.value.find((c) => c.id === active.value)?.name || "全部商品";
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
          v-for="c in categories"
          :key="c.id"
          class="side__item"
          :class="{ 'side__item--active': active === c.id }"
          @tap="pick(c.id)"
          ><!-- 纯文字侧栏（2026-08-22）：图标挤压文字导致 5 字分类换行、行高不齐；
          图标识别职责交给首页横滑条，侧栏回归单行导航（美团式分类页形态） -->
          <text class="side__name">{{ c.name }}</text></view
        ></scroll-view
      ><scroll-view scroll-y class="main"
        ><view class="main__title">{{ currentName() }}</view
        ><view v-if="error" class="cat-retry card" @tap="load"
          ><text class="cat-retry__title">商品加载失败</text
          ><text class="muted">网络异常，点击重试</text></view
        ><view v-else-if="loading" class="cat-skeleton"
          ><view v-for="n in 4" :key="n" class="cat-skeleton__block" /></view
        ><template v-else
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
                ><!-- 计数器（IK9AWL）：数量>0 时展开 − n ＋，数字不再是隐形加号 -->
                <view v-if="cart.quantity(p.id)" class="counter" @tap.stop
                  ><button
                    class="counter__btn counter__btn--minus"
                    aria-label="减少一件"
                    @tap.stop="cart.set(p, cart.quantity(p.id) - 1)"
                  >
                    −
                  </button
                  ><text class="counter__num">{{ cart.quantity(p.id) }}</text
                  ><button
                    class="counter__btn"
                    aria-label="增加一件"
                    @tap.stop="cart.set(p, cart.quantity(p.id) + 1)"
                  >
                    ＋
                  </button></view
                ><button
                  v-else
                  class="add"
                  aria-label="加入购物车"
                  @tap.stop="cart.set(p, cart.quantity(p.id) + 1)"
                >
                  ＋
                </button></view
              ></view
            ></view
          ></template
        ></scroll-view
      ></view
    ><TabBar :current="1" /><CartFab /><CartOverlay /></view
  >
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
  /* 触控目标 88rpx=44px 达标；纯文字单行（2026-08-22） */
  min-height: 88rpx;
  display: flex;
  align-items: center;
  padding: 12rpx 16rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: $ink;
  border-left: 8rpx solid transparent;
}
.side__name {
  /* 单行省略：根治 5 字以上分类换行导致的行高不齐 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  font-size: 22rpx;
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
/* 触控热区（IK9AWL）：64rpx 视觉 + 透明外圈 ::after ≈ 88rpx 命中 */
.add,
.counter__btn {
  margin: 0;
  width: 64rpx;
  height: 64rpx;
  line-height: 60rpx;
  padding: 0;
  border-radius: 50%;
  background: $primary;
  color: #fff;
  font-weight: 900;
  font-size: 34rpx;
  box-shadow: none;
  position: relative;
}
.add::after,
.counter__btn::after {
  content: "";
  position: absolute;
  left: -12rpx;
  top: -12rpx;
  right: -12rpx;
  bottom: -12rpx;
}
.counter {
  display: flex;
  align-items: center;
  gap: 6rpx;
}
.counter__btn--minus {
  background: $primary-soft;
  color: $primary-dark;
}
.counter__num {
  min-width: 40rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 900;
}
.cat-retry {
  padding: 110rpx 30rpx;
  text-align: center;
}
.cat-retry__title {
  display: block;
  font-weight: 900;
  color: $primary-dark;
  margin-bottom: 8rpx;
}
.cat-skeleton__block {
  height: 190rpx;
  border-radius: 24rpx;
  margin-bottom: 18rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: cat-pulse 1.2s infinite;
}
@keyframes cat-pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
