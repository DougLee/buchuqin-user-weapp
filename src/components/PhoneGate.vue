<script setup lang="ts">
import { ref } from "vue";
import { useSessionStore } from "../stores/session";
/**
 * 手机号强授权门（IKE3HT，2026-09-08 道哥拍板 B）：
 * 未绑定手机号的用户全屏拦截——一键授权后进入；拒绝则停留门页可重试。
 * 审核被拒预案：切 A（加「先逛逛」跳过入口）。
 * z-index 1100：覆盖自绘 TabBar(990)，先于 WelcomeGift(120) 弹出。
 */
const session = useSessionStore();
const binding = ref(false);
async function onGetPhone(e: { detail: { code?: string; errMsg?: string } }) {
  const code = e.detail?.code;
  if (!code) {
    // 用户点了微信弹窗的「拒绝」：停留门页（B 方案不放行），说明原因
    uni.showToast({ title: "需授权手机号才能使用，请重试", icon: "none" });
    return;
  }
  if (binding.value) return;
  binding.value = true;
  try {
    await session.bindPhoneByCode(code);
    uni.showToast({ title: "登录成功", icon: "success" });
    // user.phone 更新 → needsPhone getter 翻转，门自动消失
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
  <view class="gate">
    <view class="gate__card">
      <view class="gate__logo"><text>不</text></view>
      <text class="gate__title">手机号一键登录</text>
      <text class="gate__desc">不出寝食社 · 校园零食 30 分钟送达寝室</text>
      <view class="gate__points">
        <view class="gate__point"><text>下单配送状态微信实时提醒</text></view>
        <view class="gate__point"><text>售后与骑手沟通更顺畅</text></view>
        <view class="gate__point"><text>账号资产（优惠券）安全归属</text></view>
      </view>
      <button
        class="gate__btn"
        open-type="getPhoneNumber"
        :disabled="binding"
        @getphonenumber="onGetPhone"
      >
        {{ binding ? "登录中…" : "手机号一键登录" }}
      </button>
      <text class="gate__note">未注册的手机号将自动创建账号</text>
    </view>
  </view>
</template>
<style scoped lang="scss">
@import "../styles/theme.scss";
.gate {
  position: fixed;
  inset: 0;
  z-index: 1100; /* 覆盖自绘 TabBar(990)：强授权期间不可切换页面 */
  background:
    radial-gradient(circle at 20% 12%, rgba(37, 185, 90, 0.14), transparent 42%),
    $paper;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}
.gate__card {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.gate__logo {
  width: 132rpx;
  height: 132rpx;
  border-radius: 36rpx;
  background: linear-gradient(150deg, #41ce69, $primary-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 34rpx rgba(7, 136, 59, 0.28);
}
.gate__logo text {
  font-size: 64rpx;
  font-weight: 900;
  color: #fff;
}
.gate__title {
  margin-top: 36rpx;
  font-size: 42rpx;
  font-weight: 900;
  color: $ink;
}
.gate__desc {
  margin-top: 12rpx;
  font-size: 25rpx;
  color: #667069;
}
.gate__points {
  margin: 44rpx 0 52rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
.gate__point {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 26rpx;
  color: $ink;
  font-weight: 600;
}
.gate__point::before {
  content: "";
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  background: $primary-soft;
  border: 2rpx solid rgba(37, 185, 90, 0.5);
  flex: none;
}
.gate__btn {
  width: 100%;
  min-height: 96rpx;
  line-height: 96rpx;
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
  margin-top: 22rpx;
  font-size: 20rpx;
  color: #667069;
}
</style>
