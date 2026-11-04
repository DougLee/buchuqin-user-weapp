<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { nightApi } from "../api/night";
import type { NightEntry } from "../types/night";

/**
 * 首页夜宵入口横幅（IKSW1F）：
 * - 仅当 GET /night/entry 返回 inNightSession=true（校区开夜宵 + 白天已闭店
 *   + 处于夜宵窗口）时渲染——白天完全隐藏，与白天店互斥展示；
 * - 拉取失败/未开通一律静默不显示（不打扰白天主流程）；
 * - 点击进夜宵流程（楼栋选择页）。
 * 组件自持拉取：mounted + 所在页 onShow 各刷一次（夜间进出白天窗口随
 * 返回首页自动校正，客户端不做窗口自算，一切以服务端为准）。
 */
const entry = ref<NightEntry | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

async function refresh() {
  try {
    const data = await nightApi.entry();
    entry.value = data.inNightSession ? data : null;
  } catch {
    // 未登录中/校区未开夜宵/网络异常：静默隐藏，不弹任何提示
    entry.value = null;
  }
}
/** 场次窗口切换分钟级精度即可，横幅在场时 60s 轮询校正（到点自动消失） */
function startTicker() {
  if (!timer) timer = setInterval(refresh, 60_000);
}
function stopTicker() {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}
onMounted(() => {
  refresh();
  startTicker();
});
onUnmounted(stopTicker);
onShow(() => {
  refresh();
  startTicker();
});
function goNight() {
  uni.navigateTo({ url: "/pages/night/buildings" });
}
</script>

<template>
  <view v-if="entry" class="night-banner" role="button" @tap="goNight"
    ><view class="night-banner__icon"
      ><text class="night-banner__moon">🌙</text
      ><view class="night-banner__blink" /></view
    ><view class="night-banner__texts"
      ><text class="night-banner__title">夜宵店开业中</text
      ><text class="night-banner__sub"
        >{{ entry.nightStartAt || "--:--" }}~{{ entry.nightEndAt || "--:--" }}
        场次 · 楼长送到寝室</text
      ></view
    ><text class="night-banner__go">进店逛逛</text></view
  >
</template>

<style scoped lang="scss">
@import "../styles/theme.scss";
/* 夜宵横幅：深底夜色与白天店卡片强对比——开业中才渲染（v-if），白天零占位 */
.night-banner {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx 28rpx;
  border-radius: 24rpx;
  background: linear-gradient(120deg, #1e2520 0%, #17332a 60%, #07883b 160%);
  box-shadow: 0 10rpx 26rpx rgba(10, 34, 24, 0.24);
}
.night-banner:active {
  opacity: 0.9;
}
.night-banner__icon {
  position: relative;
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 2rpx solid rgba(255, 224, 130, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.night-banner__moon {
  font-size: 38rpx;
  line-height: 1;
}
/* 月亮外圈呼吸光晕（动效仅 opacity，低端机不掉帧） */
.night-banner__blink {
  position: absolute;
  inset: -6rpx;
  border-radius: 50%;
  border: 3rpx solid rgba(255, 224, 130, 0.5);
  animation: night-breathe 2.4s ease-in-out infinite;
}
@keyframes night-breathe {
  50% {
    opacity: 0.25;
  }
}
@media (prefers-reduced-motion: reduce) {
  .night-banner__blink {
    animation: none;
  }
}
.night-banner__texts {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.night-banner__title {
  font-size: 30rpx;
  font-weight: 900;
  color: #ffe082;
  letter-spacing: 1rpx;
}
.night-banner__sub {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.72);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.night-banner__go {
  flex-shrink: 0;
  padding: 12rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(255, 224, 130, 0.92);
  color: #3a2c07;
  font-size: 22rpx;
  font-weight: 800;
}
</style>
