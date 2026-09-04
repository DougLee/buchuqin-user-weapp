<script setup lang="ts">
import WheelPanel from "../../components/WheelPanel.vue";

/**
 * 抽奖转盘独立页（IKDB7W 薄壳化）：转盘与抽奖逻辑全部在 components/WheelPanel.vue，
 * 与首页弹层共用一份；首页入口已改为原地弹层（不再跳转本页）。
 * 视觉：IKDDHF 三轮节庆红金背景 v2（图自带标题+副标题胶囊，页头纯留白避让）。
 */
</script>

<template>
  <view class="wheel-page">
    <view class="wheel-page__statusbar"><text>9:41</text></view>
    <view class="wheel-page__head"></view>
    <view class="wheel-page__panel">
      <WheelPanel />
    </view>
  </view>
</template>

<style scoped lang="scss">
.wheel-page {
  min-height: 100vh;
  /* IKDDHF 三轮：COS 背景图 v2（static.buchuqin.com，图自带标题+副标题胶囊） */
  background: url("https://static.buchuqin.com/app/public/wheel-bg-festive-v2.webp") center top / cover no-repeat, #e63a17;
  padding-bottom: 60rpx;
}
.wheel-page__statusbar {
  height: 88rpx;
}
/* 页头（IKDDHF 三轮）：v2 图自带标题+胶囊副标题，页头不再放文字元素，纯留白避让——
   图 750×1333 全屏 cover 显示高约 1333rpx，图中胶囊下沿约 24.8% ≈ 331rpx */
.wheel-page__head {
  padding-top: 356rpx;
}
.wheel-page__panel {
  padding: 0 28rpx;
}
</style>
