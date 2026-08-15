<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useSessionStore } from "../../stores/session";
import type { Address } from "../../types";
const session = useSessionStore(),
  addresses = ref<Address[]>([]),
  usableCouponCount = ref(0),
  unread = ref(0);
const defaultAddress = computed(
  () => addresses.value.find((item) => item.isDefault) || addresses.value[0],
);
const roomSummary = computed(() =>
  defaultAddress.value
    ? `${defaultAddress.value.buildingName} · ${defaultAddress.value.room}`
    : "",
);
onShow(async () => {
  await session.ensureLogin();
  const [addressList, bundle, notifications] = await Promise.all([
    api.addresses(),
    api.coupons(),
    api.notifications(),
  ]);
  addresses.value = addressList;
  const now = Date.now();
  usableCouponCount.value = bundle.mine.filter(
    (item) =>
      (item.status === "claimed" || item.status === "released") &&
      new Date(item.coupon.expiresAt).getTime() > now,
  ).length;
  unread.value = notifications.filter((n) => !n.read).length;
});
const go = (url: string) => uni.navigateTo({ url });
</script>
<template>
  <view class="page profile"
    ><view class="profile__top"
      ><view class="avatar">寝</view
      ><view
        ><text class="name">{{ session.user?.nickname || "同学" }}</text
        ><text class="muted"
        >{{
          defaultAddress
            ? defaultAddress.campusName +
              " · " +
              defaultAddress.buildingName +
              " " +
              defaultAddress.room
            : "湖北工业大学"
        }}</text
        ></view
      ></view
    ><view class="motto">“ 今天不出寝，<br />想吃的照样有。 ”</view
    ><view class="stats card"
      ><view
        ><text class="stats__value">{{ usableCouponCount }}</text
        ><text class="muted">可用优惠券</text></view
      ><view
        ><text class="stats__value">{{ addresses.length }}</text
        ><text class="muted">寝室地址</text></view
      ></view
    ><view class="menu card"
      ><view @tap="go('/pages/messages/index')"
        ><text>消息中心</text
        ><text>{{ unread ? unread + " 条未读" : "全部已读" }}　›</text></view
      ><view @tap="go('/pages/address/index')"
        ><text>寝室地址</text
        ><text>{{ roomSummary || "去添加" }}　›</text></view
      ><view @tap="go('/pages/coupons/index')"
        ><text>我的优惠券</text
        ><text>{{ usableCouponCount }} 张可用　›</text></view
      ><view @tap="go('/pages/after-sales/index')"
        ><text>售后与退款</text><text>查看记录　›</text></view
      ><view @tap="uni.makePhoneCall({ phoneNumber: '4008002026' })"
        ><text>联系客服</text><text>每天 09:00-22:30　›</text></view
      ></view
    ><view class="brand-foot"
      ><text>不出寝｜食社</text
      ><text class="muted">校园零食日用，送到寝室</text></view
    ></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.profile {
  padding-top: calc(64rpx + env(safe-area-inset-top));
  background: linear-gradient(180deg, #dff7e4 0, $paper 500rpx);
}
.profile__top {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary, $primary-dark);
  color: #fff;
  border: 5rpx solid #fff;
  box-shadow: 0 12rpx 28rpx rgba(7, 136, 59, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  font-weight: 900;
}
.name {
  display: block;
  font-size: 38rpx;
  font-weight: 900;
  margin-bottom: 8rpx;
}
.motto {
  color: $primary-dark;
  font-size: 46rpx;
  font-weight: 900;
  line-height: 1.45;
  margin: 56rpx 10rpx;
  letter-spacing: -2rpx;
}
.stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  padding: 28rpx 10rpx;
  text-align: center;
}
.stats > view + view {
  border-left: 2rpx solid $line;
}
.stats__value {
  display: block;
  font-size: 34rpx;
  color: $primary-dark;
  font-weight: 900;
  margin-bottom: 8rpx;
}
.menu {
  margin-top: 24rpx;
  padding: 4rpx 28rpx;
}
.menu > view {
  min-height: 106rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  border-bottom: 2rpx solid $line;
  font-weight: 700;
}
.menu > view:last-child {
  border: none;
}
.menu > view text:last-child {
  color: #667069;
  font-size: 23rpx;
  font-weight: 400;
  text-align: right;
}
.brand-foot {
  text-align: center;
  margin-top: 58rpx;
}
.brand-foot text {
  display: block;
  color: $primary-dark;
  font-weight: 900;
}
.brand-foot .muted {
  font-size: 22rpx;
  margin-top: 8rpx;
  font-weight: 400;
}
</style>
