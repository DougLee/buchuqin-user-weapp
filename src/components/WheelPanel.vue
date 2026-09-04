<script setup lang="ts">
/**
 * 抽奖转盘面板（IKD6FB / IKDB7W）：转盘+次数+规则+结果弹窗的公共组件。
 * 首页弹层与 pages/wheel 独立页（分享落地）共用，抽奖逻辑只此一份。
 * 8 奖位权重随机（概率只在服务端），每日 1 次按北京时间自然日；
 * 平台券自动入账、异业券弹图文、券发完服务端自动降级谢谢参与。
 */
import { computed, ref } from "vue";
import { api } from "../api";
import { useSessionStore } from "../stores/session";

interface WheelPrizeView {
  type: "coupon" | "partner" | "none";
  label: string;
  bizTitle: string;
  bizImage: string;
  bizNote: string;
}
const loading = ref(true),
  active = ref(false),
  prizes = ref<WheelPrizeView[]>([]),
  drawnToday = ref(false),
  drawing = ref(false),
  /** 转盘旋转角：抽时累加（不回零），动画走 CSS transition */
  rotation = ref(0),
  spinning = ref(false);
/** 结果弹窗：null=关闭；type 驱动三态（coupon/partner/none） */
const result = ref<{
  type: "coupon" | "partner" | "none";
  label: string;
  bizTitle: string;
  bizImage: string;
  bizNote: string;
} | null>(null);

const canDraw = computed(
  () => active.value && !drawnToday.value && !spinning.value && !drawing.value,
);
const emit = defineEmits<{
  /** 数据拉取完成：宿主（独立页壳）用它更新页头胶囊文案 */
  (e: "loaded", state: { active: boolean; drawnToday: boolean }): void;
}>();

void (async () => {
  await useSessionStore().ensureLogin();
  try {
    const res = await api.wheel();
    active.value = res.active;
    prizes.value = res.prizes;
    drawnToday.value = res.drawnToday;
    emit("loaded", { active: res.active, drawnToday: res.drawnToday });
  } finally {
    loading.value = false;
  }
})();

/** 点击抽奖：服务端决定结果（含发完降级），前端只做动画与展示。
 *  指针在正上方，转 (360×5 − 扇区中心角) 使命中位停在指针下。 */
async function spin() {
  if (!canDraw.value) return;
  drawing.value = true;
  try {
    const res = await api.drawWheel();
    drawnToday.value = true;
    const center = res.index * 45 + 22.5; // 命中扇区中心角（顺时针）
    spinning.value = true;
    rotation.value += 360 * 5 - ((rotation.value + center) % 360);
    // 动画时长与 CSS transition 保持一致（4.2s）再弹结果
    setTimeout(() => {
      spinning.value = false;
      result.value = res.prize;
    }, 4250);
  } catch (e) {
    uni.showToast({
      title: e instanceof Error ? e.message : "抽奖失败",
      icon: "none",
    });
  } finally {
    drawing.value = false;
  }
}
function closeResult() {
  result.value = null;
}
function goCoupons() {
  closeResult();
  uni.navigateTo({ url: "/pages/coupons/index" });
}
</script>

<template>
  <view v-if="loading" class="wp-loading">加载中...</view>
  <template v-else>
    <view class="wheel-stage">
      <view class="wheel-lights">
        <view
          v-for="n in 16"
          :key="n"
          class="wheel-lights__bulb"
          :class="{ 'wheel-lights__bulb--dim': n % 2 === 0 }"
          :style="{ transform: `rotate(${n * 22.5}deg) translateY(-252rpx)` }"
        />
      </view>
      <view
        class="wheel-disc"
        :class="{ 'wheel-disc--spin': spinning }"
        :style="{ transform: `rotate(${rotation}deg)` }"
      >
        <view
          v-for="(p, i) in prizes"
          :key="i"
          class="wheel-disc__label"
          :class="{
            'wheel-disc__label--none': p.type === 'none',
            'wheel-disc__label--partner': p.type === 'partner',
          }"
          :style="{
            transform: `translate(-50%,-50%) rotate(${i * 45}deg) translateY(-196rpx) rotate(${-i * 45}deg)`,
          }"
        >
          <text>{{ p.label }}</text>
          <text v-if="p.type === 'coupon'" class="wheel-disc__tag">平台券</text>
          <text v-else-if="p.type === 'partner'" class="wheel-disc__tag"
            >异业券</text
          >
        </view>
      </view>
      <!-- 指针（正上方）与中心按钮（3D 按压，已抽置灰） -->
      <view class="wheel-pointer" />
      <view
        class="wheel-hub"
        :class="{
          'wheel-hub--disabled': !canDraw,
          'wheel-hub--pressing': drawing,
        }"
        @tap="spin"
      >
        <text class="wheel-hub__main">{{
          !active ? "未开启" : drawnToday ? "已抽" : "抽奖"
        }}</text>
        <text class="wheel-hub__sub">{{
          !active ? "敬请期待" : drawnToday ? "明日 0 点重置" : "今日剩 1 次"
        }}</text>
      </view>
    </view>
    <view class="wheel-chance">
      <template v-if="!active">活动暂未开启，敬请期待</template>
      <template v-else-if="drawnToday">今日机会已用完，明天 0 点再来</template>
      <template v-else>今日剩余抽奖次数：<text class="hot">1</text> 次</template>
    </view>
    <view class="wheel-rules">
      <view class="wheel-rules__title"><text>活动规则</text></view>
      <text class="wheel-rules__line">1. 每位用户每日可抽奖 1 次，次日 0 点重新计算；</text>
      <text class="wheel-rules__line">2. 平台优惠券抽中后自动发放至「我的 - 优惠券」；</text>
      <text class="wheel-rules__line">3. 异业合作福利抽中后展示图文，请长按识别二维码领取；</text>
      <text class="wheel-rules__line">4. 奖品随机发放，与历史抽奖结果无关。</text>
    </view>

    <!-- 结果弹窗三态：平台券 / 异业券图文 / 谢谢参与 -->
    <view v-if="result" class="wheel-mask" @tap="closeResult">
      <view
        class="wheel-pop"
        :class="{ 'wheel-pop--green': result.type === 'coupon' }"
        @tap.stop
      >
        <view class="wheel-pop__ribbon">{{
          result.type === "coupon"
            ? "优惠券发放成功"
            : result.type === "partner"
              ? "恭喜获得异业福利"
              : "谢谢参与"
        }}</view>
        <template v-if="result.type === 'coupon'">
          <view class="wheel-coupon">
            <text class="wheel-coupon__label">{{ result.label }}</text>
          </view>
          <text class="wheel-pop__desc">可前往「我的 - 优惠券」查看使用</text>
          <view class="wheel-pop__btns">
            <view class="wheel-btn wheel-btn--ghost" @tap="closeResult">继续逛逛</view>
            <view class="wheel-btn wheel-btn--solid" @tap="goCoupons">查看优惠券</view>
          </view>
        </template>
        <template v-else-if="result.type === 'partner'">
          <image
            class="wheel-pop__img"
            :src="result.bizImage"
            mode="widthFix"
            show-menu-by-longpress
          />
          <text class="wheel-pop__biz">{{ result.bizTitle }}</text>
          <text v-if="result.bizNote" class="wheel-pop__desc">{{ result.bizNote }}</text>
          <text class="wheel-pop__hint">长按图片可识别商家二维码</text>
          <view class="wheel-pop__btns">
            <view class="wheel-btn wheel-btn--solid" @tap="closeResult">开心收下</view>
          </view>
        </template>
        <template v-else>
          <text class="wheel-pop__desc">差一点点就中了{"\n"}明天 0 点再来，好运不打烊</text>
          <view class="wheel-pop__btns">
            <view class="wheel-btn wheel-btn--solid" @tap="closeResult">明天再来</view>
          </view>
        </template>
      </view>
    </view>
  </template>
</template>

<style scoped lang="scss">
.wp-loading {
  text-align: center;
  color: rgba(255, 255, 255, 0.85);
  font-size: 24rpx;
  padding: 80rpx 0;
}
/* ---------- 转盘 ---------- */
.wheel-stage {
  position: relative;
  width: 560rpx;
  height: 560rpx;
  margin: 0 auto;
}
.wheel-lights {
  position: absolute;
  inset: 0;
}
.wheel-lights__bulb {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16rpx;
  height: 16rpx;
  margin: -8rpx 0 0 -8rpx;
  border-radius: 50%;
  background: #fff3c4;
  box-shadow: 0 0 12rpx 4rpx rgba(255, 240, 180, 0.85);
}
.wheel-lights__bulb--dim {
  background: #e8d9a8;
  box-shadow: none;
}
.wheel-disc {
  position: absolute;
  inset: 24rpx;
  border-radius: 50%;
  /* 8 扇区白/浅绿交替（conic 从正上方顺时针，与奖位序号一致） */
  background: conic-gradient(
    #ffffff 0 45deg, #e4f6e8 45deg 90deg,
    #ffffff 90deg 135deg, #e4f6e8 135deg 180deg,
    #ffffff 180deg 225deg, #e4f6e8 225deg 270deg,
    #ffffff 270deg 315deg, #e4f6e8 315deg 360deg
  );
  border: 12rpx solid #ffc94d;
  box-shadow: 0 20rpx 60rpx rgba(6, 46, 23, 0.35), inset 0 0 0 4rpx #fff;
  transition: transform 4.2s cubic-bezier(0.16, 0.84, 0.28, 1);
}
.wheel-disc__label {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 22rpx;
  font-weight: 800;
  color: #07883b;
  white-space: nowrap;
}
.wheel-disc__tag {
  font-size: 16rpx;
  font-weight: 600;
  color: #2f8a52;
  margin-top: 2rpx;
}
.wheel-disc__label--partner {
  color: #c2570f;
}
.wheel-disc__label--partner .wheel-disc__tag {
  color: #b96f33;
}
.wheel-disc__label--none {
  color: #9aa5a0;
}
.wheel-pointer {
  position: absolute;
  left: 50%;
  top: -6rpx;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 20rpx solid transparent;
  border-right: 20rpx solid transparent;
  border-top: 52rpx solid #ff4d2e;
  filter: drop-shadow(0 4rpx 6rpx rgba(0, 0, 0, 0.25));
  z-index: 3;
}
/* 中心按钮：Claymorphism 双层阴影 + 按压凹陷 + 置灰禁用 */
.wheel-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 168rpx;
  height: 168rpx;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: radial-gradient(circle at 32% 26%, #ffa259, #ff6a1e 55%, #e8520c);
  border: 10rpx solid #fff;
  box-shadow: 0 16rpx 36rpx rgba(232, 82, 12, 0.5),
    inset 0 -10rpx 16rpx rgba(150, 40, 0, 0.35),
    inset 0 6rpx 10rpx rgba(255, 255, 255, 0.4);
  z-index: 2;
}
.wheel-hub--pressing {
  box-shadow: 0 6rpx 16rpx rgba(232, 82, 12, 0.5),
    inset 0 4rpx 16rpx rgba(150, 40, 0, 0.45);
}
.wheel-hub--disabled {
  background: radial-gradient(circle at 32% 26%, #c9cfcb, #9aa5a0 60%, #7d8882);
  box-shadow: 0 8rpx 20rpx rgba(90, 100, 94, 0.35),
    inset 0 -8rpx 12rpx rgba(70, 80, 74, 0.3);
}
.wheel-hub__main {
  font-size: 40rpx;
  font-weight: 900;
  letter-spacing: 6rpx;
  text-shadow: 0 2rpx 6rpx rgba(150, 40, 0, 0.5);
}
.wheel-hub__sub {
  font-size: 16rpx;
  opacity: 0.95;
  margin-top: 6rpx;
}
/* ---------- 次数与规则 ---------- */
.wheel-chance {
  text-align: center;
  color: #0a7c3b;
  font-size: 24rpx;
  font-weight: 700;
  margin-top: 36rpx;
}
.wheel-chance .hot {
  color: #ff5a1f;
  font-size: 28rpx;
}
.wheel-rules {
  margin: 28rpx 0 0;
  background: #fff;
  border-radius: 28rpx;
  padding: 26rpx 30rpx;
  border: 1rpx solid #eef3ef;
}
.wheel-rules__title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 24rpx;
  font-weight: 800;
  color: #33413a;
  margin-bottom: 14rpx;
}
.wheel-rules__title::before {
  content: "";
  width: 6rpx;
  height: 22rpx;
  border-radius: 4rpx;
  background: linear-gradient(#07883b, #25b95a);
}
.wheel-rules__line {
  display: block;
  font-size: 20rpx;
  color: #667069;
  line-height: 1.9;
}
/* ---------- 结果弹窗 ---------- */
.wheel-mask {
  position: fixed;
  inset: 0;
  background: rgba(8, 30, 18, 0.5);
  /* 高于首页弹层容器（sheet z-80），保证结果弹窗盖在弹层之上 */
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wheel-pop {
  position: relative;
  width: 544rpx;
  background: #fff;
  border-radius: 40rpx;
  padding: 48rpx 36rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: wheel-pop-in 0.28s cubic-bezier(0.34, 1.4, 0.64, 1);
}
@keyframes wheel-pop-in {
  from {
    transform: scale(0.86);
    opacity: 0;
  }
}
.wheel-pop__ribbon {
  position: absolute;
  top: -32rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 316rpx;
  height: 64rpx;
  line-height: 64rpx;
  background: linear-gradient(120deg, #ff8a3d, #ff5a1f);
  color: #fff;
  font-size: 26rpx;
  font-weight: 900;
  border-radius: 999rpx;
  box-shadow: 0 12rpx 32rpx rgba(255, 90, 31, 0.45);
}
.wheel-pop--green .wheel-pop__ribbon {
  background: linear-gradient(120deg, #25b95a, #07883b);
  box-shadow: 0 12rpx 32rpx rgba(7, 136, 59, 0.45);
}
.wheel-coupon {
  margin: 24rpx 0 4rpx;
  width: 400rpx;
  min-height: 130rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eaf8e8, #f6fdf5);
  border: 2rpx dashed #25b95a;
  border-radius: 24rpx;
}
.wheel-coupon__label {
  font-size: 34rpx;
  font-weight: 900;
  color: #07883b;
}
.wheel-pop__img {
  width: 320rpx;
  margin-top: 20rpx;
  border-radius: 24rpx;
  background: #fff1e6;
}
.wheel-pop__biz {
  font-size: 26rpx;
  font-weight: 800;
  color: #33413a;
  margin-top: 18rpx;
}
.wheel-pop__desc {
  font-size: 22rpx;
  color: #667069;
  line-height: 1.7;
  margin-top: 16rpx;
  white-space: pre-line;
}
.wheel-pop__hint {
  font-size: 18rpx;
  color: #9aa5a0;
  margin-top: 12rpx;
}
.wheel-pop__btns {
  display: flex;
  gap: 16rpx;
  margin-top: 30rpx;
  width: 100%;
}
.wheel-btn {
  flex: 1;
  height: 76rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wheel-btn--ghost {
  background: #f0f6f1;
  color: #33413a;
  border: 1rpx solid #e3ebe5;
}
.wheel-btn--solid {
  background: linear-gradient(120deg, #07883b, #25b95a);
  color: #fff;
  box-shadow: 0 8rpx 20rpx rgba(7, 136, 59, 0.3);
}
</style>
