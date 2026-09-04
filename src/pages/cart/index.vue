<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useCartStore } from "../../stores/cart";
import { fenToYuan } from "../../utils/money";
import type { CartLine } from "../../types";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
/**
 * 购物车 Tab 页（IKAHBQ）：订单让位降级普通页，购物车回归 Tab 形态。
 * 行编辑/库存标注/起送拦截与悬浮窗 CartOverlay 同口径（IK97FD 保留并存，
 * 悬浮球由 IKAHBR 下线）。
 */
const cart = useCartStore();
/** 首次加载标记（骨架屏）：store.loading 在 ensureLogin 之后才置真，
 *  首帧会闪空态——用本地 booted 盖住首帧，拉完才允许展示空车引导 */
const booted = ref(false);
onShow(async () => {
  await cart.load();
  booted.value = true;
});
/** 库存行内标注（ADR-0005/IKA00Q）：与悬浮窗同口径，就地提示不等结算报错 */
function stockTag(line: CartLine): string {
  const { stock } = line.product;
  if (stock <= 0) return "已抢完";
  if (line.quantity > stock) return `库存不足，仅剩 ${stock} 件`;
  return "";
}
/**
 * 起送门槛判断（IKDEUK）：与结算页 belowThreshold 同源同口径——
 * GET /cart 返回 deliveryThreshold（分），金额 > 0 且 < 门槛才算未达标；
 * 门槛为 0（无门槛）或已达标均为 false，提醒条与置灰都不渲染。
 */
const belowThreshold = computed(
  () =>
    cart.cart.productAmount > 0 &&
    cart.cart.productAmount < (cart.cart.deliveryThreshold ?? 1000),
);
/** 差额展示（IKDEUK）：分转元固定两位小数，对齐结算页 thresholdGap 写法 */
const thresholdGap = computed(() =>
  fenToYuan((cart.cart.deliveryThreshold ?? 1000) - cart.cart.productAmount),
);
/** 凑单进度（IKDEUK 二轮视觉升级）：已购/门槛比例驱动进度条，封顶 100 */
const thresholdProgress = computed(() =>
  Math.min(
    100,
    (cart.cart.productAmount / (cart.cart.deliveryThreshold ?? 1000)) * 100,
  ),
);
function checkout() {
  if (!cart.cart.items.length) return;
  // 低于起送门槛就地拦截（IK9YPJ）：与悬浮窗/结算页 belowThreshold 同口径
  if (belowThreshold.value) {
    uni.showToast({ title: `还差 ¥${thresholdGap.value} 起送`, icon: "none" });
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
    ><!-- 加载骨架（2026-08-24）：行卡同构占位，空车引导不再抢跑闪断 --><view
      v-if="!booted && !cart.cart.items.length"
      class="cart-list card"
      ><view v-for="n in 3" :key="n" class="cart-skeleton__line" /></view
    ><view v-else-if="!cart.cart.items.length" class="cart-empty"
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
      ><!-- 起送凑单条（IKDEUK 二轮）：未达标时悬于结算行上方——差额金额 +
           去凑单入口 + 进度条（已购/门槛），达标/无门槛不渲染 --><view
        v-if="belowThreshold"
        class="cart-foot__threshold"
        aria-role="alert"
        ><view class="threshold__info"
          ><text class="threshold__text">还差</text
          ><text class="threshold__amount">¥{{ thresholdGap }}</text
          ><text class="threshold__text">即可起送</text
          ><!-- 去凑单（次级转化入口）：复用 goBrowse 跳分类页 --><view
            class="threshold__go"
            @tap="goBrowse"
            >去凑单 ›</view
          ></view
        ><view class="threshold__bar"
          ><view
            class="threshold__fill"
            :style="{ width: thresholdProgress + '%' }"
          ></view></view></view
      ><view class="cart-foot__row"
        ><view
          ><text class="muted">合计</text
          ><text class="cart-foot__total"
            >¥{{ fenToYuan(cart.cart.productAmount) }}</text
          ></view
        ><!-- 未达标置灰（IKDEUK）：不落 native disabled——微信 disabled 按钮会吞
          tap 导致拦截 toast 出不来，改 class 置灰 + aria-disabled 语义，
          拦截与提示统一走 checkout() --><button
          class="primary-btn cart-foot__checkout"
          :class="{ 'cart-foot__checkout--locked': belowThreshold }"
          :aria-disabled="belowThreshold ? 'true' : 'false'"
          :disabled="!cart.cart.items.length"
          @tap="checkout"
        >
          去结算
        </button></view
      ></view
    >
  </view>
  <TabBar :current="2" />
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.cart-page {
  /* 底部补偿（IKAHBQ）：让出固定结算条 + 自绘 TabBar(≈118rpx)；
   * IKDEUK 二轮凑单条（文案行+进度条 ≈110rpx）后结算区整体 ≈250rpx */
  padding-bottom: calc(380rpx + env(safe-area-inset-bottom));
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
/* 加载骨架（2026-08-24）：与 .line 同高的行卡占位，shimmer 与全端同款 */
.cart-skeleton__line {
  height: 184rpx;
  border-radius: 20rpx;
  margin: 22rpx 0;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: cart-pulse 1.2s infinite;
}
@keyframes cart-pulse {
  50% {
    opacity: 0.55;
  }
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
/* 固定结算条（IKAHBQ）：悬于自绘 TabBar 上方，低于其 z-index(990) 不抢层。
 * IKDEUK 改纵向两层：门槛提醒胶丸在上、合计+按钮行在下 */
.cart-foot {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(118rpx + env(safe-area-inset-bottom));
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 18rpx 28rpx;
  background: $surface;
  box-shadow: 0 -8rpx 24rpx rgba(21, 75, 38, 0.08);
}
.cart-foot__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}
/* 起送凑单条（IKDEUK 二轮视觉升级）：浅暖奶油底 + 橙系进度条，配色取自
 * 福利群卡同款色板（#fff1e2 底 / #ff7a21 渐变 / #b96f33 辅文），与首页
 * 双版块一个视觉语言；圆角 20rpx 对齐项目模块圆角 */
.cart-foot__threshold {
  padding: 14rpx 24rpx 18rpx;
  border-radius: 20rpx;
  background: linear-gradient(150deg, #fff8f0, #fff1e2);
  border: 2rpx solid rgba(255, 122, 33, 0.2);
}
.threshold__info {
  display: flex;
  align-items: center;
  gap: 6rpx;
}
.threshold__text {
  font-size: 24rpx;
  font-weight: 700;
  color: #b96f33;
}
/* 差额金额：视觉主角，放大加粗 */
.threshold__amount {
  font-size: 32rpx;
  font-weight: 900;
  color: #e25c05;
}
/* 去凑单：白底橙字小胶囊（在浅橙底上浮起一层），次级转化入口 */
.threshold__go {
  position: relative;
  margin-left: auto;
  min-height: 56rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  border-radius: 999rpx;
  background: #fff;
  border: 2rpx solid rgba(226, 92, 5, 0.35);
  font-size: 24rpx;
  font-weight: 800;
  color: #e25c05;
  box-shadow: 0 4rpx 10rpx rgba(217, 95, 16, 0.1);
}
/* 命中区外扩（counter 同款）：触控目标不小于规范 */
.threshold__go::after {
  content: "";
  position: absolute;
  left: -12rpx;
  top: -12rpx;
  right: -12rpx;
  bottom: -12rpx;
}
.threshold__go:active {
  transform: scale(0.95);
  opacity: 0.9;
}
/* 进度条：已购/门槛比例，加减商品时宽度平滑推进（高级感来源） */
.threshold__bar {
  margin-top: 14rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(226, 92, 5, 0.12);
  overflow: hidden;
}
.threshold__fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #ffb37a, #ff7a21);
  transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
@media (prefers-reduced-motion: reduce) {
  .threshold__fill {
    transition: none;
  }
  .threshold__go:active {
    transform: none;
  }
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
/* 未达标置灰（IKDEUK）：native disabled 会吞 tap，用 class 表达置灰语义 */
.cart-foot__checkout--locked {
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
