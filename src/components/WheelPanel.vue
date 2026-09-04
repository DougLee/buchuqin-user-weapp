<script setup lang="ts">
/**
 * 抽奖转盘面板（IKD6FB / IKDB7W / IKDBY2）：转盘+次数+规则+结果弹窗的公共组件。
 * 首页弹层与 pages/wheel 独立页（分享落地）共用，抽奖逻辑只此一份。
 * 8 奖位权重随机（概率只在服务端），每日 1 次按北京时间自然日；
 * 平台券自动入账、异业券弹图文、券发完服务端自动降级谢谢参与。
 * 视觉：翡翠金高奢风（IKDBY2 参考图）——深翡翠绿底/金环灯串/白金扇区/
 * 金色菱形宝石指针/绿玉按钮/玻璃台座。
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
  /** 数据拉取完成：宿主（弹层头/独立页头）用它更新剩余次数胶囊文案 */
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
          :class="{ 'wheel-lights__bulb--gold': n % 2 === 0 }"
          :style="{ transform: `rotate(${n * 22.5}deg) translateY(-234rpx)` }"
        />
      </view>
      <view
        class="wheel-disc"
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
            // 扇区中心在 i*45+22.5（边界是 i*45）；压线会让指针指向不明确（IKDBPX）
            transform: `translate(-50%,-50%) rotate(${i * 45 + 22.5}deg) translateY(-165rpx) rotate(${-(i * 45 + 22.5)}deg)`,
          }"
        >
          <text class="wheel-disc__name">{{ p.label }}</text>
          <text v-if="p.type === 'coupon'" class="wheel-disc__tag">平台券</text>
          <text v-else-if="p.type === 'partner'" class="wheel-disc__tag"
            >异业券</text
          >

        </view>
      </view>
      <!-- 金色菱形宝石指针（两三角+横钉）与绿玉中心按钮 -->
      <view class="wheel-pointer">
        <view class="wheel-pointer__gem" />
        <view class="wheel-pointer__pin" />
      </view>
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
          !active ? "敬请期待" : drawnToday ? "明日 0 点重置" : "今日第 1 次"
        }}</text>
      </view>
    </view>
    <!-- 次数条：半透明玻璃胶囊 -->
    <view class="wheel-chance">
      <view v-if="!active" class="wheel-chance__pill">活动暂未开启，敬请期待</view>
      <view v-else-if="drawnToday" class="wheel-chance__pill"
        >今日机会已用完，明天 0 点再来</view
      >
      <view v-else class="wheel-chance__pill">
        <text>今日剩余抽奖次数：</text><text class="hot">1</text>
        <text> 次</text>
      </view>
    </view>
    <!-- 规则卡：半透明玻璃 + 皇冠图标 + 绿数字圆点 -->
    <view class="wheel-rules">
      <view class="wheel-rules__title">
        <view class="wheel-rules__crown"><text>♛</text></view>
        <text>活动规则</text>
      </view>
      <view class="wheel-rules__line">
        <text class="wheel-rules__num">1</text>
        <text class="wheel-rules__text">每位用户每日可抽奖 1 次，次日 0 点重新计算；</text>
      </view>
      <view class="wheel-rules__line">
        <text class="wheel-rules__num">2</text>
        <text class="wheel-rules__text">平台优惠券抽中后自动发放至「我的 - 优惠券」；</text>
      </view>
      <view class="wheel-rules__line">
        <text class="wheel-rules__num">3</text>
        <text class="wheel-rules__text">异业合作福利抽中后展示图文，请长按识别二维码领取；</text>
      </view>
      <view class="wheel-rules__line">
        <text class="wheel-rules__num">4</text>
        <text class="wheel-rules__text">奖品随机发放，与历史抽奖结果无关。</text>
      </view>
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
          <view class="wheel-pop__star" />
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
/* ===== 翡翠金高奢风（IKDBY2）：翡翠 #0C4A2E / 金 #C9A227 / 奶白扇区 ===== */
.wp-loading {
  text-align: center;
  color: #f1de9a;
  font-size: 24rpx;
  padding: 80rpx 0;
}
/* ---------- 转盘 ---------- */
.wheel-stage {
  position: relative;
  width: 520rpx;
  height: 520rpx;
  margin: 0 auto;
}
/* 灯串：白金灯泡交替落在金环上 */
.wheel-lights {
  position: absolute;
  inset: 0;
}
.wheel-lights__bulb {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14rpx;
  height: 14rpx;
  margin: -7rpx 0 0 -7rpx;
  border-radius: 50%;
  background: #fffdf2;
  box-shadow: 0 0 14rpx 5rpx rgba(255, 250, 220, 0.9);
}
.wheel-lights__bulb--gold {
  background: #f5dfa0;
  box-shadow: 0 0 10rpx 3rpx rgba(230, 200, 120, 0.7);
}
/* 扇区：白/奶白交替 + 鎏金环 */
.wheel-disc {
  position: absolute;
  inset: 20rpx;
  border-radius: 50%;
  /* conic 从正上方顺时针，与奖位序号一致 */
  background: conic-gradient(
    #fbfdf8 0 45deg, #edf4e9 45deg 90deg,
    #fbfdf8 90deg 135deg, #edf4e9 135deg 180deg,
    #fbfdf8 180deg 225deg, #edf4e9 225deg 270deg,
    #fbfdf8 270deg 315deg, #edf4e9 315deg 360deg
  );
  border: 16rpx solid #c9a227;
  box-shadow:
    0 0 0 5rpx #f1de9a,
    0 18rpx 50rpx rgba(3, 40, 22, 0.55),
    inset 0 0 0 5rpx rgba(201, 162, 39, 0.25);
  position: absolute;
  transition: transform 4.2s cubic-bezier(0.16, 0.84, 0.28, 1);
}
/* 扇区分隔线：8 道金细丝（IKDC7Y 高阶简洁——去掉票券/星形装饰后靠金线撑结构感） */
.wheel-disc::after {
  content: "";
  position: absolute;
  inset: 16rpx;
  border-radius: 50%;
  background: repeating-conic-gradient(
    rgba(201, 162, 39, 0.45) 0deg 0.8deg,
    transparent 0.8deg 45deg
  );
  -webkit-mask: radial-gradient(circle, transparent 30%, #000 31%);
  mask: radial-gradient(circle, transparent 30%, #000 31%);
}
.wheel-disc__label {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  white-space: nowrap;
}
.wheel-disc__name {
  font-size: 26rpx;
  font-weight: 900;
  color: #1f6b3c;
  letter-spacing: 1rpx;
}
.wheel-disc__tag {
  font-size: 15rpx;
  font-weight: 600;
  letter-spacing: 3rpx;
  color: #6fae85;
  margin-top: 4rpx;
}
.wheel-disc__label--partner .wheel-disc__name {
  color: #b9862f;
}
.wheel-disc__label--partner .wheel-disc__tag {
  color: #cfa050;
}
.wheel-disc__label--none .wheel-disc__name {
  color: #9aa894;
}
/* 扇区装饰：平台券=金票券 / 异业券=金亮星 / 谢谢参与=淡绿星 */
/* 金色菱形宝石指针：上/下三角 + 中心横钉 */
.wheel-pointer {
  position: absolute;
  left: 50%;
  top: -10rpx;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.wheel-pointer__gem {
  width: 44rpx;
  height: 44rpx;
  background: linear-gradient(135deg, #f7e9b8 0%, #e6cf8f 50%, #b98f2a 100%);
  transform: rotate(45deg);
  border: 3rpx solid #f7e9b8;
  box-shadow: 0 4rpx 12rpx rgba(150, 120, 30, 0.55);
}
.wheel-pointer__pin {
  width: 0;
  height: 0;
  border-left: 14rpx solid transparent;
  border-right: 14rpx solid transparent;
  border-top: 30rpx solid #c9a227;
  margin-top: -8rpx;
  filter: drop-shadow(0 4rpx 6rpx rgba(60, 45, 5, 0.4));
}
/* 玻璃台座：转盘下方椭圆金边底座 */
/* 中心按钮：翡翠绿玉盘 + 金环描边 */
.wheel-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 184rpx;
  height: 184rpx;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fdf6da;
  background: radial-gradient(circle at 32% 26%, #3ba05f, #157a3e 55%, #0c5228);
  border: 7rpx solid #e6cf8f;
  box-shadow:
    0 0 0 4rpx #c9a227,
    0 16rpx 36rpx rgba(3, 40, 22, 0.6),
    inset 0 -10rpx 16rpx rgba(5, 40, 20, 0.5),
    inset 0 6rpx 10rpx rgba(255, 255, 255, 0.3);
  z-index: 2;
}
.wheel-hub--pressing {
  box-shadow:
    0 0 0 4rpx #c9a227,
    0 6rpx 16rpx rgba(3, 40, 22, 0.6),
    inset 0 4rpx 16rpx rgba(5, 40, 20, 0.6);
}
.wheel-hub--disabled {
  background: radial-gradient(circle at 32% 26%, #6f8f7d, #4d6b5a 60%, #3a5346);
}
.wheel-hub__main {
  font-size: 44rpx;
  font-weight: 900;
  letter-spacing: 6rpx;
  text-shadow: 0 3rpx 8rpx rgba(5, 40, 20, 0.7);
}
.wheel-hub__sub {
  font-size: 16rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
  color: rgba(253, 246, 218, 0.92);
  margin-top: 6rpx;
}
/* ---------- 次数条：半透明玻璃胶囊 ---------- */
.wheel-chance {
  display: flex;
  justify-content: center;
  margin-top: 52rpx;
}
.wheel-chance__pill {
  display: inline-flex;
  align-items: baseline;
  background: rgba(255, 255, 255, 0.18);
  border: 2rpx solid rgba(241, 222, 154, 0.5);
  color: #fdf6da;
  font-size: 24rpx;
  font-weight: 800;
  padding: 10rpx 30rpx;
  border-radius: 999rpx;
}
.wheel-chance__pill .hot {
  color: #f1de9a;
  font-size: 32rpx;
  font-weight: 900;
  margin: 0 4rpx;
}
/* ---------- 规则卡：半透明玻璃 + 皇冠 + 绿数字圆点 ---------- */
.wheel-rules {
  margin: 20rpx 0 0;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 24rpx;
  padding: 20rpx 26rpx 6rpx;
  border: 1rpx solid rgba(241, 222, 154, 0.55);
}
.wheel-rules__title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 26rpx;
  font-weight: 900;
  color: #155232;
  margin-bottom: 4rpx;
}
.wheel-rules__crown {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #1a8a4c, #0c5228);
  border: 3rpx solid #e6cf8f;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wheel-rules__crown text {
  color: #f1de9a;
  font-size: 22rpx;
  margin-top: -2rpx;
}
.wheel-rules__line {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 10rpx 0;
  border-bottom: 2rpx dashed #e2ecdc;
}
.wheel-rules__line:last-child {
  border-bottom: none;
}
.wheel-rules__num {
  flex-shrink: 0;
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #2f9a55, #157a3e);
  color: #fdf6da;
  font-size: 18rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2rpx;
}
.wheel-rules__text {
  flex: 1;
  font-size: 20rpx;
  color: #4a6554;
  line-height: 1.6;
}
/* ---------- 结果弹窗 ---------- */
.wheel-mask {
  position: fixed;
  inset: 0;
  background: rgba(3, 40, 22, 0.6);
  /* 高于首页弹层容器（sheet z-80），保证结果弹窗盖在弹层之上 */
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wheel-pop {
  position: relative;
  width: 544rpx;
  background: linear-gradient(180deg, #fdfbf0, #f6f1de);
  border: 2rpx solid rgba(201, 162, 39, 0.4);
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
  background: linear-gradient(120deg, #d4b75a, #b98f2a);
  color: #fdf6da;
  font-size: 26rpx;
  font-weight: 900;
  border-radius: 999rpx;
  box-shadow: 0 12rpx 32rpx rgba(150, 120, 30, 0.45);
}
.wheel-pop--green .wheel-pop__ribbon {
  background: linear-gradient(120deg, #2f9a55, #157a3e);
  box-shadow: 0 12rpx 32rpx rgba(12, 82, 40, 0.45);
}
.wheel-coupon {
  margin: 24rpx 0 4rpx;
  width: 400rpx;
  min-height: 130rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e9f4e6, #f6fbf3);
  border: 2rpx dashed #2f9a55;
  border-radius: 24rpx;
}
.wheel-coupon__label {
  font-size: 34rpx;
  font-weight: 900;
  color: #157a3e;
}
.wheel-pop__star {
  margin-top: 28rpx;
  width: 88rpx;
  height: 88rpx;
  background: #f1de9a;
  clip-path: polygon(
    50% 0%, 63% 34%, 98% 35%, 71% 57%, 81% 91%,
    50% 70%, 19% 91%, 29% 57%, 2% 35%, 37% 34%
  );
}
.wheel-pop__img {
  width: 320rpx;
  margin-top: 20rpx;
  border-radius: 24rpx;
  background: #f2efe0;
}
.wheel-pop__biz {
  font-size: 26rpx;
  font-weight: 800;
  color: #155232;
  margin-top: 18rpx;
}
.wheel-pop__desc {
  font-size: 22rpx;
  color: #5d6f5f;
  line-height: 1.7;
  margin-top: 16rpx;
  white-space: pre-line;
}
.wheel-pop__hint {
  font-size: 18rpx;
  color: #9aa894;
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
  background: #eef3e7;
  color: #155232;
  border: 1rpx solid #dfe8d2;
}
.wheel-btn--solid {
  background: linear-gradient(120deg, #2f9a55, #157a3e);
  color: #fdf6da;
  box-shadow: 0 8rpx 20rpx rgba(21, 122, 62, 0.35);
}
</style>
