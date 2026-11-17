<script setup lang="ts">
defineProps<{ qrcode?: string; tip?: string }>();
</script>
<template>
  <view v-if="qrcode" class="group-card">
    <view class="group-card__head"><view class="group-card__badge" /><view class="group-card__titles"><text class="group-card__title">售后福利群</text><text class="group-card__sub">{{ tip || '专属售后通道 · 福利优先享' }}</text></view></view>
    <view class="group-card__body"><image :src="qrcode" class="group-card__qr" mode="aspectFit" show-menu-by-longpress @tap="uni.previewImage({ urls: [qrcode!], current: qrcode })" /><view class="group-card__aside"><text class="group-card__hint">长按识别二维码</text><text v-if="!tip" class="group-card__hint group-card__hint--sub">加入福利群，售后进度与专属优惠第一时间掌握</text></view></view>
  </view>
</template>
<style scoped lang="scss">
@import '../styles/theme.scss';
.group-card {
  margin-top: 22rpx;
  background: #fff;
  border-radius: 28rpx;
  box-shadow: 0 8rpx 28rpx rgba(21, 75, 38, 0.07);
  overflow: hidden;
}
.group-card__head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 28rpx;
  background: linear-gradient(135deg, $primary-dark, $primary);
  color: #fff;
}
.group-card__badge {
  position: relative;
  width: 44rpx;
  height: 36rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  border-radius: 12rpx;
  flex: 0 0 auto;
}
.group-card__badge::after {
  content: "";
  position: absolute;
  right: -10rpx;
  bottom: -6rpx;
  width: 16rpx;
  height: 14rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  border-radius: 6rpx 6rpx 6rpx 2rpx;
  background: linear-gradient(135deg, $primary-dark, $primary);
}
.group-card__titles {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  flex: 1;
  min-width: 0;
}
.group-card__title {
  font-size: 30rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}
.group-card__sub {
  font-size: 21rpx;
  opacity: 0.85;
}
.group-card__body {
  display: flex;
  align-items: center;
  gap: 30rpx;
  padding: 32rpx 34rpx;
}
.group-card__qr {
  width: 400rpx;
  height: 400rpx;
  border-radius: 20rpx;
  border: 1rpx solid rgba(32, 74, 45, 0.08);
  flex: 0 0 auto;
  background: #fafbfa;
}
.group-card__aside {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}
.group-card__hint {
  font-size: 26rpx;
  font-weight: 700;
  color: #153628;
  letter-spacing: 1rpx;
}
.group-card__hint--sub {
  font-size: 22rpx;
  font-weight: 400;
  color: $muted;
  line-height: 1.6;
  letter-spacing: 0;
}

</style>
