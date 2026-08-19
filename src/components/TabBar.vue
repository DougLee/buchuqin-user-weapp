<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
/**
 * 自绘 tabBar（2026-08-19）：原生 tabBar 的图标显示尺寸（约 27px）与文字字号
 * （约 10px）由微信写死不可调，道哥两轮反馈"太小不协调"后改用本组件。
 * 方案：pages.json 保留 tabBar 配置（tab 页身份 + switchTab 页面缓存依赖它），
 * 但原生条永久 uni.hideTabBar 隐藏，4 个 tab 页各自挂 <TabBar :current="N" />。
 * current：0 首页 / 1 商品 / 2 订单 / 3 我的（各页写死自己的下标）。
 */
const TABS = [
  { text: "首页", path: "/pages/index/index", icon: "home" },
  { text: "商品", path: "/pages/category/index", icon: "category" },
  { text: "订单", path: "/pages/orders/index", icon: "orders" },
  { text: "我的", path: "/pages/profile/index", icon: "profile" },
] as const;
const props = defineProps<{ current: number }>();
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
      ><image
        class="tabbar__icon"
        :src="`/static/tabbar/tab-${tab.icon}${index === current ? '-active' : ''}.png`"
      />
      <text class="tabbar__text">{{ tab.text }}</text>
    </view>
  </view>
</template>
<style lang="scss" scoped>
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
.tabbar__item:active .tabbar__icon {
  transform: scale(0.88);
}
</style>
