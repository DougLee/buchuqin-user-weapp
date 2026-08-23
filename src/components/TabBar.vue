<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { useCartStore } from "../stores/cart";
/**
 * 自绘 tabBar（2026-08-19）：原生 tabBar 的图标显示尺寸（约 27px）与文字字号
 * （约 10px）由微信写死不可调，道哥两轮反馈"太小不协调"后改用本组件。
 * 方案：pages.json 保留 tabBar 配置（tab 页身份 + switchTab 页面缓存依赖它），
 * 但原生条永久 uni.hideTabBar 隐藏，4 个 tab 页各自挂 <TabBar :current="N" />。
 * current：0 首页 / 1 商品 / 2 购物车 / 3 我的（各页写死自己的下标）。
 * IKAHBQ：订单位换购物车，图标走 CSS 购物袋（无 png 资产）+ 件数角标，
 * 角标口径同 CartFab——totalQuantity>0 才显示，超 99 显 99+。
 */
const TABS = [
  { text: "首页", path: "/pages/index/index", icon: "home" },
  { text: "商品", path: "/pages/category/index", icon: "category" },
  { text: "购物车", path: "/pages/cart/index", icon: "cart" },
  { text: "我的", path: "/pages/profile/index", icon: "profile" },
] as const;
const props = defineProps<{ current: number }>();
const cart = useCartStore();
function go(index: number) {
  if (index === props.current) return; // 已在当前页，避免重复触发 onShow
  uni.switchTab({ url: TABS[index].path });
}
// 兜底再压一次原生条：App onLaunch 已隐藏过，极端场景（系统弹回）再保险
onShow(() => uni.hideTabBar({ animation: false, fail: () => {} }));
</script>
<template>
  <view class="tabbar safe-bottom" role="tablist">
    <view
      v-for="(tab, index) in TABS"
      :key="tab.path"
      class="tabbar__item"
      :class="{ 'tabbar__item--active': index === current }"
      role="tab"
      :aria-selected="index === current"
      :aria-label="tab.text"
      @tap="go(index)"
      ><!-- 购物车 tab（IKAHBQ）：CSS 购物袋 + 件数角标，其余 tab 走 png 图标 -->
      <view class="tabbar__icon-wrap"
        ><view v-if="tab.icon === 'cart'" class="tabbar__bag"
          ><view class="tabbar__handle"
        /></view
        ><image
          v-else
          class="tabbar__icon"
          :src="`/static/tabbar/tab-${tab.icon}${index === current ? '-active' : ''}.png`"
        />
        <text
          v-if="tab.icon === 'cart' && cart.cart.totalQuantity > 0"
          class="tabbar__badge"
          >{{
            cart.cart.totalQuantity > 99 ? "99+" : cart.cart.totalQuantity
          }}</text
        ></view
      >
      <text class="tabbar__text">{{ tab.text }}</text>
    </view>
  </view>
</template>
<style lang="scss" scoped>
@import "../styles/theme.scss";
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  /* 低于 CartOverlay 遮罩(998)/面板(999)，购物车打开时被盖住，视觉正确 */
  z-index: 990;
  display: flex;
  background: #ffffff;
  border-top: 2rpx solid rgba(32, 74, 45, 0.08);
  box-shadow: 0 -6rpx 24rpx rgba(21, 75, 38, 0.06);
}
.tabbar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14rpx 0 8rpx;
}
.tabbar__icon {
  width: 64rpx;
  height: 64rpx;
  display: block;
  transition: transform 0.12s ease;
}
/* 购物车图标槽（IKAHBQ）：png 同尺寸占位，袋子/角标以它为定位基准 */
.tabbar__icon-wrap {
  position: relative;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tabbar__bag {
  position: relative;
  width: 44rpx;
  height: 36rpx;
  border: 5rpx solid currentColor;
  border-radius: 8rpx 8rpx 14rpx 14rpx;
  box-sizing: border-box;
  color: #747b76;
  transition: transform 0.12s ease;
}
.tabbar__handle {
  position: absolute;
  left: 50%;
  top: -15rpx;
  width: 24rpx;
  height: 18rpx;
  border: 5rpx solid currentColor;
  border-bottom: 0;
  border-radius: 12rpx 12rpx 0 0;
  transform: translateX(-50%);
  box-sizing: border-box;
}
.tabbar__item--active .tabbar__bag {
  color: #25b95a;
}
/* 件数角标（IKAHBQ）：口径同 CartFab，白描边在白底条上立得住 */
.tabbar__badge {
  position: absolute;
  top: -8rpx;
  right: -18rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 7rpx;
  border-radius: 16rpx;
  background: $orange;
  color: #fff;
  font-size: 19rpx;
  font-weight: 900;
  line-height: 32rpx;
  text-align: center;
  border: 3rpx solid #fff;
  box-sizing: border-box;
}
.tabbar__text {
  margin-top: 6rpx;
  font-size: 20rpx;
  line-height: 1.2;
  color: #747b76;
  transition: color 0.2s ease;
}
.tabbar__item--active .tabbar__text {
  color: #25b95a;
  font-weight: 600;
}
.tabbar__item:active .tabbar__icon,
.tabbar__item:active .tabbar__bag {
  transform: scale(0.88);
}
@media (min-width: 560px) {
  /* PC 端（IKA08S）：定宽居中替代 left:0/right:0 全宽拉伸——
     切 Tab 引发滚动条出现/消失时全宽条会变窄、flex 项重新分位即「晃动」；
     定宽后不再受影响，且与 480px 手机宽度居中方案视觉统一 */
  .tabbar {
    left: 50%;
    right: auto;
    width: 480px;
    transform: translateX(-50%);
  }
}
</style>
