<script setup lang="ts">
import { fenToYuan } from "../utils/money";
import type { UserCoupon } from "../types";

/**
 * 新人礼包弹窗（IKDETO）：注册当次弹一次（storage 防重由调用方控制）。
 * 营销导向红金礼包风——与抽奖弹层同一视觉语言；面额实拉（coupons 过滤
 * trigger=signup 未使用），单券面额大字、多券迷你券条。
 */
defineProps<{ coupons: UserCoupon[] }>();
const emit = defineEmits<{ use: []; close: [] }>();
/** 面额展示：整数元去掉小数（¥1 而非 ¥1.00） */
function yuan(c: UserCoupon) {
  return Number(fenToYuan(c.coupon.amount));
}
</script>
<template>
  <view class="gift-mask" @tap="emit('close')"
    ><view class="gift" @tap.stop
      ><!-- CSS 礼盒：盒盖 + 十字缎带 -->
      <view class="gift__box"
        ><view class="gift__lid"></view><view class="gift__ribbon-v"></view
        ><view class="gift__ribbon-h"></view
      ></view>
      <text class="gift__title">新人专享礼</text>
      <text class="gift__sub">{{
        coupons.length > 1
          ? `新人礼包 · ${coupons.length} 张券已到账`
          : "见面礼已到账"
      }}</text
      ><!-- 单券：面额大字；多券：迷你券条列表 -->
      <view v-if="coupons.length === 1" class="gift__hero"
        ><text class="gift__amount"
          ><text class="gift__unit">¥</text>{{ yuan(coupons[0]) }}</text
        ><text class="gift__tag">{{
          coupons[0].coupon.threshold > 0
            ? `满 ${Number(fenToYuan(coupons[0].coupon.threshold))} 元可用`
            : "无门槛"
        }}</text
        ><text class="gift__name">{{ coupons[0].coupon.name }}</text>
      </view>
      <view v-else class="gift__list"
        ><view v-for="c in coupons" :key="c.id" class="gift__row"
          ><text class="gift__row-name">{{ c.coupon.name }}</text
          ><text class="gift__row-amount"
            >¥{{ yuan(c) }}<text class="gift__row-threshold">{{
              c.coupon.threshold > 0
                ? ` 满${Number(fenToYuan(c.coupon.threshold))}可用`
                : " 无门槛"
            }}</text></text
          ></view
        ></view
      >
      <text class="gift__note">已自动存入「我的 - 优惠券」</text>
      <view class="gift__btns"
        ><view class="gift__btn-ghost" @tap="emit('close')">先逛逛</view
        ><view class="gift__btn-solid" @tap="emit('use')">立即使用</view>
      </view>
      <view class="gift__close" @tap="emit('close')">✕</view>
    </view>
  </view>
</template>
<style lang="scss" scoped>
@import "../styles/theme.scss";
/* 红金礼包风（IKDETO）：与抽奖弹层同一语言——朱红渐变、金描边、奶白衬底 */
.gift-mask {
  position: fixed;
  inset: 0;
  background: rgba(60, 8, 0, 0.62);
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gift {
  position: relative;
  width: 580rpx;
  padding: 60rpx 40rpx 40rpx;
  box-sizing: border-box;
  border-radius: 32rpx;
  background: linear-gradient(165deg, #e63a17 0%, #d9261c 46%, #a81408 100%);
  border: 4rpx solid #f2cf6e;
  box-shadow:
    0 0 0 6rpx rgba(242, 207, 110, 0.35),
    0 24rpx 60rpx rgba(60, 10, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: gift-in 0.3s cubic-bezier(0.34, 1.4, 0.64, 1);
}
@keyframes gift-in {
  0% {
    transform: scale(0.86);
    opacity: 0;
  }
}
/* CSS 礼盒（emoji-free）：金色盒 + 红缎带 */
.gift__box {
  position: relative;
  width: 120rpx;
  height: 96rpx;
  margin-bottom: 26rpx;
  background: linear-gradient(160deg, #f7df9b, #e8b84a);
  border-radius: 10rpx;
  box-shadow: 0 8rpx 18rpx rgba(90, 15, 0, 0.45);
}
.gift__lid {
  position: absolute;
  left: -12rpx;
  right: -12rpx;
  top: -16rpx;
  height: 30rpx;
  background: linear-gradient(160deg, #ffe9b8, #f2cf6e);
  border-radius: 8rpx;
  box-shadow: 0 4rpx 10rpx rgba(90, 15, 0, 0.4);
}
.gift__ribbon-v {
  position: absolute;
  left: 50%;
  top: -16rpx;
  bottom: 0;
  width: 18rpx;
  margin-left: -9rpx;
  background: #d9261c;
  opacity: 0.85;
}
.gift__ribbon-h {
  position: absolute;
  left: 0;
  right: 0;
  top: 26rpx;
  height: 18rpx;
  background: #d9261c;
  opacity: 0.85;
}
.gift__title {
  font-size: 46rpx;
  font-weight: 900;
  letter-spacing: 6rpx;
  color: #fff3cf;
  text-shadow:
    0 2rpx 0 #a81408,
    0 0 24rpx rgba(255, 220, 150, 0.5);
}
.gift__sub {
  margin-top: 10rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: #ffedbe;
  letter-spacing: 2rpx;
}
/* 单券面额大字 */
.gift__hero {
  width: 100%;
  margin: 34rpx 0 6rpx;
  padding: 30rpx 0 26rpx;
  border-radius: 20rpx;
  background: linear-gradient(150deg, #fdf6e4, #f8efdc);
  border: 2rpx solid #f2cf6e;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.gift__amount {
  font-size: 96rpx;
  font-weight: 900;
  color: #d9261c;
  line-height: 1;
}
.gift__unit {
  font-size: 44rpx;
  margin-right: 6rpx;
}
.gift__tag {
  margin-top: 14rpx;
  padding: 4rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(217, 38, 28, 0.08);
  border: 2rpx solid rgba(217, 38, 28, 0.3);
  color: #b3231b;
  font-size: 22rpx;
  font-weight: 800;
}
.gift__name {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #7c4a2d;
  font-weight: 700;
}
/* 多券迷你券条 */
.gift__list {
  width: 100%;
  margin: 30rpx 0 6rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.gift__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 24rpx;
  border-radius: 14rpx;
  background: linear-gradient(150deg, #fdf6e4, #f8efdc);
  border: 2rpx solid #f2cf6e;
}
.gift__row-name {
  font-size: 26rpx;
  font-weight: 800;
  color: #7c4a2d;
}
.gift__row-amount {
  font-size: 32rpx;
  font-weight: 900;
  color: #d9261c;
}
.gift__row-threshold {
  font-size: 20rpx;
  font-weight: 700;
  color: #c98a4a;
}
.gift__note {
  margin-top: 22rpx;
  font-size: 22rpx;
  color: rgba(255, 237, 190, 0.85);
}
.gift__btns {
  display: flex;
  gap: 20rpx;
  width: 100%;
  margin-top: 34rpx;
}
.gift__btn-ghost {
  flex: 1;
  min-height: 84rpx;
  border-radius: 20rpx;
  border: 2rpx solid rgba(242, 207, 110, 0.75);
  color: #ffedbe;
  font-size: 28rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gift__btn-solid {
  flex: 1.4;
  min-height: 84rpx;
  border-radius: 20rpx;
  background: linear-gradient(150deg, #ffe9b8, #e8b84a);
  color: #a81408;
  font-size: 30rpx;
  font-weight: 900;
  box-shadow: 0 8rpx 20rpx rgba(120, 80, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.gift__close {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(242, 207, 110, 0.7);
  color: #ffedbe;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
