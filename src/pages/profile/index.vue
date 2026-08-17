<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useSessionStore } from "../../stores/session";
import type { Address } from "../../types";
const session = useSessionStore(),
  addresses = ref<Address[]>([]),
  usableCouponCount = ref(0),
  unread = ref(0),
  editingNickname = ref(false),
  nicknameInput = ref("");
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
function startEditNickname() {
  nicknameInput.value =
    session.nickname === "微信用户" ? "" : session.nickname;
  editingNickname.value = true;
}
function saveNickname() {
  if (!nicknameInput.value.trim()) {
    uni.showToast({ title: "昵称不能为空", icon: "none" });
    return;
  }
  session.setNickname(nicknameInput.value);
  editingNickname.value = false;
  uni.showToast({ title: "昵称已更新（仅本机生效）", icon: "none" });
}
/** 手输绑定：H5 常规路径，也是微信授权码失败的降级路径 */
async function bindPhone() {
  const res = await uni.showModal({
    title: "绑定手机号",
    editable: true,
    placeholderText: "用于配送联系",
  });
  if (!res.confirm) return;
  const phone = (res.content || "").trim();
  if (!/^1\d{10}$/.test(phone)) {
    uni.showToast({ title: "手机号格式不正确", icon: "none" });
    return;
  }
  await session.bindPhone(phone);
  uni.showToast({ title: "手机号已绑定", icon: "success" });
}
// #ifdef MP-WEIXIN
/** button open-type="getPhoneNumber" 回调（基础库 2.21.0+ 下发动态令牌 code） */
interface WxPhoneNumberEvent {
  detail: { errMsg: string; code?: string };
}
/**
 * 手机号授权绑定（IK8W5Q）：优先把 e.detail.code 交给 POST /auth/phone 换真实号码；
 * 后端 API-3 扩展中、暂只收 phone 直传时该请求会失败——降级回 showModal 手输旧路径
 * （待后端对齐 code 后移除降级分支）。
 */
async function onPhoneNumber(event: WxPhoneNumberEvent) {
  const code = event.detail.code;
  if (!code) return; // 用户拒绝/关闭授权弹窗，不打扰
  try {
    await session.bindPhoneByCode(code);
    uni.showToast({ title: "手机号已绑定", icon: "success" });
  } catch {
    await bindPhone();
  }
}
// #endif
</script>
<template>
  <view class="page profile"
    ><view class="profile__top"
      ><view class="avatar">寝</view
      ><view
        ><view v-if="editingNickname" class="nickname-edit"
          ><input
            v-model="nicknameInput"
            class="nickname-edit__input"
            :focus="true"
            maxlength="12"
            placeholder="给自己起个名字"
            confirm-type="done"
            @confirm="saveNickname"
          /><text class="nickname-edit__save" @tap="saveNickname"
            >保存</text
          ></view
        ><view v-else class="name-row" @tap="startEditNickname"
          ><text class="name">{{ session.nickname || "同学" }}</text
          ><text class="name-row__edit">{{
            session.needsNickname ? "点此设置昵称" : "改昵称"
          }}</text></view
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
      ><!-- #ifdef MP-WEIXIN -->
      <button
        class="menu__phone"
        open-type="getPhoneNumber"
        @getphonenumber="onPhoneNumber"
      >
        <text>手机号</text>
        <text>{{ session.user?.phone || "未绑定" }}　›</text>
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view @tap="bindPhone"
        ><text>手机号</text
        ><text>{{ session.user?.phone || "未绑定" }}　›</text></view
      ><!-- #endif -->
      <view @tap="go('/pages/address/index')"
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
.nickname-edit {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 8rpx;
}
.nickname-edit__input {
  width: 260rpx;
  height: 60rpx;
  background: #fff;
  border: 2rpx solid $primary;
  border-radius: 16rpx;
  padding: 0 16rpx;
  font-size: 30rpx;
  font-weight: 800;
}
.nickname-edit__save {
  color: #fff;
  background: $primary;
  border-radius: 16rpx;
  padding: 8rpx 20rpx;
  font-size: 23rpx;
  font-weight: 800;
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
/* 手机号行（mp-weixin 授权按钮伪装成普通菜单行，视觉与 .menu > view 一致） */
.menu__phone {
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
.menu__phone text:last-child {
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
