<script setup lang="ts">
import { ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useSessionStore } from "../../stores/session";
const session = useSessionStore(),
  nicknameInput = ref(""),
  savingNickname = ref(false);
onShow(async () => {
  await session.ensureLogin();
  nicknameInput.value =
    session.nickname === "微信用户" ? "" : session.nickname;
});
watch(
  () => session.nickname,
  (value) => {
    if (!nicknameInput.value)
      nicknameInput.value = value === "微信用户" ? "" : value;
  },
);
/** 头像点击查看：暂不支持上传（IK97FL），有头像图时放大预览 */
function previewAvatar() {
  if (session.user?.avatar) {
    uni.previewImage({ urls: [session.user.avatar] });
    return;
  }
  uni.showToast({ title: "暂不支持更换头像", icon: "none" });
}
/**
 * 保存昵称：后端暂无 PATCH /profile 之类的资料修改接口（IK8W5Q 起即为本地覆盖），
 * 先走 session.setNickname 本地持久化。TODO: 后端资料接口上线后改为远程保存。
 */
function saveNickname() {
  if (savingNickname.value) return;
  if (!nicknameInput.value.trim()) {
    uni.showToast({ title: "昵称不能为空", icon: "none" });
    return;
  }
  savingNickname.value = true;
  session.setNickname(nicknameInput.value);
  savingNickname.value = false;
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
  <view class="page settings"
    ><view class="menu card"
      ><view class="settings__row" @tap="previewAvatar"
        ><text>头像</text
        ><view class="settings__right"
          ><image
            v-if="session.user?.avatar"
            class="settings__avatar"
            :src="session.user.avatar"
            mode="aspectFill"
          /><view v-else class="settings__avatar settings__avatar--text"
            >寝</view
          ><text class="settings__hint">查看　›</text></view
        ></view
      ><view class="settings__row"
        ><text>昵称</text
        ><view class="settings__right"
          ><input
            v-model="nicknameInput"
            class="settings__nickname"
            maxlength="12"
            placeholder="给自己起个名字"
            confirm-type="done"
            @confirm="saveNickname"
          /><text class="settings__save" @tap="saveNickname">{{
            savingNickname ? "保存中…" : "保存"
          }}</text></view
        ></view
      ><!-- #ifdef MP-WEIXIN -->
      <button
        class="settings__phone"
        open-type="getPhoneNumber"
        @getphonenumber="onPhoneNumber"
      >
        <text>绑定手机号</text>
        <text class="settings__hint">{{
          (session.user?.phone || "未绑定") + "　›"
        }}</text>
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="settings__row" @tap="bindPhone"
        ><text>绑定手机号</text
        ><text class="settings__hint">{{
          (session.user?.phone || "未绑定") + "　›"
        }}</text></view
      ><!-- #endif -->
      </view
    ><view class="settings__tip"
      ><text>头像暂不支持上传；昵称修改目前仅保存在本机。</text></view
    ></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.menu {
  margin-top: 24rpx;
  padding: 4rpx 28rpx;
}
.settings__row {
  min-height: 118rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  border-bottom: 2rpx solid $line;
  font-weight: 700;
}
.settings__row:last-child {
  border: none;
}
.settings__right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.settings__avatar {
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
}
.settings__avatar--text {
  background: linear-gradient(135deg, $primary, $primary-dark);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  font-weight: 900;
}
.settings__hint {
  color: #667069;
  font-size: 23rpx;
  font-weight: 400;
  text-align: right;
}
.settings__nickname {
  width: 260rpx;
  height: 64rpx;
  background: $paper;
  border: 2rpx solid $line;
  border-radius: 16rpx;
  padding: 0 16rpx;
  font-size: 28rpx;
  text-align: right;
}
.settings__save {
  color: #fff;
  background: $primary;
  border-radius: 16rpx;
  padding: 10rpx 22rpx;
  font-size: 23rpx;
  font-weight: 800;
  white-space: nowrap;
}
/* 绑定手机号（mp-weixin 授权按钮伪装成普通菜单行，视觉与 .settings__row 一致） */
.settings__phone {
  width: 100%;
  min-height: 118rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin: 0;
  padding: 0;
  background: transparent;
  border-radius: 0;
  color: inherit;
  font-size: inherit;
  font-weight: 700;
  line-height: inherit;
}
.settings__phone::after {
  border: none;
}
.settings__tip {
  margin-top: 24rpx;
  padding: 0 10rpx;
  color: #9aa39d;
  font-size: 22rpx;
}
</style>
