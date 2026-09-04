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
  /* IKDDHF：COS 背景图（static.buchuqin.com，图自带标题） */
  background: url("https://static.buchuqin.com/app/public/wheel-bg-festive.webp") center top / cover no-repeat, #e63a17;
  padding-bottom: 60rpx;
}
.wheel-page__statusbar {
  height: 88rpx;
}
/* 页头：标题在背景图里，这里只保留金珠胶囊副标题 */
.wheel-page__head {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 340rpx;
}
.wheel-page__ribbon {
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
