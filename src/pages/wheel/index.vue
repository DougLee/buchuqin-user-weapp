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
      <view class="wheel-page__swoosh wheel-page__swoosh--l" />
      <view class="wheel-page__swoosh wheel-page__swoosh--r" />
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
  /* 满版翡翠绿→金绿（IKDBY2，与弹窗一致） */
  background: linear-gradient(180deg, #0c4a2e 0%, #145c38 30%, #1f7a4b 55%, #2e8a5c 82%, #35a06b 100%);
  padding-bottom: 60rpx;
}
.wheel-page__statusbar {
  height: 88rpx;
}
/* 页头（IKDBY2 参考图）：金箔色衬线大标题 + ✦ 星点副标题 + 金弧线 */
.wheel-page__head {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.wheel-page__title {
  font-family: serif;
  font-size: 64rpx;
  font-weight: 900;
  letter-spacing: 8rpx;
  background: linear-gradient(180deg, #f7ecc8 20%, #e6cf8f 60%, #d4b75a 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  text-shadow: 0 6rpx 20rpx rgba(3, 40, 22, 0.5);
}
.wheel-page__ribbon {
  margin-top: 14rpx;
  color: #d8ecc9;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
}
.wheel-page__swoosh {
  position: absolute;
  width: 200rpx;
  height: 200rpx;
  border: 3rpx solid rgba(230, 207, 143, 0.5);
  border-radius: 50%;
  filter: blur(1rpx);
}
.wheel-page__swoosh--l {
  left: -60rpx;
  top: 40rpx;
  clip-path: polygon(0 0, 100% 0, 100% 60%, 0 30%);
}
.wheel-page__swoosh--r {
  right: -60rpx;
  top: 30rpx;
  clip-path: polygon(0 20%, 100% 0, 100% 30%, 0 60%);
}
.wheel-page__panel {
  margin-top: 40rpx;
  padding: 0 28rpx;
}
</style>
