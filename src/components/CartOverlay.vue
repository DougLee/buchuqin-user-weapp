<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { onHide, onUnload } from "@dcloudio/uni-app";
import { useCartStore } from "../stores/cart";
import { fenToYuan } from "../utils/money";
/**
 * 全局购物车悬浮窗（IK97FD）
 * 跨工位契约：任意页面 uni.$emit('open-cart') 唤起本悬浮窗。
 * 页面只需放 <CartOverlay />（main.ts 已全局注册，easycom 亦可自动解析），
 * 组件内部自行监听/卸载 open-cart 事件，无需父页面传参。
 */
const visible = ref(false);
const cart = useCartStore();
const EVENT = "open-cart";
function open() {
  visible.value = true;
  void cart.load();
}
function close() {
  visible.value = false;
}
function checkout() {
  if (!cart.cart.items.length) return;
  // 低于起送门槛就地拦截（IK9YPJ）：进结算页也只会被后端 400，
  // 与结算页 belowThreshold 同口径，直接提示差额
  if (
    cart.cart.productAmount > 0 &&
    cart.cart.productAmount < (cart.cart.deliveryThreshold ?? 1000)
  ) {
    uni.showToast({
      title: `还差 ¥${fenToYuan(
        (cart.cart.deliveryThreshold ?? 1000) - cart.cart.productAmount,
      )} 起送`,
      icon: "none",
    });
    return;
  }
  close();
  uni.navigateTo({ url: "/pages/checkout/index" });
}
onMounted(() => uni.$on(EVENT, open));
onUnmounted(() => uni.$off(EVENT, open));
// IK9SO2：返回手势/切 Tab/跳页面即关闭弹层——弹层跟着页面走，不留残影
onHide(close);
onUnload(close);
</script>
<template>
  <view v-if="visible" class="cart-overlay"
    ><view class="cart-overlay__mask" @tap="close"></view
    ><view class="cart-overlay__panel safe-bottom"
      ><view class="cart-overlay__head"
        ><text class="cart-overlay__title">购物车</text
        ><text class="muted"
          >{{ cart.cart.totalQuantity }} 件</text
        ><button class="cart-overlay__close" aria-label="关闭" @tap="close">
          ×</button
        ></view
      ><view v-if="!cart.cart.items.length" class="cart-overlay__empty"
        ><text class="cart-overlay__empty-title">购物车还空着</text
        ><text class="muted">去挑点今晚想吃的吧</text></view
      ><scroll-view v-else scroll-y class="cart-overlay__list"
        ><view
          v-for="line in cart.cart.items"
          :key="line.product.id"
          class="line"
          ><image
            class="line__image"
            :src="line.product.image"
            mode="aspectFit"
            :alt="line.product.name"
          /><view class="line__main"
            ><text class="line__name">{{ line.product.name }}</text
            ><text class="line__sub">{{ line.product.subtitle }}</text
            ><view class="line__bottom"
              ><text class="price"
                ><text class="price__symbol">¥</text
                >{{ fenToYuan(line.product.price) }}</text
              ><!-- 数量读写走 cart.quantity()（IK9AWM）：连点时读到 pending 新值，不用服务端旧值 -->
              <view class="counter"
                ><button
                  aria-label="减少一件"
                  @tap="cart.set(line.product, cart.quantity(line.product.id) - 1)"
                >
                  −</button
                ><text>{{ cart.quantity(line.product.id) }}</text
                ><button
                  aria-label="增加一件"
                  @tap="cart.set(line.product, cart.quantity(line.product.id) + 1)"
                >
                  ＋
                </button></view
              ></view
            ></view
          ></view
        ></scroll-view
      ><view class="cart-overlay__footer"
        ><view
          ><text class="muted">合计</text
          ><text class="cart-overlay__total"
            >¥{{ fenToYuan(cart.cart.productAmount) }}</text
          ></view
        ><button
          class="primary-btn cart-overlay__checkout"
          :disabled="!cart.cart.items.length"
          @tap="checkout"
          >去结算</button
        ></view
      ></view
  ></view>
</template>
<style scoped lang="scss">
@import "../styles/theme.scss";
.cart-overlay__mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 30, 20, 0.5);
  z-index: 998;
}
.cart-overlay__panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  height: 68vh;
  background: $paper;
  border-radius: 32rpx 32rpx 0 0;
  box-shadow: 0 -12rpx 40rpx rgba(21, 75, 38, 0.18);
  display: flex;
  flex-direction: column;
  animation: cart-overlay-up 0.24s ease;
}
@keyframes cart-overlay-up {
  from {
    transform: translateY(60rpx);
    opacity: 0.4;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
.cart-overlay__head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 28rpx 28rpx 16rpx;
}
.cart-overlay__title {
  font-size: 36rpx;
  font-weight: 900;
}
.cart-overlay__close {
  margin: 0 0 0 auto;
  width: 56rpx;
  height: 56rpx;
  line-height: 52rpx;
  padding: 0;
  border-radius: 50%;
  background: $line;
  color: $muted;
  font-size: 36rpx;
}
.cart-overlay__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}
.cart-overlay__empty-title {
  font-size: 34rpx;
  font-weight: 900;
}
.cart-overlay__list {
  flex: 1;
  min-height: 0;
  padding: 0 28rpx;
}
.line {
  display: flex;
  padding: 22rpx 0;
  border-bottom: 2rpx solid $line;
}
.line:last-child {
  border: none;
}
.line__image {
  width: 140rpx;
  height: 140rpx;
  border-radius: 20rpx;
  background: $primary-soft;
  flex-shrink: 0;
}
.line__main {
  flex: 1;
  margin-left: 18rpx;
  min-width: 0;
}
.line__name {
  display: block;
  font-weight: 800;
  font-size: 27rpx;
}
.line__sub {
  display: block;
  color: #667069;
  font-size: 22rpx;
  margin-top: 6rpx;
}
.line__bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18rpx;
}
.counter {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
/* 触控热区（IK9AWL）：64rpx 视觉 + 透明外圈 ::after ≈ 88rpx 命中 */
.counter button {
  position: relative;
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
.counter button::after {
  content: "";
  position: absolute;
  left: -12rpx;
  top: -12rpx;
  right: -12rpx;
  bottom: -12rpx;
}
.counter text {
  min-width: 44rpx;
  text-align: center;
  font-weight: 900;
}
.cart-overlay__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 28rpx;
  background: $surface;
  box-shadow: 0 -8rpx 24rpx rgba(21, 75, 38, 0.08);
}
.cart-overlay__total {
  font-size: 40rpx;
  font-weight: 900;
  color: $primary-dark;
  margin-left: 12rpx;
}
.cart-overlay__checkout {
  width: 260rpx;
  margin: 0;
}
@media (min-width: 560px) {
  /* 与全局宽屏居中方案一致：悬浮窗同样限制在手机宽度内（用负 margin 居中，避免与弹起动画的 transform 冲突） */
  .cart-overlay__panel,
  .cart-overlay__mask {
    left: 50%;
    right: auto;
    width: 480px;
    max-width: 100%;
    margin-left: -240px;
  }
}
</style>
