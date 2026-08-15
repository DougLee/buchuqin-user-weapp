<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
const coupons = ref<any[]>([]);
onShow(async () => {
  coupons.value = await api.coupons();
});
</script>
<template>
  <view class="page"
    ><view class="coupon card" v-for="c in coupons" :key="c.id"
      ><view class="coupon__money"
        ><text class="symbol">¥</text><text>{{ c.amount }}</text></view
      ><view class="coupon__body"
        ><text class="coupon__name">{{ c.name }}</text
        ><text class="muted">满 {{ c.threshold }} 元可用</text
        ><text class="coupon__date"
          >有效期至 {{ c.expiresAt.slice(0, 10) }}</text
        ></view
      ><button @tap="uni.switchTab({ url: '/pages/index/index' })">
        去使用
      </button></view
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
