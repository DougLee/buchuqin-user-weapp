<script setup lang="ts">
import { ref } from "vue";
import WheelPanel from "../../components/WheelPanel.vue";

/**
 * 抽奖转盘独立页（IKDB7W 薄壳化）：仅保留页头，作分享卡片/扫码直达的落地页。
 * 转盘与抽奖逻辑全部在 components/WheelPanel.vue，与首页弹层共用一份；
 * 首页入口已改为原地弹层（不再跳转本页）。
 * 视觉：翡翠金高奢风（IKDBY2 参考图），与首页弹层头同款。
 */
const pill = ref("");
function onLoaded(state: { active: boolean; drawnToday: boolean }) {
  pill.value = !state.active
    ? "活动暂未开启"
    : state.drawnToday
      ? "今日已抽完"
      : "今日剩余 1 次";
}
</script>

<template>
  <view class="wheel-page">
    <view class="wheel-page__statusbar"><text>9:41</text></view>
    <view class="wheel-page__head">
      <text class="wheel-page__title">天天抽奖</text>
      <view class="wheel-page__ribbon"
        ><text>✦ 不出寝食社 · 每日抽奖领福利 ✦</text></view
      >
    </view>
    <view class="wheel-page__panel">
      <WheelPanel @loaded="onLoaded" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.wheel-page {
  min-height: 100vh;
  /* IKDDHF：与弹窗同款节庆红底背景图（灯笼/烟花/祥云压边） */
  background: url(../../static/wheel-bg.jpg) center top / cover no-repeat, #e63a17;
  padding-bottom: 60rpx;
}
.wheel-page__statusbar {
  height: 88rpx;
}
/* 页头（IKDDHF 参考图）：白色立体大字 + 金珠胶囊副标题 */
.wheel-page__head {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 20rpx;
}
.wheel-page__title {
  font-size: 76rpx;
  font-weight: 900;
  letter-spacing: 10rpx;
  color: #fff;
  text-shadow:
    0 3rpx 0 #f2cf6e,
    0 6rpx 0 #d9a62e,
    0 10rpx 16rpx rgba(140, 20, 0, 0.55);
}
.wheel-page__ribbon {
  margin-top: 20rpx;
  padding: 8rpx 36rpx;
  border-radius: 999rpx;
  border: 2rpx solid #f2cf6e;
  background: rgba(160, 26, 10, 0.55);
  color: #ffedbe;
  font-size: 24rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
}
.wheel-page__panel {
  margin-top: 40rpx;
  padding: 0 28rpx;
}
</style>
