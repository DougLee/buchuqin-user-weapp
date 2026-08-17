<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useSessionStore } from "../../stores/session";
import { SERVICE_HOURS, SERVICE_PHONE } from "../../utils/service";
import type { Address } from "../../types";
const session = useSessionStore(),
  addresses = ref<Address[]>([]),
  usableCouponCount = ref(0),
  orderCount = ref(0),
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
  // 各请求独立容错（IK9AWK）：部分失败不清零其他栏位
  const [a, b, n, o] = await Promise.allSettled([
    api.addresses(),
    api.coupons(),
    api.notifications(),
    api.orders(),
  ]);
  if (a.status === "fulfilled") addresses.value = a.value;
  if (b.status === "fulfilled") {
    const now = Date.now();
    usableCouponCount.value = b.value.mine.filter(
      (item) =>
        (item.status === "claimed" || item.status === "released") &&
        new Date(item.coupon.expiresAt).getTime() > now,
    ).length;
  }
  if (n.status === "fulfilled")
    unread.value = n.value.filter((item) => !item.read).length;
  if (o.status === "fulfilled") orderCount.value = o.value.length;
});
const go = (url: string) => uni.navigateTo({ url });
/** 订单列表是 tabBar 页，跳Tab 需 switchTab */
const goOrders = () => uni.switchTab({ url: "/pages/orders/index" });
/** 优惠券/售后列表入口（IK9AWH：原为无入口孤儿页） */
const goCoupons = () => go("/pages/coupons/index");
const goAfterSales = () => go("/pages/after-sales/index");
const goSettings = () => go("/pages/profile/settings");
/** 客服电话统一常量（IK9AWJ，原 400-100-1000 为演示号） */
const callService = () =>
  uni.makePhoneCall({ phoneNumber: SERVICE_PHONE });
/** 在线客服 H5 降级：button open-type="contact" 仅小程序端可用 */
const onlineServiceFallback = () =>
  uni.showToast({ title: "请在小程序中使用在线客服", icon: "none" });
</script>
<template>
  <view class="page profile"
    ><view class="profile__top"
      ><view class="avatar" @tap="goSettings">寝</view
      ><view
        ><view class="name-row" @tap="goSettings"
          ><text class="name">{{ session.nickname || "同学" }}</text
          ><text class="name-row__edit">{{
            session.needsNickname ? "点此设置昵称" : "个人信息"
          }}</text></view
        ><text class="muted"
        >{{
          defaultAddress
            ? defaultAddress.campusName +
              " · " +
              defaultAddress.buildingName +
              " " +
              defaultAddress.room
            : "点击添加寝室地址，楼长才能送到门口"
        }}</text
        ></view
      ></view
    ><view class="motto">“ 今天不出寝，<br />想吃的照样有。 ”</view
    ><view class="stats card"
      ><view @tap="goCoupons"
        ><text class="stats__value">{{ usableCouponCount }}</text
        ><text class="muted">可用优惠券</text></view
      ><view @tap="goOrders"
        ><text class="stats__value">{{ orderCount }}</text
        ><text class="muted">我的订单</text></view
      ></view
    ><view class="menu card"
      ><view @tap="go('/pages/messages/index')"
        ><text>消息中心</text
        ><text>{{ unread ? unread + " 条未读" : "全部已读" }}　›</text></view
      ><view @tap="goOrders"
        ><text>我的订单</text><text>查看全部订单　›</text></view
      ><view @tap="goCoupons"
        ><text>优惠券</text
        ><text>{{ usableCouponCount }} 张可用　›</text></view
      ><view @tap="goAfterSales"
        ><text>售后与退款</text><text>进度与明细　›</text></view
      ><view @tap="go('/pages/address/index')"
        ><text>寝室地址</text
        ><text>{{ roomSummary || "去添加" }}　›</text></view
      ><view @tap="callService"
        ><text>电话客服</text><text>{{ SERVICE_HOURS }}　›</text></view
      ><!-- #ifdef MP-WEIXIN -->
      <button class="menu__service" open-type="contact">
        <text>在线客服</text>
        <text>微信内会话　›</text>
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view @tap="onlineServiceFallback"
        ><text>在线客服</text><text>仅小程序可用　›</text></view
      ><!-- #endif -->
      </view
    ><view class="brand-foot"
      ><text>不出寝｜食社</text
      ><text class="muted">校园零食日用，送到寝室</text></view
    ></view
  >
  <CartOverlay />
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
.name-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 8rpx;
}
.name-row .name {
  margin-bottom: 0;
}
.name-row__edit {
  font-size: 21rpx;
  color: $primary-dark;
  background: $primary-soft;
  border-radius: 16rpx;
  padding: 4rpx 12rpx;
  white-space: nowrap;
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
/* 在线客服（mp-weixin contact 按钮伪装成普通菜单行，视觉与 .menu > view 一致） */
.menu__service {
  width: 100%;
  min-height: 106rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  border-bottom: 2rpx solid $line;
  margin: 0;
  padding: 0;
  background: transparent;
  border-radius: 0;
  color: inherit;
  font-size: inherit;
  font-weight: 700;
  line-height: inherit;
}
.menu__service text:last-child {
  color: #667069;
  font-size: 23rpx;
  font-weight: 400;
  text-align: right;
}
.menu__service:last-child {
  border: none;
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
