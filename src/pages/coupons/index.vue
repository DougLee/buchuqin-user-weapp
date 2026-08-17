<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { fenToYuan } from "../../utils/money";
import type { Coupon, UserCoupon, UserCouponStatus } from "../../types";
const claimable = ref<Coupon[]>([]),
  mine = ref<UserCoupon[]>([]),
  claiming = ref("");
const statusLabels: Record<UserCouponStatus, string> = {
  claimed: "未使用",
  locked: "下单锁定",
  used: "已使用",
  released: "已退回",
};
onShow(async () => {
  const bundle = await api.coupons();
  claimable.value = bundle.claimable;
  mine.value = bundle.mine;
});
async function claim(coupon: Coupon) {
  if (claiming.value) return;
  claiming.value = coupon.id;
  try {
    const userCoupon = await api.claimCoupon(coupon.id);
    claimable.value = claimable.value.filter((item) => item.id !== coupon.id);
    mine.value = [userCoupon, ...mine.value];
    uni.showToast({ title: "领取成功", icon: "success" });
  } finally {
    claiming.value = "";
  }
}
</script>
<template>
  <view class="page"
    ><template v-if="claimable.length"
      ><view class="section-title"
        ><text class="section-title__main">可以领的券</text></view
      ><view class="coupon card" v-for="c in claimable" :key="c.id"
        ><view class="coupon__money"
          ><text class="symbol">¥</text
          ><text>{{ fenToYuan(c.amount) }}</text></view
        ><view class="coupon__body"
          ><text class="coupon__name">{{ c.name }}</text
          ><text class="muted">满 {{ fenToYuan(c.threshold) }} 元可用</text
          ><text class="coupon__date"
          >有效期至 {{ c.expiresAt.slice(0, 10) }}</text
          ></view
        ><button
          :disabled="claiming === c.id"
          @tap="claim(c)"
        >
          {{ claiming === c.id ? "领取中…" : "领取" }}
        </button></view
      ></template
    ><view class="section-title"
      ><text class="section-title__main">我的优惠券</text></view
    ><view v-if="mine.length"
      ><view class="coupon card" v-for="c in mine" :key="c.id"
        ><view class="coupon__money"
          ><text class="symbol">¥</text
          ><text>{{ fenToYuan(c.coupon.amount) }}</text></view
        ><view class="coupon__body"
          ><view class="coupon__name-row"
            ><text class="coupon__name">{{ c.coupon.name }}</text
            ><text class="coupon__status" :class="`coupon__status--${c.status}`"
              >{{ statusLabels[c.status] }}</text
            ></view
          ><text class="muted"
          >满 {{ fenToYuan(c.coupon.threshold) }} 元可用</text
          ><text class="coupon__date"
          >有效期至 {{ c.coupon.expiresAt.slice(0, 10) }}</text
          ></view
        ><button
          v-if="c.status === 'claimed' || c.status === 'released'"
          @tap="uni.switchTab({ url: '/pages/index/index' })"
        >
          去使用
        </button></view
      ></view
    ><view v-else class="empty card"
      ><text>还没有优惠券，先去上面领一张吧</text></view
    ><view class="rules"
      ><text class="rules__title">使用说明</text
      ><text>· 每笔订单最多使用一张优惠券</text
      ><text>· 优惠券仅限湖北工业大学校园仓商品</text
      ><text>· 退款是否返券以活动规则为准</text></view
    ></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.coupon {
  display: grid;
  grid-template-columns: 150rpx 1fr auto;
  align-items: center;
  min-height: 190rpx;
  margin-bottom: 22rpx;
  overflow: hidden;
  border: 2rpx solid rgba(37, 185, 90, 0.12);
}
.coupon__money {
  height: 100%;
  background: linear-gradient(135deg, $primary, $primary-dark);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 64rpx;
  font-weight: 900;
}
.symbol {
  font-size: 24rpx;
  margin-top: 20rpx;
}
.coupon__body {
  padding: 22rpx;
}
.coupon__name,
.coupon__date {
  display: block;
}
.coupon__name {
  font-size: 30rpx;
  font-weight: 900;
  margin-bottom: 8rpx;
}
.coupon__name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.coupon__status {
  font-size: 19rpx;
  font-weight: 800;
  padding: 4rpx 12rpx;
  border-radius: 18rpx;
  background: $primary-soft;
  color: $primary-dark;
}
.coupon__status--locked {
  background: $cream;
  color: $orange;
}
.coupon__status--used {
  background: $line;
  color: $muted;
}
.coupon__date {
  font-size: 20rpx;
  color: #667069;
  margin-top: 18rpx;
}
.coupon button {
  min-height: 68rpx;
  margin-right: 20rpx;
  background: $primary-soft;
  color: $primary-dark;
  border: 2rpx solid $primary;
  border-radius: 34rpx;
  font-size: 22rpx;
  font-weight: 800;
}
.empty {
  padding: 60rpx 30rpx;
  text-align: center;
  color: #667069;
  font-size: 25rpx;
}
.rules {
  margin-top: 42rpx;
  padding: 26rpx;
  background: #fff;
  border-radius: 24rpx;
  color: #667069;
  font-size: 24rpx;
  line-height: 1.9;
}
.rules text {
  display: block;
}
.rules__title {
  color: $ink;
  font-size: 30rpx;
  font-weight: 900;
  margin-bottom: 10rpx;
}
</style>
