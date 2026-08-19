<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { useSessionStore } from "./stores/session";
onLaunch(() => {
  void useSessionStore().ensureLogin();
  // 自绘 tabBar：启动即隐藏原生条（首帧防闪现），tab 页内的 TabBar 组件 onShow 会再兜底
  uni.hideTabBar({ animation: false, fail: () => {} });
});
</script>
<style lang="scss">
@import "./styles/theme.scss";
page {
  background: $paper;
  color: $ink;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 30rpx;
  line-height: 1.55;
}
view,
text,
image,
button,
input,
textarea,
scroll-view {
  box-sizing: border-box;
}
button::after {
  border: none;
}
button,
[role="button"] {
  touch-action: manipulation;
}
button:focus,
input:focus,
textarea:focus {
  outline: 4rpx solid rgba(37, 185, 90, 0.22);
  outline-offset: 2rpx;
}
.page {
  min-height: 100vh;
  /* 底部留白 ≥ 自绘 tabBar（内容 116rpx + iPhone 安全区 68rpx ≈ 184rpx）+ 余量 */
  padding: 28rpx 28rpx 210rpx;
}
.card {
  background: $surface;
  border: 2rpx solid rgba(32, 74, 45, 0.07);
  border-radius: 28rpx;
  box-shadow: 0 8rpx 28rpx rgba(21, 75, 38, 0.07);
}
input,
textarea {
  color: $ink;
}
textarea {
  font-size: 28rpx;
}
.card,
.primary-btn,
button {
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease,
    transform 0.12s ease;
}
/* 按压反馈（IK9AWT）：小程序按钮有原生 hover-class，H5 端用 :active 补齐触觉确认 */
button:active,
.primary-btn:active {
  transform: scale(0.97);
  opacity: 0.85;
}
.muted {
  color: #667069 !important;
}
/* CSS 箭头（IK9SO3/IK9SNP）：替代 ‹› 字符——安卓部分机型字体缺该字形，
   渲染为方框乱码。两条边旋转 45° 画 chevron，全机型一致 */
.chevron {
  display: inline-block;
  width: 14rpx;
  height: 14rpx;
  border-top: 3rpx solid currentColor;
  border-right: 3rpx solid currentColor;
  transform: rotate(45deg);
  opacity: 0.55;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 38rpx 2rpx 22rpx;
}
.section-title__main {
  font-size: 34rpx;
  font-weight: 800;
}
.section-title__main::before {
  content: "";
  display: inline-block;
  width: 8rpx;
  height: 32rpx;
  border-radius: 8rpx;
  background: $primary;
  margin-right: 14rpx;
  vertical-align: -4rpx;
}
.section-title__sub {
  color: $muted;
  font-size: 24rpx;
}
.primary-btn {
  min-height: 92rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 46rpx;
  background: linear-gradient(135deg, $primary, $primary-dark);
  color: #fff;
  font-weight: 800;
  font-size: 30rpx;
  box-shadow: 0 8rpx 20rpx rgba(37, 185, 90, 0.24);
}
.primary-btn[disabled] {
  opacity: 0.55;
  box-shadow: none;
}
.price {
  color: #ff4d18;
  font-weight: 900;
}
.price__symbol {
  font-size: 22rpx;
}
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
@media (min-width: 560px) {
  /* 宽屏下以手机宽度居中呈现 */
  html,
  body {
    background: #e8ebe7;
  }
  uni-app,
  uni-page,
  uni-page-body,
  uni-page-refresh {
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }
  uni-app {
    min-height: 100vh;
    background: $paper;
    box-shadow: 0 0 32rpx rgba(21, 75, 38, 0.16);
  }
  .page {
    max-width: 480px;
    margin: 0 auto;
  }
  .uni-tabbar {
    max-width: 480px;
    left: 50% !important;
    transform: translateX(-50%);
  }
}
/* #ifdef H5 */
/* 无障碍：跟随系统减少动效。WXSS 不支持 * 通配符（app.wxss 编译报错），小程序端不注入此块 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
/* #endif */
</style>
