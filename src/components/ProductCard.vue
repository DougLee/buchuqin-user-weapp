<script setup lang="ts">
import type { Product } from "../types";
import { fenToYuan } from "../utils/money";
defineProps<{ product: Product; quantity?: number }>();
const emit = defineEmits<{ add: [Product]; open: [string] }>();
</script>
<template>
  <view class="product card" @tap="emit('open', product.id)"
    ><view class="product__visual"
      ><image
        class="product__image"
        :src="product.image"
        mode="aspectFit"
        :alt="product.name"
      /><text class="product__tag">{{ product.tag }}</text></view
    ><view class="product__body"
      ><text class="product__name">{{ product.name }}</text
      ><text class="product__sub">{{ product.subtitle }}</text
      ><view class="product__bottom"
        ><text class="price"
          ><text class="price__symbol">¥</text>{{ fenToYuan(product.price) }}</text
        ><button
          class="add"
          aria-label="加入购物车"
          @tap.stop="emit('add', product)"
        >
          {{ quantity ? quantity : "＋" }}
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
  font-size: 19rpx;
  font-weight: 700;
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
  font-size: 20rpx;
  margin-top: 5rpx;
}
.product__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
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
