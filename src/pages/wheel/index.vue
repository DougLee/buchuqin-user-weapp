<script setup lang="ts">
import { ref } from "vue";
import WheelPanel from "../../components/WheelPanel.vue";

/**
 * 抽奖转盘独立页（IKDB7W 薄壳化）：仅保留页头，作分享卡片/扫码直达的落地页。
 * 转盘与抽奖逻辑全部在 components/WheelPanel.vue，与首页弹层共用一份；
 * 首页入口已改为原地弹层（不再跳转本页）。
 */
const pill = ref("…");
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
      <text class="wheel-page__sub">不出寝食社 · 每日抽奖领福利</text>
      <text class="wheel-page__pill">{{ pill }}</text>
    </view>
    <view class="wheel-page__panel">
      <WheelPanel @loaded="onLoaded" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.wheel-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #075e2f 0%, #07883b 26%, #0e9c48 40%, #f6f8f6 40.2%);
  padding-bottom: 60rpx;
}
.wheel-page__statusbar {
  height: 88rpx;
}
.wheel-page__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
}
.wheel-page__title {
  font-size: 46rpx;
  font-weight: 900;
  letter-spacing: 6rpx;
  text-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.25);
}
.wheel-page__sub {
  font-size: 22rpx;
  opacity: 0.9;
  margin-top: 10rpx;
}
.wheel-page__pill {
  margin-top: 16rpx;
  background: rgba(255, 255, 255, 0.16);
  border: 1rpx solid rgba(255, 255, 255, 0.35);
  border-radius: 999rpx;
  padding: 6rpx 24rpx;
  font-size: 20rpx;
  font-weight: 700;
}
.wheel-page__panel {
  margin-top: 56rpx;
  padding: 0 28rpx;
}
</style>
