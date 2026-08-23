<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { useCartStore } from "../../stores/cart";
import { fenToYuan } from "../../utils/money";
import type { CartLine } from "../../types";
/**
 * 购物车 Tab 页（IKAHBQ）：订单让位降级普通页，购物车回归 Tab 形态。
 * 行编辑/库存标注/起送拦截与悬浮窗 CartOverlay 同口径（IK97FD 保留并存，
 * 悬浮球由 IKAHBR 下线）。
 */
const cart = useCartStore();
onShow(() => void cart.load());
/** 库存行内标注（ADR-0005/IKA00Q）：与悬浮窗同口径，就地提示不等结算报错 */
function stockTag(line: CartLine): string {
  const { stock } = line.product;
  if (stock <= 0) return "已抢完";
  if (line.quantity > stock) return `库存不足，仅剩 ${stock} 件`;
  return "";
}
function checkout() {
  if (!cart.cart.items.length) return;
  // 低于起送门槛就地拦截（IK9YPJ）：与悬浮窗/结算页 belowThreshold 同口径
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
  uni.navigateTo({ url: "/pages/checkout/index" });
}
const goBrowse = () => uni.switchTab({ url: "/pages/category/index" });
</script>
<template>
  <view class="page cart-page"
    ><view class="cart-head"
      ><text class="cart-head__title">购物车</text
      ><text class="muted">{{ cart.cart.totalQuantity }} 件</text></view
    ><view v-if="!cart.cart.items.length" class="cart-empty"
      ><text class="cart-empty__mark">空</text
      ><text class="cart-empty__title">购物车还空着</text
      ><text class="muted">去挑点今晚想吃的吧</text
      ><button class="cart-empty__go" @tap="goBrowse">去逛逛</button></view
    ><view v-else class="cart-list card"
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
          ><!-- 库存行内标注（ADR-0005/IKA00Q） --><text
            v-if="stockTag(line)"
            class="line__stock-flag"
            >{{ stockTag(line) }}</text
          ><view class="line__bottom"
            ><text class="price"
              ><text class="price__symbol">¥</text
              >{{ fenToYuan(line.product.price) }}</text
            ><!-- 数量读写走 cart.quantity()（IK9AWM）：连点时读到 pending 新值 --><view
              class="counter"
              ><button
                aria-label="减少一件"
                @tap="
                  cart.set(line.product, cart.quantity(line.product.id) - 1)
                "
              >
                −</button
              ><text>{{ cart.quantity(line.product.id) }}</text
              ><!-- 到量即禁加（ADR-0005/IKA00Q）：stock=0 也禁 --><button
                aria-label="增加一件"
                :disabled="
                  cart.quantity(line.product.id) >=
                  Math.max(line.product.stock, 0)
                "
                @tap="
                  cart.set(line.product, cart.quantity(line.product.id) + 1)
                "
              >
                ＋</button
              ></view
            ></view
          ></view
        ></view
      ></view
    ><view class="cart-foot safe-bottom"
      ><view
        ><text class="muted">合计</text
        ><text class="cart-foot__total"
          >¥{{ fenToYuan(cart.cart.productAmount) }}</text
        ></view
      ><button
        class="primary-btn cart-foot__checkout"
        :disabled="!cart.cart.items.length"
        @tap="checkout"
      >
        去结算
      </button></view
    >
  </view>
  <TabBar :current="2" />
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.cart-page {
  /* 底部补偿（IKAHBQ）：让出固定结算条(≈124rpx) + 自绘 TabBar(≈118rpx) */
  padding-bottom: calc(270rpx + env(safe-area-inset-bottom));
}
.cart-head {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  padding: 30rpx 28rpx 20rpx;
}
.cart-head__title {
  font-size: 38rpx;
  font-weight: 900;
}
.cart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding-top: 120rpx;
}
.cart-empty__mark {
  display: flex;
  width: 160rpx;
  height: 160rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: $primary-soft;
  border: 5rpx solid $primary;
  color: $primary-dark;
  font-size: 52rpx;
  font-weight: 900;
}
.cart-empty__title {
  font-size: 34rpx;
  font-weight: 900;
  margin-top: 28rpx;
}
.cart-empty__go {
  margin-top: 32rpx;
  min-height: 88rpx;
  line-height: 88rpx;
  padding: 0 64rpx;
  border-radius: 44rpx;
  background: $primary;
  color: #fff;
  font-size: 26rpx;
  font-weight: 800;
}
.cart-list {
  margin: 0 28rpx;
  padding: 6rpx 28rpx;
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
/* 库存行内标注 chip（ADR-0005/IKA00Q） */
.line__stock-flag {
  display: inline-block;
  margin-top: 8rpx;
  padding: 2rpx 12rpx;
  border-radius: 14rpx;
  font-size: 20rpx;
  font-weight: 800;
  color: $orange;
  background: $cream;
}
.counter button[disabled] {
  opacity: 0.4;
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
/* 固定结算条（IKAHBQ）：悬于自绘 TabBar 上方，低于其 z-index(990) 不抢层 */
.cart-foot {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(118rpx + env(safe-area-inset-bottom));
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 18rpx 28rpx;
  background: $surface;
  box-shadow: 0 -8rpx 24rpx rgba(21, 75, 38, 0.08);
}
.cart-foot__total {
  font-size: 40rpx;
  font-weight: 900;
  color: $primary-dark;
  margin-left: 12rpx;
}
.cart-foot__checkout {
  width: 260rpx;
  margin: 0;
}
.cart-foot__checkout[disabled] {
  opacity: 0.55;
}
.primary-btn[disabled] {
  opacity: 0.55;
}
@media (min-width: 560px) {
  /* 宽屏与自绘 TabBar 的 480px 定宽居中方案对齐 */
  .cart-foot {
    left: 50%;
    right: auto;
    width: 480px;
    margin-left: -240px;
  }
}
</style>
