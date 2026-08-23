<script setup lang="ts">
import type { Product } from "../types";
import { fenToYuan } from "../utils/money";
import { PROMO_TAG } from "../utils/promotion";
defineProps<{ product: Product; quantity?: number }>();
const emit = defineEmits<{
  add: [Product];
  remove: [Product];
  open: [string];
}>();
</script>
<template>
  <view class="product card" @tap="emit('open', product.id)"
    ><view class="product__visual"
      ><image
        class="product__image"
        :src="product.image"
        mode="aspectFit"
        :alt="product.name"
      /><text
        class="product__tag"
        :class="{ 'product__tag--promo': product.promotion }"
        >{{
          product.promotion ? PROMO_TAG[product.promotion.type] : product.tag
        }}</text
      ></view
    ><view class="product__body"
      ><text class="product__name">{{ product.name }}</text
      ><text class="product__sub">{{ product.subtitle }}</text
      ><view class="product__bottom"
        ><view class="product__price"
          ><text class="price"
            ><text class="price__symbol">¥</text>{{ fenToYuan(product.price) }}</text
          ><!-- 促销划线（ADR-0006）：活动期 originalPrice 即商品原价 --><text
            v-if="product.promotion"
            class="product__strike"
            >¥{{ fenToYuan(product.originalPrice) }}</text
          ></view
        ><!-- 加减计数器（IK9AWL）：数量>0 时展开 − n ＋，数字不再是隐形加号 -->
        <view v-if="quantity" class="counter" @tap.stop
          ><button
            class="counter__btn counter__btn--minus"
            aria-label="减少一件"
            @tap.stop="emit('remove', product)"
          >
            −
          </button
          ><text class="counter__num">{{ quantity }}</text
          ><button
            class="counter__btn"
            aria-label="增加一件"
            @tap.stop="emit('add', product)"
          >
            ＋
          </button></view
        ><button
          v-else
          class="add"
          aria-label="加入购物车"
          @tap.stop="emit('add', product)"
        >
          ＋
        </button></view
      ></view
    ></view
  >
</template>
<style scoped lang="scss">
@import "../styles/theme.scss";
.product {
  overflow: hidden;
  border-radius: 24rpx;
}
.product__visual {
  height: 238rpx;
  background: #fff;
  position: relative;
  padding: 12rpx;
}
.product__image {
  width: 100%;
  height: 100%;
}
.product__tag {
  position: absolute;
  left: 14rpx;
  top: 14rpx;
  background: $primary-soft;
  color: $primary-dark;
  border-radius: 18rpx;
  padding: 5rpx 13rpx;
  font-size: 20rpx;
  font-weight: 700;
}
/* 促销角标（ADR-0006）：橙底白字压过常规 tag */
.product__tag--promo {
  background: $orange;
  color: #fff;
}
.product__price {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  min-width: 0;
}
.product__strike {
  text-decoration: line-through;
  color: $muted;
  font-size: 20rpx;
}
.product__body {
  padding: 18rpx;
}
.product__name {
  display: block;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.4;
}
.product__sub {
  display: block;
  color: $muted;
  font-size: 22rpx;
  margin-top: 5rpx;
}
.product__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
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
</style>
