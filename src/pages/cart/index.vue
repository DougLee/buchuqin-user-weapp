<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { useCartStore } from "../../stores/cart";
const cart = useCartStore();
onShow(() => cart.load());
const checkout = () => {
  if (cart.cart.items.length) uni.navigateTo({ url: "/pages/checkout/index" });
};
</script>
<template>
  <view class="page"
    ><view v-if="!cart.cart.items.length" class="empty"
      ><view class="empty__bag">袋</view
      ><text class="empty__title">购物袋还空着</text
      ><text class="muted">去挑点今晚想吃的吧</text
      ><button
        class="primary-btn"
        @tap="uni.switchTab({ url: '/pages/index/index' })"
      >
        去逛逛
      </button></view
    ><template v-else
      ><view class="cart-head"
        ><text>寝室购物袋</text
        ><text class="muted">{{ cart.cart.totalQuantity }} 件</text></view
      ><view class="cart-list card"
        ><view
          v-for="line in cart.cart.items"
          :key="line.product.id"
          class="line"
          ><image
            :src="line.product.image"
            mode="aspectFit"
            :alt="line.product.name"
          /><view class="line__main"
            ><text class="line__name">{{ line.product.name }}</text
            ><text class="line__sub">{{ line.product.subtitle }}</text
            ><view class="line__bottom"
              ><text class="price">¥{{ line.product.price }}</text
              ><view class="counter"
                ><button @tap="cart.set(line.product, line.quantity - 1)">
                  −</button
                ><text>{{ line.quantity }}</text
                ><button @tap="cart.set(line.product, line.quantity + 1)">
                  ＋
                </button></view
              ></view
            ></view
          ></view
        ></view
      ><view class="delivery-tip">再也不用穿鞋下楼，楼长送到 612 寝室</view
      ><view class="settlement safe-bottom"
        ><view
          ><text class="muted">合计</text
          ><text class="total">¥{{ cart.cart.productAmount }}</text></view
        ><button class="primary-btn" @tap="checkout">去结算</button></view
      ></template
    ></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.cart-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 38rpx;
  font-weight: 900;
  margin-bottom: 24rpx;
}
.cart-list {
  padding: 4rpx 24rpx;
}
.line {
  display: flex;
  padding: 24rpx 0;
  border-bottom: 2rpx solid $line;
}
.line:last-child {
  border: none;
}
.line image {
  width: 170rpx;
  height: 170rpx;
  border-radius: 24rpx;
  background: $primary-soft;
}
.line__main {
  flex: 1;
  margin-left: 20rpx;
}
.line__name {
  display: block;
  font-weight: 800;
}
.line__sub {
  display: block;
  color: #667069;
  font-size: 23rpx;
  margin-top: 8rpx;
}
.line__bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 30rpx;
}
.counter {
  display: flex;
  align-items: center;
  gap: 18rpx;
}
.counter button {
  width: 64rpx;
  height: 64rpx;
  line-height: 60rpx;
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: $primary-soft;
  color: $primary-dark;
  font-weight: 900;
}
.delivery-tip {
  margin: 24rpx 0;
  background: $primary-soft;
  color: $primary-dark;
  border-radius: 24rpx;
  padding: 22rpx;
  font-size: 24rpx;
  border-left: 8rpx solid $primary;
}
.settlement {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(100rpx + env(safe-area-inset-bottom));
  min-height: 126rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 28rpx;
  box-shadow: 0 -10rpx 30rpx rgba(21, 75, 38, 0.09);
  z-index: 20;
}
.settlement .primary-btn {
  width: 260rpx;
  margin: 0;
}
.total {
  font-size: 40rpx;
  font-weight: 900;
  color: $primary-dark;
  margin-left: 12rpx;
}
.empty {
  text-align: center;
  padding-top: 150rpx;
}
.empty__bag {
  width: 180rpx;
  height: 180rpx;
  margin: auto;
  background: $primary-soft;
  border: 5rpx solid $primary;
  border-radius: 50%;
  color: $primary-dark;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 68rpx;
  font-weight: 900;
  box-shadow: 0 16rpx 32rpx rgba(37, 185, 90, 0.16);
}
.empty__title {
  display: block;
  font-size: 38rpx;
  font-weight: 900;
  margin: 48rpx 0 10rpx;
}
.empty .primary-btn {
  margin-top: 50rpx;
}
</style>
