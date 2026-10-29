<script setup lang="ts">
import { ref } from "vue";
import { useSessionStore } from "../stores/session";
/**
 * 手机号授权弹层（IKE3HT 方案C，2026-09-08 道哥拍板）：
 * B 首启强授权门提审被拒（强制索权）→ 回退静默登录，收网提前至加购
 * （首页商品卡/详情页），结算页挂载保留兜底。
 * 可关闭（2026-10-29 道哥改定）：右上 ✕ 通知宿主收起——加购场景下次触发
 * 自动重弹、结算页提交时由宿主 needsPhone 拦截重弹；mask 点击仍不关（防误触）。
 * 绑定成功 user.phone 更新 → 宿主 v-if 翻转隐藏，@bound 补执行被拦动作。
 */
const session = useSessionStore();
const binding = ref(false);
/** 绑定成功/用户关闭均通知宿主：bound 补执行被拦加购；close 收起弹层 */
const emit = defineEmits<{ bound: []; close: [] }>();
async function onGetPhone(e: { detail: { code?: string; errMsg?: string } }) {
  const code = e.detail?.code;
  if (!code) {
    // 用户点了微信弹窗的「拒绝」：弹层保持，说明原因后可重试（关闭钮仍可用）
    uni.showToast({ title: "需授权手机号才能继续，可稍后在结算时绑定", icon: "none" });
    return;
  }
  if (binding.value) return;
  binding.value = true;
  try {
    await session.bindPhoneByCode(code);
    uni.showToast({ title: "绑定成功", icon: "success" });
    emit("bound");
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
      <view
        class="gate__close"
        role="button"
        aria-label="暂不绑定"
        @tap.stop="emit('close')"
        ><text>✕</text></view
      >
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
  position: relative;
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
/* 关闭钮（2026-10-29 道哥改定可关闭）：右上角，触达区 88rpx≥44px，
 * 视觉 ✕ 淡灰不抢主按钮；active 加深给按压反馈 */
.gate__close {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gate__close text {
  font-size: 34rpx;
  color: #a9b2ac;
  font-weight: 700;
}
.gate__close:active text {
  color: #667069;
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
