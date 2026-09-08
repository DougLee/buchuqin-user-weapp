<script setup lang="ts">
import { ref } from "vue";
import { useSessionStore } from "../stores/session";
/**
 * 手机号授权弹层（IKE3HT 方案C，2026-09-08 道哥拍板）：
 * B 首启强授权门提审被拒（强制索权）→ 回退静默登录，改在结算页收网——
 * 未绑定手机号不能下单（下单索权属「提供服务所必需」，规范放行）。
 * 不可跳过：mask 不响应点击、无关闭钮；拒绝授权停留可重试。
 * 授权成功 user.phone 更新 → 调用方 v-if="session.needsPhone" 翻转消失。
 */
const session = useSessionStore();
const binding = ref(false);
async function onGetPhone(e: { detail: { code?: string; errMsg?: string } }) {
  const code = e.detail?.code;
  if (!code) {
    // 用户点了微信弹窗的「拒绝」：弹层保持（不可跳过），说明原因后可重试
    uni.showToast({ title: "需授权手机号才能下单，请重试", icon: "none" });
    return;
  }
  if (binding.value) return;
  binding.value = true;
  try {
    await session.bindPhoneByCode(code);
    uni.showToast({ title: "绑定成功", icon: "success" });
  } catch (err) {
    uni.showToast({
      title: err instanceof Error ? err.message : "授权失败，请重试",
      icon: "none",
    });
  } finally {
    binding.value = false;
  }
}
</script>
<template>
  <view class="gate-mask">
    <view class="gate-pop">
      <view class="gate__logo"><text>不</text></view>
      <text class="gate__title">绑定手机号</text>
      <text class="gate__desc"
        >用于配送联系与订单通知，保障这袋零食顺利送达</text
      >
      <view class="gate__points">
        <view class="gate__point"><text>下单后配送状态微信实时提醒</text></view>
        <view class="gate__point"><text>售后与骑手沟通更顺畅</text></view>
        <view class="gate__point"><text>优惠券等账号资产安全归属</text></view>
      </view>
      <button
        class="gate__btn"
        open-type="getPhoneNumber"
        :disabled="binding"
        @getphonenumber="onGetPhone"
      >
        {{ binding ? "绑定中…" : "手机号一键绑定" }}
      </button>
      <text class="gate__note">未注册的手机号将自动创建账号</text>
    </view>
  </view>
</template>
<style scoped lang="scss">
@import "../styles/theme.scss";
/* 弹窗形态（方案C）：mask 深色半透明盖满（submit 栏 z-20 之下），不响应点击 */
.gate-mask {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(10, 30, 18, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}
.gate-pop {
  width: 100%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 28rpx;
  padding: 48rpx 40rpx 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.gate__logo {
  width: 108rpx;
  height: 108rpx;
  border-radius: 30rpx;
  background: linear-gradient(150deg, #41ce69, $primary-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 34rpx rgba(7, 136, 59, 0.28);
}
.gate__logo text {
  font-size: 56rpx;
  font-weight: 900;
  color: #fff;
}
.gate__title {
  margin-top: 28rpx;
  font-size: 36rpx;
  font-weight: 900;
  color: $ink;
}
.gate__desc {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #667069;
}
.gate__points {
  width: 100%;
  margin: 32rpx 0 36rpx;
  padding: 24rpx 28rpx;
  border-radius: 20rpx;
  background: $primary-soft;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: flex-start;
}
.gate__point {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 24rpx;
  color: $ink;
  font-weight: 600;
}
.gate__point::before {
  content: "";
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  background: #fff;
  border: 2rpx solid rgba(37, 185, 90, 0.5);
  flex: none;
}
.gate__btn {
  width: 100%;
  min-height: 92rpx;
  line-height: 92rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #41ce69, $primary);
  color: #fff;
  font-size: 30rpx;
  font-weight: 900;
  box-shadow: 0 10rpx 26rpx rgba(37, 185, 90, 0.3);
}
.gate__btn[disabled] {
  opacity: 0.6;
}
.gate__note {
  margin-top: 20rpx;
  font-size: 20rpx;
  color: #667069;
}
</style>
