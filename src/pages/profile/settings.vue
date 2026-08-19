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
/** 头像点击查看大图（已上传头像） */
function previewAvatar() {
  if (session.user?.avatar) {
    uni.previewImage({ urls: [session.user.avatar] });
  }
}
/** 微信头像选择（IK9ROG）：chooseAvatar 临时路径 → COS → 落库 */
async function onChooseAvatar(e: Event) {
  const url = (
    e as unknown as { detail?: { avatarUrl?: string } }
  ).detail?.avatarUrl;
  if (!url) return;
  uni.showLoading({ title: "上传中…", mask: true });
  try {
    await session.setAvatar(url);
    uni.showToast({ title: "头像已更新", icon: "success" });
  } catch {
    uni.showToast({ title: "头像上传失败，请重试", icon: "none" });
  } finally {
    uni.hideLoading();
  }
}
/** 保存昵称（IK9ROG）：调资料端点落库，换设备不丢 */
async function saveNickname() {
  if (savingNickname.value) return;
  if (!nicknameInput.value.trim()) {
    uni.showToast({ title: "昵称不能为空", icon: "none" });
    return;
  }
  savingNickname.value = true;
  try {
    await session.setNickname(nicknameInput.value);
    uni.showToast({ title: "昵称已更新", icon: "none" });
  } catch {
    /* request 层已 toast 错误信息 */
  } finally {
    savingNickname.value = false;
  }
}
/**
 * 手机号自定义弹层（IK9AWT）：uni.showModal 的 editable 仅微信小程序支持，
 * H5 弹出后没有输入框、确认永远提交空串——改为全端自绘弹层。
 */
const phoneDialog = ref(false),
  phoneInput = ref(""),
  binding = ref(false);
function bindPhone() {
  phoneInput.value = session.user?.phone || "";
  phoneDialog.value = true;
}
async function confirmPhone() {
  if (binding.value) return;
  const phone = phoneInput.value.trim();
  if (!/^1\d{10}$/.test(phone)) {
    uni.showToast({ title: "手机号格式不正确", icon: "none" });
    return;
  }
  binding.value = true;
  try {
    await session.bindPhone(phone);
    phoneDialog.value = false;
    uni.showToast({ title: "手机号已绑定", icon: "success" });
  } catch {
    uni.showToast({ title: "绑定失败，请重试", icon: "none" });
  } finally {
    binding.value = false;
  }
}
// #ifdef MP-WEIXIN
/** button open-type="getPhoneNumber" 回调（基础库 2.21.0+ 下发动态令牌 code） */
interface WxPhoneNumberEvent {
  detail: { errMsg: string; code?: string };
}
/**
 * 手机号授权绑定（IK8W5Q）：优先把 e.detail.code 交给 POST /auth/phone 换真实号码；
 * 后端 API-3 扩展中、暂只收 phone 直传时该请求会失败——降级回自绘弹层手输
 * （待后端对齐 code 后移除降级分支）。
 */
async function onPhoneNumber(event: WxPhoneNumberEvent) {
  const code = event.detail.code;
  if (!code) return; // 用户拒绝/关闭授权弹窗，不打扰
  try {
    await session.bindPhoneByCode(code);
    uni.showToast({ title: "手机号已绑定", icon: "success" });
  } catch {
    bindPhone();
  }
}
// #endif
</script>
<template>
  <view class="page settings"
    ><view class="menu card"
      ><!-- #ifdef MP-WEIXIN -->
      <button class="settings__row settings__avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar"
        ><text>头像</text
        ><view class="settings__right"
          ><image
            v-if="session.user?.avatar"
            class="settings__avatar"
            :src="session.user.avatar"
            mode="aspectFill"
          /><view v-else class="settings__avatar settings__avatar--text"
            >寝</view
          ><view class="settings__right"><text class="settings__hint">更换</text><text class="chevron" /></view></view
        ></button
      >
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="settings__row" @tap="previewAvatar"
        ><text>头像</text
        ><view class="settings__right"
          ><image
            v-if="session.user?.avatar"
            class="settings__avatar"
            :src="session.user.avatar"
            mode="aspectFill"
          /><view v-else class="settings__avatar settings__avatar--text"
            >寝</view
          ><view class="settings__right"><text class="settings__hint">查看</text><text class="chevron" /></view></view
        ></view
      >
      <!-- #endif -->
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
        <view class="settings__right"
          ><text class="settings__hint">{{
            session.user?.phone || "未绑定"
          }}</text
          ><text class="chevron" /></view
        >
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="settings__row" @tap="bindPhone"
        ><text>绑定手机号</text
        ><view class="settings__right"
          ><text class="settings__hint">{{
            session.user?.phone || "未绑定"
          }}</text
          ><text class="chevron" /></view
        ></view
      ><!-- #endif -->
      </view
    ><!-- IK9SO3：删过时提示卡（头像已支持上传、昵称已落库） --><!-- 手机号自绘弹层（IK9AWT）：全端可用，替代 showModal editable -->
    <view v-if="phoneDialog" class="phone-dialog"
      ><view class="phone-dialog__mask" @tap="phoneDialog = false"></view
      ><view class="phone-dialog__panel"
        ><text class="phone-dialog__title">绑定手机号</text
        ><text class="phone-dialog__tip">用于配送联系，仅你和配送员可见</text
        ><input
          v-model="phoneInput"
          class="phone-dialog__input"
          type="number"
          maxlength="11"
          placeholder="请输入 11 位手机号"
          placeholder-class="phone-dialog__placeholder"
        /><view class="phone-dialog__actions"
        ><button class="phone-dialog__btn" @tap="phoneDialog = false">
          取消
        </button
        ><button
          class="phone-dialog__btn phone-dialog__btn--primary"
          :disabled="binding"
          @tap="confirmPhone"
        >
          {{ binding ? "绑定中…" : "确定" }}
        </button></view
      ></view
    ></view
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
/* 微信 chooseAvatar 按钮承载头像行（IK9ROG）：重置原生 button 外观 */
.settings__avatar-btn {
  width: 100%;
  margin: 0;
  padding: 0 30rpx;
  background: none;
  border-radius: 0;
  border-bottom: 2rpx solid $line;
  text-align: left;
  line-height: inherit;
  font-size: inherit;
  color: inherit;
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
  color: $muted;
  font-size: 22rpx;
}
.phone-dialog__mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 30, 20, 0.5);
  z-index: 998;
}
.phone-dialog__panel {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 600rpx;
  z-index: 999;
  background: $surface;
  border-radius: 28rpx;
  padding: 40rpx 32rpx 28rpx;
  box-sizing: border-box;
}
.phone-dialog__title {
  display: block;
  text-align: center;
  font-size: 34rpx;
  font-weight: 900;
}
.phone-dialog__tip {
  display: block;
  text-align: center;
  font-size: 23rpx;
  margin: 10rpx 0 28rpx;
}
.phone-dialog__input {
  height: 92rpx;
  border: 2rpx solid $line;
  border-radius: 18rpx;
  background: $paper;
  padding: 0 24rpx;
  font-size: 32rpx;
  text-align: center;
  letter-spacing: 2rpx;
}
.phone-dialog__placeholder {
  color: #8a938d;
  letter-spacing: 0;
}
.phone-dialog__actions {
  display: flex;
  gap: 18rpx;
  margin-top: 28rpx;
}
.phone-dialog__btn {
  flex: 1;
  min-height: 88rpx;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 44rpx;
  background: $paper;
  color: $ink;
  font-size: 30rpx;
  font-weight: 700;
}
.phone-dialog__btn--primary {
  background: $primary;
  color: #fff;
}
.phone-dialog__btn--primary[disabled] {
  opacity: 0.55;
}
</style>
