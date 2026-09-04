<script setup lang="ts">
import { ref } from "vue";
import WheelPanel from "../../components/WheelPanel.vue";

/**
 * 抽奖转盘独立页（IKDB7W 薄壳化）：仅保留页头，作分享卡片/扫码直达的落地页。
 * 转盘与抽奖逻辑全部在 components/WheelPanel.vue，与首页弹层共用一份；
 * 首页入口已改为原地弹层（不再跳转本页）。
 * 视觉：节庆橙风（IKDBJN 参考图），与首页弹层头同款。
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
      <view class="wheel-page__yay"><text>YAY!</text></view>
      <text class="wheel-page__title">天天抽奖</text>
      <view class="wheel-page__ribbon"
        ><text>不出寝食社 · 每日抽奖领福利</text></view
      >
      <view v-if="pill" class="wheel-page__pill"
        ><text class="wheel-page__pill-star">✦</text
        ><text>{{ pill }}</text
        ><text class="wheel-page__pill-star">✦</text></view
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
  /* 满版暖橙→奶油黄（IKDBPX：不到白，与弹窗一致） */
  background: linear-gradient(180deg, #ff921b 0%, #ffa53d 24%, #ffca80 50%, #ffe3b8 82%, #ffdfae 100%);
  padding-bottom: 60rpx;
}
.wheel-page__statusbar {
  height: 88rpx;
}
/* 页头（IKDBJN 参考图）：YAY 气泡 + 描边大标题 + 黄丝带 + 绿色剩余次数胶囊 */
.wheel-page__head {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.wheel-page__yay {
  position: absolute;
  left: 64rpx;
  top: 8rpx;
  background: #3f9c5c;
  color: #fff;
  font-size: 20rpx;
  font-weight: 900;
  padding: 6rpx 18rpx;
  border-radius: 18rpx 18rpx 18rpx 4rpx;
  transform: rotate(-10deg);
  box-shadow: 0 4rpx 10rpx rgba(30, 90, 50, 0.3);
}
.wheel-page__title {
  font-size: 60rpx;
  font-weight: 900;
  letter-spacing: 6rpx;
  color: #fff8e8;
  text-shadow:
    -3rpx -3rpx 0 #7a3e00, 3rpx -3rpx 0 #7a3e00,
    -3rpx 3rpx 0 #7a3e00, 3rpx 3rpx 0 #7a3e00,
    0 14rpx 30rpx rgba(122, 62, 0, 0.5);
}
.wheel-page__ribbon {
  margin-top: 18rpx;
  background: #ffd24d;
  color: #7a3e00;
  font-size: 22rpx;
  font-weight: 800;
  padding: 8rpx 32rpx;
  border-radius: 10rpx;
  box-shadow: 0 6rpx 0 rgba(122, 62, 0, 0.18);
}
.wheel-page__pill {
  margin-top: 18rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  background: #3f9c5c;
  color: #fff;
  border-radius: 999rpx;
  padding: 8rpx 28rpx;
  font-size: 24rpx;
  font-weight: 800;
  box-shadow: 0 6rpx 16rpx rgba(30, 90, 50, 0.28);
}
.wheel-page__pill-star {
  font-size: 18rpx;
  opacity: 0.9;
}
.wheel-page__panel {
  margin-top: 40rpx;
  padding: 0 28rpx;
}
</style>
