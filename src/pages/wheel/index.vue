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
  /* IKDDHF 四轮：COS 背景图 v2（static.buchuqin.com，图自带标题+副标题胶囊）；
     100% auto 宽度锁定（cover 在 tall 屏按高度放大导致胶囊位置漂移） */
  background: url("https://static.buchuqin.com/app/public/wheel-bg-festive-v2.webp") center top / 100% auto no-repeat, #e63a17;
  padding-bottom: 60rpx;
}
.wheel-page__statusbar {
  height: 88rpx;
}
/* 页头（IKDDHF 四轮）：v2 图自带标题+胶囊副标题，页头纯留白避让——
   100% auto 下图中胶囊下沿恒在 24.8% × 1333rpx ≈ 331rpx，留白 384rpx 让转盘整体下移 */
.wheel-page__head {
  padding-top: 384rpx;
}
.wheel-page__panel {
  padding: 0 28rpx;
}
</style>
