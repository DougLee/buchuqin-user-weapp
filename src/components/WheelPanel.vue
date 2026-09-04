<script setup lang="ts">
/**
 * 抽奖转盘面板（IKD6FB / IKDB7W / IKDBJN）：转盘+次数+规则+结果弹窗的公共组件。
 * 首页弹层与 pages/wheel 独立页（分享落地）共用，抽奖逻辑只此一份。
 * 8 奖位权重随机（概率只在服务端），每日 1 次按北京时间自然日；
 * 平台券自动入账、异业券弹图文、券发完服务端自动降级谢谢参与。
 * 视觉：节庆橙风（IKDBJN 参考图）——橙环灯串转盘/红色大按钮/奶油扇区。
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
          :style="{ transform: `rotate(${n * 22.5}deg) translateY(-206rpx)` }"
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
            transform: `translate(-50%,-50%) rotate(${i * 45 + 22.5}deg) translateY(-148rpx) rotate(${-(i * 45 + 22.5)}deg)`,
          }"
        >
          <text class="wheel-disc__name">{{ p.label }}</text>
          <text v-if="p.type === 'coupon'" class="wheel-disc__tag">平台券</text>
          <text v-else-if="p.type === 'partner'" class="wheel-disc__tag"
            >异业券</text
          >
          <!-- 扇区装饰（IKDBJN 参考图）：平台券=票券 / 异业券·谢谢参与=星形，纯 CSS -->
          <view v-if="p.type === 'coupon'" class="deco-ticket">
            <text>¥</text>
          </view>
          <view
            v-else
            class="deco-star"
            :class="{ 'deco-star--dim': p.type === 'none' }"
          />
        </view>
      </view>
      <!-- 指针（红色定位针：圆头+黄星+下三角）与中心大按钮 -->
      <view class="wheel-pointer">
        <view class="wheel-pointer__pin"><text>✦</text></view>
        <view class="wheel-pointer__tail" />
      </view>
      <!-- 奶油锯齿花边：独立元素垫在按钮下（::before z-index:-1 会盖住按钮底色） -->
      <view class="wheel-hub__gear" />
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
        <view class="wheel-hub__pill">{{
          !active ? "敬请期待" : drawnToday ? "明日 0 点重置" : "今日第 1 次"
        }}</view>
      </view>
    </view>
    <!-- 底部次数条：白胶囊（参考图形态），数字橙色放大 -->
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
    <view class="wheel-rules">
      <view class="wheel-rules__title"><text>活动规则</text></view>
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
          <view class="deco-star deco-star--pop" />
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
/* ===== 节庆橙风（IKDBJN）：橙 #FF8A00 / 奶油 #FFF6E8 / 棕 #8B4A0F / 红 CTA ===== */
.wp-loading {
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
  font-size: 24rpx;
  padding: 80rpx 0;
}
/* ---------- 转盘 ---------- */
.wheel-stage {
  position: relative;
  width: 460rpx;
  height: 460rpx;
  margin: 0 auto;
}
/* 灯串：白灯落在橙色外环上 */
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
  background: #fff;
  box-shadow: 0 0 14rpx 5rpx rgba(255, 255, 255, 0.9);
}
.wheel-lights__bulb--dim {
  background: #ffe3b8;
  box-shadow: none;
}
/* 扇区：白/奶油橙交替（对比拉开才看得出分割）+ 橙色厚环 */
.wheel-disc {
  position: absolute;
  inset: 20rpx;
  border-radius: 50%;
  /* conic 从正上方顺时针，与奖位序号一致 */
  background: conic-gradient(
    #fffdf7 0 45deg, #ffe7c4 45deg 90deg,
    #fffdf7 90deg 135deg, #ffe7c4 135deg 180deg,
    #fffdf7 180deg 225deg, #ffe7c4 225deg 270deg,
    #fffdf7 270deg 315deg, #ffe7c4 315deg 360deg
  );
  border: 16rpx solid #ff8a1e;
  box-shadow:
    0 16rpx 44rpx rgba(150, 62, 0, 0.35),
    inset 0 0 0 5rpx #fff6e4;
  transition: transform 4.2s cubic-bezier(0.16, 0.84, 0.28, 1);
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
  font-size: 21rpx;
  font-weight: 800;
  color: #8b4a0f;
}
.wheel-disc__tag {
  font-size: 16rpx;
  font-weight: 700;
  color: #3f9c5c;
  margin-top: 2rpx;
}
.wheel-disc__label--partner .wheel-disc__tag {
  color: #e0570f;
}
.wheel-disc__label--none .wheel-disc__name {
  color: #b99b78;
}
/* 扇区装饰：平台券票券 / 星形（尺寸随转盘 460 收缩） */
.deco-ticket {
  margin-top: 4rpx;
  width: 58rpx;
  height: 30rpx;
  border-radius: 7rpx;
  background: #ffd24d;
  border: 2rpx solid #eda93c;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.deco-ticket text {
  font-size: 18rpx;
  font-weight: 900;
  color: #a3641a;
}
/* 星形装饰：异业券亮星 / 谢谢参与淡星 */
.deco-star {
  margin-top: 6rpx;
  width: 34rpx;
  height: 34rpx;
  background: #ffd98e;
  clip-path: polygon(
    50% 0%, 63% 34%, 98% 35%, 71% 57%, 81% 91%,
    50% 70%, 19% 91%, 29% 57%, 2% 35%, 37% 34%
  );
}
.deco-star--dim {
  background: #e9dcc9;
}
/* 红色定位针指针：圆头（白边+黄星）+ 下三角 */
.wheel-pointer {
  position: absolute;
  left: 50%;
  top: -8rpx;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.wheel-pointer__pin {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 26%, #ff7a45, #ff3d1e 70%);
  border: 5rpx solid #fff;
  box-shadow: 0 6rpx 14rpx rgba(180, 40, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.wheel-pointer__pin text {
  color: #ffd24d;
  font-size: 24rpx;
  font-weight: 900;
}
.wheel-pointer__tail {
  width: 0;
  height: 0;
  border-left: 18rpx solid transparent;
  border-right: 18rpx solid transparent;
  border-top: 34rpx solid #ff3d1e;
  margin-top: -6rpx;
  filter: drop-shadow(0 4rpx 6rpx rgba(0, 0, 0, 0.18));
}
/* 中心按钮：红色 Claymorphism 大按钮 + 奶油锯齿花边底座 + 橙胶囊副签 */
.wheel-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 176rpx;
  height: 176rpx;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: radial-gradient(circle at 32% 26%, #ff8a4d, #ff4d2e 60%, #f03514);
  border: 8rpx solid #fff;
  box-shadow:
    0 16rpx 36rpx rgba(240, 53, 20, 0.45),
    inset 0 -10rpx 16rpx rgba(150, 25, 0, 0.35),
    inset 0 6rpx 10rpx rgba(255, 255, 255, 0.45);
  z-index: 2;
}
/* 锯齿花边：独立齿轮元素垫在按钮下（12 粗齿；负 z-index 伪元素会盖住按钮底色） */
.wheel-hub__gear {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 204rpx;
  height: 204rpx;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: repeating-conic-gradient(
    #ffe9c8 0deg 15deg,
    transparent 15deg 30deg
  );
  z-index: 1;
}
.wheel-hub--pressing {
  box-shadow:
    0 6rpx 16rpx rgba(240, 53, 20, 0.45),
    inset 0 4rpx 16rpx rgba(150, 25, 0, 0.45);
}
.wheel-hub--disabled {
  background: radial-gradient(circle at 32% 26%, #f2d9bd, #ddb48e 60%, #c9a684);
  box-shadow:
    0 8rpx 20rpx rgba(180, 130, 80, 0.3),
    inset 0 -8rpx 12rpx rgba(150, 105, 60, 0.25);
}
.wheel-hub__main {
  font-size: 44rpx;
  font-weight: 900;
  letter-spacing: 6rpx;
  text-shadow: 0 3rpx 8rpx rgba(150, 25, 0, 0.5);
}
.wheel-hub__pill {
  margin-top: 6rpx;
  background: #ff9d2e;
  color: #fff;
  font-size: 16rpx;
  font-weight: 800;
  padding: 2rpx 16rpx;
  border-radius: 999rpx;
}
/* ---------- 次数条：白胶囊（IKDBPX 压缩间距） ---------- */
.wheel-chance {
  display: flex;
  justify-content: center;
  margin-top: 20rpx;
}
.wheel-chance__pill {
  display: inline-flex;
  align-items: baseline;
  background: #fff;
  color: #8b4a0f;
  font-size: 24rpx;
  font-weight: 800;
  padding: 10rpx 30rpx;
  border-radius: 999rpx;
  box-shadow: 0 8rpx 24rpx rgba(150, 62, 0, 0.14);
}
.wheel-chance__pill .hot {
  color: #ff5a1f;
  font-size: 32rpx;
  font-weight: 900;
  margin: 0 4rpx;
}
/* ---------- 规则卡：数字圆点 + 虚线分隔 ---------- */
.wheel-rules {
  margin: 20rpx 0 0;
  background: #fff;
  border-radius: 24rpx;
  padding: 20rpx 26rpx 6rpx;
  border: 1rpx solid #ffe9cf;
}
.wheel-rules__title {
  font-size: 26rpx;
  font-weight: 900;
  color: #8b4a0f;
  margin-bottom: 4rpx;
  display: inline-block;
  position: relative;
  padding-bottom: 8rpx;
}
/* 标题黄色短杠（参考图手绘下划） */
.wheel-rules__title::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 8rpx;
  border-radius: 4rpx;
  background: #ffd24d;
}
.wheel-rules__line {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 10rpx 0;
  border-bottom: 2rpx dashed #f5e7d2;
}
.wheel-rules__line:last-child {
  border-bottom: none;
}
.wheel-rules__num {
  flex-shrink: 0;
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  background: #ff8a2e;
  color: #fff;
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
  color: #7a5c3d;
  line-height: 1.6;
}
/* ---------- 结果弹窗 ---------- */
.wheel-mask {
  position: fixed;
  inset: 0;
  background: rgba(80, 35, 0, 0.55);
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
  background: linear-gradient(135deg, #fff3dc, #fffaf0);
  border: 2rpx dashed #ff9d2e;
  border-radius: 24rpx;
}
.wheel-coupon__label {
  font-size: 34rpx;
  font-weight: 900;
  color: #c2570f;
}
.deco-star--pop {
  margin-top: 28rpx;
  width: 88rpx;
  height: 88rpx;
  background: #ffd98e;
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
  color: #5c3a1a;
  margin-top: 18rpx;
}
.wheel-pop__desc {
  font-size: 22rpx;
  color: #8b6b4a;
  line-height: 1.7;
  margin-top: 16rpx;
  white-space: pre-line;
}
.wheel-pop__hint {
  font-size: 18rpx;
  color: #c2a482;
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
  background: #fdf3e4;
  color: #8b4a0f;
  border: 1rpx solid #f5e3c8;
}
.wheel-btn--solid {
  background: linear-gradient(120deg, #ff8a2e, #ff5a1f);
  color: #fff;
  box-shadow: 0 8rpx 20rpx rgba(255, 90, 31, 0.35);
}
</style>
