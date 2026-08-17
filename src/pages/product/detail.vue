<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useCartStore } from "../../stores/cart";
import { fenToYuan } from "../../utils/money";
import type { Product } from "../../types";
const product = ref<Product>(),
  cart = useCartStore();
onLoad(async (q) => {
  await cart.load();
  product.value = await api.product(String(q?.id || "p001"));
});
const add = async () => {
  if (product.value) {
    await cart.set(product.value, cart.quantity(product.value.id) + 1);
    uni.showToast({ title: "已放进购物袋", icon: "success" });
  }
};
// 跨工位契约：购物车悬浮窗由工位 B 全局挂载，emit open-cart 唤起，不 import 组件
const openCart = () => uni.$emit("open-cart");
// H5 端客服占位（小程序端走 button open-type="contact"）
const onService = () =>
  uni.showToast({ title: "客服功能即将上线", icon: "none" });
</script>
<template>
  <view v-if="product" class="detail"
    ><view class="visual"
      ><image :src="product.image" mode="aspectFit" :alt="product.name" /><text
        class="visual__tag"
        >{{ product.tag }}</text
      ><!-- #ifdef MP-WEIXIN --><button
        class="service"
        open-type="contact"
        >客服</button
      ><!-- #endif --><!-- #ifndef MP-WEIXIN --><button
        class="service"
        @tap="onService"
        >客服</button
      ><!-- #endif --></view
    ><view class="content"
      ><view class="card info"
        ><text class="info__name">{{ product.name }}</text
        ><text class="info__sub">{{ product.subtitle }}</text
        ><view class="info__price"
          ><text class="price"
            ><text class="price__symbol">¥</text>{{ fenToYuan(product.price) }}</text
          ><text class="original">¥{{ fenToYuan(product.originalPrice) }}</text></view
        ></view
      ><view class="card guarantee"
        ><view
          ><text class="guarantee__title">校园仓现货</text
          ><text class="muted">仓里常备，随点随有</text></view
        ><view
          ><text class="guarantee__title">最快 30 分钟</text
          ><text class="muted">楼长送到寝室</text></view
        ></view
      ><view class="showcase card"
        ><view class="showcase__figure"
          ><text class="showcase__badge">商品演示</text
          ><text class="showcase__figure-title">{{ product.name }}</text></view
        ><text class="showcase__title">开袋这一刻，快乐值拉满</text
        ><text class="muted showcase__desc"
          >{{ product.subtitle }}。从校园仓到你的寝室门口全程保温保脆，熬夜复习、追剧加餐、寝室分享都合适；分量刚好一人解馋、两人分也不打架。</text
        ></view
      ><view class="story"
        ><text class="story__eyebrow">今晚的快乐很简单</text
        ><text class="story__title">不用换鞋，不用下楼。</text
        ><text class="muted"
          >下单后从湖工大校园仓出发，经配送员送到楼下，再由楼长送到你的寝室门口。</text
        ></view
      ></view
    ><view class="bottom safe-bottom"
      ><button class="bag" @tap="openCart">
        购物袋 {{ cart.cart.totalQuantity || "" }}</button
      ><button class="primary-btn" @tap="add">加入购物袋</button></view
    ></view
  >
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
.visual image {
  width: 100%;
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
.service {
  position: absolute;
  left: 24rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.94);
  color: $primary-dark;
  font-size: 24rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  box-shadow: 0 8rpx 22rpx rgba(21, 75, 38, 0.16);
}
.service::after {
  border: none;
}
.guarantee {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 22rpx;
  padding: 26rpx;
  background: linear-gradient(135deg, #f3fff5, #fff);
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
.showcase {
  margin-top: 22rpx;
  padding: 26rpx;
}
.showcase__figure {
  height: 320rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, $primary-soft 0%, #c8efd2 55%, $primary 130%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  position: relative;
  overflow: hidden;
}
.showcase__badge {
  background: rgba(255, 255, 255, 0.9);
  color: $primary-dark;
  font-size: 22rpx;
  font-weight: 800;
  padding: 8rpx 20rpx;
  border-radius: 24rpx;
}
.showcase__figure-title {
  font-size: 34rpx;
  font-weight: 900;
  color: $primary-dark;
  padding: 0 40rpx;
  text-align: center;
}
.showcase__title {
  display: block;
  font-size: 32rpx;
  font-weight: 900;
  margin: 24rpx 0 10rpx;
}
.showcase__desc {
  display: block;
  line-height: 1.7;
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
</style>
