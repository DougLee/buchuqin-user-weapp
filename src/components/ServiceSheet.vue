<template>
  <view v-if="visible" class="sheet-mask" @tap.self="close">
    <view class="sheet" @tap.stop>
      <text class="sheet__title">联系客服</text>
      <template v-if="qrcode">
        <image
          :src="qrcode"
          class="sheet__qr"
          mode="aspectFit"
          show-menu-by-longpress
        />
        <text class="sheet__tip">长按识别二维码，添加校区客服微信</text>
        <button class="sheet__call ghost" @tap="call">拨打客服电话</button>
      </template>
      <template v-else>
        <text class="sheet__phone">{{ phone }}</text>
        <text class="sheet__tip">校区客服微信二维码未配置，可直接来电</text>
        <button class="sheet__call" @tap="call">立即拨打</button>
      </template>
      <text class="sheet__close" @tap="close">取消</text>
    </view>
  </view>
</template>
<script setup lang="ts">
/**
 * IKKTWM 校区客服弹层：二维码为主（长按识别）、电话为辅；未配置二维码
 * 回落拨号。全部客服入口统一走本组件（替代 open-type=contact 平台客服）。
 */
import { computed } from "vue";
import { useCampusStore } from "../stores/campus";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();
const campus = useCampusStore();
const qrcode = computed(() => campus.qrcode);
const phone = computed(() => campus.phone);
const close = () => emit("close");
const call = () => uni.makePhoneCall({ phoneNumber: phone.value });
</script>
<style scoped>
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(6, 46, 35, 0.45);
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}
.sheet {
  width: 100%;
  max-width: 560rpx;
  background: #fff;
  border-radius: 28rpx;
  padding: 40rpx 36rpx 28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sheet__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #153628;
  margin-bottom: 28rpx;
}
.sheet__qr {
  width: 320rpx;
  height: 320rpx;
  border-radius: 16rpx;
  border: 1rpx solid #eef3ef;
}
.sheet__phone {
  font-size: 40rpx;
  font-weight: 800;
  color: #0b4b36;
  letter-spacing: 1rpx;
}
.sheet__tip {
  font-size: 22rpx;
  color: #8a978f;
  margin-top: 18rpx;
}
.sheet__call {
  margin-top: 28rpx;
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 42rpx;
  background: #12a05e;
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  border: 0;
}
.sheet__call::after {
  border: 0;
}
.sheet__call.ghost {
  background: #f0f5f1;
  color: #0b4b36;
}
.sheet__close {
  margin-top: 20rpx;
  font-size: 24rpx;
  color: #8a978f;
  padding: 10rpx;
}
</style>
