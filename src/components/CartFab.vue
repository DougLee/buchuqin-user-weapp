<script setup lang="ts">
import { computed } from "vue";
import { useCartStore } from "../stores/cart";
/**
 * 悬浮购物车球（IKAFP6）：首页/商品页加购后的全局购物车入口。
 * 跨工位契约同 CartOverlay——点按 uni.$emit('open-cart') 唤起弹层，
 * 本组件只负责「有货才出现」的入口与件数角标，不含面板逻辑。
 * 商品详情页已有底部 bag 入口，不挂本组件。
 */
const cart = useCartStore();
/** 出现规则（IKAFP6 定稿）：totalQuantity>0 出现，空车隐藏 */
const count = computed(() => cart.cart.totalQuantity);
</script>
<template>
  <view
    v-if="count > 0"
    class="cart-fab"
    role="button"
    aria-label="查看购物车"
    @tap="uni.$emit('open-cart')"
  >
    <!-- 纯 CSS 购物袋图标：袋身+提手，不用 emoji/图片资源 -->
    <view class="cart-fab__icon"><view class="cart-fab__handle" /></view>
    <view class="cart-fab__badge">{{ count > 99 ? "99+" : count }}</view>
  </view>
</template>
<style scoped lang="scss">
@import "../styles/theme.scss";
.cart-fab {
  position: fixed;
  left: 28rpx;
  /* 悬在自绘 TabBar（约 110rpx + 安全区）上方 */
  bottom: calc(160rpx + env(safe-area-inset-bottom));
  z-index: 985; /* 低于 CartOverlay 遮罩(998)，弹层展开时被盖住 */
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary, $primary-dark);
  box-shadow: 0 10rpx 28rpx rgba(21, 117, 54, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: cart-fab-pop 0.24s ease;
}
@keyframes cart-fab-pop {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
.cart-fab:active {
  transform: scale(0.92);
}
.cart-fab__icon {
  position: relative;
  width: 40rpx;
  height: 34rpx;
  border: 5rpx solid #fff;
  border-radius: 6rpx 6rpx 14rpx 14rpx;
}
.cart-fab__handle {
  position: absolute;
  left: 50%;
  top: -16rpx;
  width: 24rpx;
  height: 18rpx;
  border: 5rpx solid rgba(255, 255, 255, 0.95);
  border-bottom: 0;
  border-radius: 14rpx 14rpx 0 0;
  transform: translateX(-50%);
  box-sizing: border-box;
}
.cart-fab__badge {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 8rpx;
  border-radius: 18rpx;
  background: $orange;
  color: #fff;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 36rpx;
  text-align: center;
  border: 3rpx solid #fff;
  box-sizing: border-box;
}
</style>
