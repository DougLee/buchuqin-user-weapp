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
  /** IKDCVO：partner 配券抽中发券入账时为 UserCoupon id */
  userCouponId?: string | null;
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
          :style="{ transform: `rotate(${n * 22.5}deg) translateY(-208rpx)` }"
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
            // 扇区中心在 i*45+22.5（边界是 i*45）；压线会让指针指向不明确（IKDBPX）。
            // 半径随盘径联动（IKDDHF 二轮：500rpx 盘 → 148rpx 文字半径）
            transform: `translate(-50%,-50%) rotate(${i * 45 + 22.5}deg) translateY(-148rpx) rotate(${-(i * 45 + 22.5)}deg)`,
          }"
        >
          <view v-if="p.type !== 'none'" class="wheel-disc__ticket"
            ><text class="wheel-disc__ticket-yuan">¥</text></view
          >
          <text class="wheel-disc__name">{{ p.label }}</text>
          <text v-if="p.type === 'coupon'" class="wheel-disc__tag">平台券</text>
          <text v-else-if="p.type === 'partner'" class="wheel-disc__tag"
            >异业券</text
          >
          <text v-else class="wheel-disc__tag">再接再厉</text>
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
          !active ? "未开启" : drawnToday ? "已抽" : "开始抽奖"
        }}</text>
        <text class="wheel-hub__sub">{{
          !active ? "敬请期待" : drawnToday ? "今日 0 点重置" : "今日第 1 次"
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
    <!-- 规则卡：米白底 + 红花徽章标题 + 红圆数字编号（IKDDHF 参考图） -->
    <view class="wheel-rules">
      <view class="wheel-rules__title">
        <text class="wheel-rules__flower">✿</text>
        <text>活动规则</text>
        <text class="wheel-rules__flower">✿</text>
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
        <text class="wheel-rules__text">异业合作福利抽中后按指引领取，到店出示即可使用。</text>
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
          <!-- IKDCVO：配了异业券抽中发券入账（bizImage 空展示券态）；
               存量无券配置仍走图文，长按可识别商家二维码 -->
          <view v-if="result.userCouponId" class="wheel-coupon wheel-coupon--partner">
            <text class="wheel-coupon__label">{{ result.bizTitle || result.label }}</text>
          </view>
          <image
            v-else
            class="wheel-pop__img"
            :src="result.bizImage"
            mode="widthFix"
            show-menu-by-longpress
          />
          <text v-if="!result.userCouponId" class="wheel-pop__biz">{{ result.bizTitle }}</text>
          <text v-if="result.bizNote" class="wheel-pop__desc">{{ result.bizNote }}</text>
          <text v-if="result.userCouponId" class="wheel-pop__desc">已存入「我的 - 优惠券」，到店出示即可</text>
          <text v-else class="wheel-pop__hint">长按图片可识别商家二维码</text>
          <view class="wheel-pop__btns">
            <view
              v-if="result.userCouponId"
              class="wheel-btn wheel-btn--ghost"
              @tap="goCoupons"
              >查看优惠券</view
            >
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
/* ===== 红金节庆风（IKDDHF）：朱红 #e6332a / 金 #e8b84a / 奶白扇区 ===== */
.wp-loading {
  text-align: center;
  color: #ffedbe;
  font-size: 24rpx;
  padding: 80rpx 0;
}
/* ---------- 转盘 ---------- */
.wheel-stage {
  position: relative;
  width: 500rpx;
  height: 500rpx;
  margin: 0 auto;
}
/* 灯串：金珠/白珠交替落在金环上 */
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
  background: #fff8e0;
  box-shadow: 0 0 16rpx 6rpx rgba(255, 236, 170, 0.9);
}
.wheel-lights__bulb--gold {
  background: #f5c860;
  box-shadow: 0 0 12rpx 4rpx rgba(245, 200, 96, 0.75);
}
/* 扇区：奶白底 + 金环描边（配红包金背景图） */
.wheel-disc {
  position: absolute;
  inset: 24rpx;
  border-radius: 50%;
  /* conic 从正上方顺时针，与奖位序号一致 */
  background: conic-gradient(
    #fffdf6 0 45deg, #fdf3de 45deg 90deg,
    #fffdf6 90deg 135deg, #fdf3de 135deg 180deg,
    #fffdf6 180deg 225deg, #fdf3de 225deg 270deg,
    #fffdf6 270deg 315deg, #fdf3de 315deg 360deg
  );
  border: 18rpx solid #e8b84a;
  box-shadow:
    0 0 0 6rpx #f7df9b,
    0 0 0 10rpx rgba(160, 26, 10, 0.85),
    0 20rpx 50rpx rgba(120, 15, 0, 0.55),
    inset 0 0 0 4rpx rgba(232, 184, 74, 0.35);
  position: absolute;
  transition: transform 4.2s cubic-bezier(0.16, 0.84, 0.28, 1);
}
/* 扇区分隔线：8 道金细丝 */
.wheel-disc::after {
  content: "";
  position: absolute;
  inset: 14rpx;
  border-radius: 50%;
  background: repeating-conic-gradient(
    rgba(180, 130, 40, 0.5) 0deg 0.8deg,
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
/* 扇区小红券图标（IKDDHF 参考图）：票面锯齿用径向点阵压出来 */
.wheel-disc__ticket {
  position: relative;
  width: 56rpx;
  height: 36rpx;
  margin-bottom: 6rpx;
  border-radius: 8rpx;
  background: linear-gradient(135deg, #f0524a, #d9261c);
  border: 2rpx solid #f5c860;
  box-shadow: 0 3rpx 8rpx rgba(160, 26, 10, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.wheel-disc__ticket::before,
.wheel-disc__ticket::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 10rpx;
  height: 10rpx;
  margin-top: -5rpx;
  border-radius: 50%;
  background: #fdf3de;
}
.wheel-disc__ticket::before {
  left: -5rpx;
}
.wheel-disc__ticket::after {
  right: -5rpx;
}
.wheel-disc__ticket-yuan {
  color: #f7df9b;
  font-size: 20rpx;
  font-weight: 900;
}
.wheel-disc__name {
  font-size: 26rpx;
  font-weight: 900;
  color: #a83b14;
  letter-spacing: 1rpx;
}
.wheel-disc__tag {
  font-size: 16rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
  color: #c98a4a;
  margin-top: 3rpx;
}
.wheel-disc__label--partner .wheel-disc__name {
  color: #b3621f;
}
.wheel-disc__label--none .wheel-disc__name {
  color: #b39a7d;
}
.wheel-disc__label--none .wheel-disc__tag {
  color: #cbb79c;
}
/* 指针：顶部红底金边菱形指向盘心（IKDDHF 参考图） */
.wheel-pointer {
  position: absolute;
  left: 50%;
  top: -14rpx;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.wheel-pointer__gem {
  width: 46rpx;
  height: 46rpx;
  background: linear-gradient(135deg, #f66a55 0%, #d9261c 55%, #a81408 100%);
  transform: rotate(45deg);
  border: 4rpx solid #f2cf6e;
  border-radius: 8rpx;
  box-shadow: 0 4rpx 12rpx rgba(120, 15, 0, 0.5);
}
.wheel-pointer__pin {
  width: 0;
  height: 0;
  border-left: 16rpx solid transparent;
  border-right: 16rpx solid transparent;
  border-top: 34rpx solid #d9261c;
  margin-top: -6rpx;
  filter: drop-shadow(0 4rpx 6rpx rgba(60, 10, 0, 0.45));
}
/* 中心按钮：红色大圆 + 金环描边（IKDDHF 参考图「开始抽奖/已抽」） */
.wheel-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 196rpx;
  height: 196rpx;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff3cf;
  background: radial-gradient(circle at 34% 26%, #f66a55, #d9261c 55%, #a81408);
  border: 8rpx solid #f2cf6e;
  box-shadow:
    0 0 0 4rpx rgba(160, 26, 10, 0.9),
    0 16rpx 36rpx rgba(120, 15, 0, 0.55),
    inset 0 -10rpx 18rpx rgba(120, 10, 0, 0.5),
    inset 0 8rpx 12rpx rgba(255, 220, 180, 0.35);
  z-index: 2;
}
.wheel-hub--pressing {
  box-shadow:
    0 0 0 4rpx rgba(160, 26, 10, 0.9),
    0 6rpx 16rpx rgba(120, 15, 0, 0.55),
    inset 0 4rpx 18rpx rgba(120, 10, 0, 0.6);
}
.wheel-hub--disabled {
  background: radial-gradient(circle at 34% 26%, #b98f74, #8f6247 60%, #6f4832);
}
.wheel-hub__main {
  font-size: 34rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
  text-shadow: 0 3rpx 8rpx rgba(120, 10, 0, 0.7);
  text-align: center;
}
.wheel-hub__sub {
  font-size: 16rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: rgba(255, 243, 207, 0.95);
  margin-top: 8rpx;
}
/* ---------- 次数条：金边深红胶囊 ---------- */
.wheel-chance {
  display: flex;
  justify-content: center;
  margin-top: 28rpx;
}
.wheel-chance__pill {
  display: inline-flex;
  align-items: baseline;
  background: rgba(150, 20, 8, 0.55);
  border: 2rpx solid rgba(242, 207, 110, 0.7);
  color: #ffedbe;
  font-size: 24rpx;
  font-weight: 800;
  padding: 10rpx 30rpx;
  border-radius: 999rpx;
}
.wheel-chance__pill .hot {
  color: #ffd97a;
  font-size: 32rpx;
  font-weight: 900;
  margin: 0 4rpx;
}
/* ---------- 规则卡：米白底 + 红花徽章标题 + 红圆数字编号 ---------- */
.wheel-rules {
  margin: 16rpx 0 0;
  background: #fdf6e4;
  border-radius: 24rpx;
  padding: 16rpx 26rpx 4rpx;
  border: 2rpx solid #f2cf6e;
  box-shadow: 0 10rpx 30rpx rgba(120, 15, 0, 0.3);
}
.wheel-rules__title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  font-size: 28rpx;
  font-weight: 900;
  color: #b3231b;
  margin-bottom: 6rpx;
  letter-spacing: 4rpx;
}
.wheel-rules__flower {
  color: #d9261c;
  font-size: 24rpx;
}
.wheel-rules__line {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 10rpx 0;
  border-bottom: 2rpx dashed #ead9b4;
}
.wheel-rules__line:last-child {
  border-bottom: none;
}
.wheel-rules__num {
  flex-shrink: 0;
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f0524a, #b3231b);
  color: #fff3cf;
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
  color: #7c4a2d;
  line-height: 1.6;
}
/* ---------- 结果弹窗 ---------- */
.wheel-mask {
  position: fixed;
  inset: 0;
  background: rgba(70, 10, 0, 0.6);
  /* 高于首页弹层容器（sheet z-80），保证结果弹窗盖在弹层之上 */
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wheel-pop {
  position: relative;
  width: 544rpx;
  background: linear-gradient(180deg, #fdfbf0, #f8efdc);
  border: 2rpx solid rgba(200, 60, 30, 0.35);
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
  background: linear-gradient(120deg, #f0524a, #b3231b);
  color: #fff3cf;
  font-size: 26rpx;
  font-weight: 900;
  border-radius: 999rpx;
  box-shadow: 0 12rpx 32rpx rgba(140, 20, 5, 0.45);
}
.wheel-pop--green .wheel-pop__ribbon {
  background: linear-gradient(120deg, #d9a62e, #b3231b);
  box-shadow: 0 12rpx 32rpx rgba(140, 20, 5, 0.4);
}
.wheel-coupon {
  margin: 24rpx 0 4rpx;
  width: 400rpx;
  min-height: 130rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fdeeee, #fdf8f0);
  border: 2rpx dashed #d9261c;
  border-radius: 24rpx;
}
.wheel-coupon__label {
  font-size: 34rpx;
  font-weight: 900;
  color: #b3231b;
}
/* IKDCVO：异业券票面金调（与金额券红票区分） */
.wheel-coupon--partner {
  background: linear-gradient(135deg, #faf3df, #fdfaf1);
  border-color: #c9a227;
}
.wheel-coupon--partner .wheel-coupon__label {
  color: #8a6d1a;
}
.wheel-pop__star {
  margin-top: 28rpx;
  width: 88rpx;
  height: 88rpx;
  background: #f2cf6e;
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
  color: #b3621f;
  margin-top: 18rpx;
}
.wheel-pop__desc {
  font-size: 22rpx;
  color: #7c5a3a;
  line-height: 1.7;
  margin-top: 16rpx;
  white-space: pre-line;
}
.wheel-pop__hint {
  font-size: 18rpx;
  color: #b39a7d;
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
  background: #fdf6e4;
  color: #b3231b;
  border: 1rpx solid #ead9b4;
}
.wheel-btn--solid {
  background: linear-gradient(120deg, #f0524a, #b3231b);
  color: #fff3cf;
  box-shadow: 0 8rpx 20rpx rgba(179, 35, 27, 0.4);
}
</style>
