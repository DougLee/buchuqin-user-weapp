<template>
  <view v-if="visible" class="sheet-mask" @tap.self="close">
    <view class="sheet" @tap.stop>
      <text class="sheet__title">联系客服</text>
      <!-- #195：校区配置企微客服链接（serviceKfUrl）后，主按钮=「在线客服」
           （点击拉起微信客服会话），二维码/电话降级为辅助通道；
           未配置链接维持原二维码/电话布局 -->
      <template v-if="kfUrl">
        <button class="sheet__call" @tap="openKf">在线客服</button>
        <text v-if="!qrcode" class="sheet__phone sheet__phone--kf">{{
          phone
        }}</text>
        <image
          v-if="qrcode"
          :src="qrcode"
          class="sheet__qr sheet__qr--kf"
          mode="aspectFit"
          show-menu-by-longpress
        />
        <text v-if="qrcode" class="sheet__tip"
          >长按识别二维码，添加校区客服微信</text
        >
        <button class="sheet__call ghost" @tap="call">拨打客服电话</button>
      </template>
      <template v-else>
        <template v-if="qrcode">
          <image
            :src="qrcode"
            class="sheet__qr"
            mode="aspectFit"
            show-menu-by-longpress
          />
          <text class="sheet__tip">长按识别二维码，添加校区客服微信</text>
          <button class="sheet__call ghost" @tap="call">拨打客服电话</button>
        </template>
        <template v-else>
          <text class="sheet__phone">{{ phone }}</text>
          <text class="sheet__tip">校区客服微信二维码未配置，可直接来电</text>
          <button class="sheet__call" @tap="call">立即拨打</button>
        </template>
      </template>
      <text class="sheet__close" @tap="close">取消</text>
    </view>
  </view>
</template>
<script setup lang="ts">
/**
 * IKKTWM 校区客服弹层：二维码为主（长按识别）、电话为辅；未配置二维码
 * 回落拨号。全部客服入口统一走本组件（替代 open-type=contact 平台客服）。
 */
import { computed } from "vue";
import { useCampusStore } from "../stores/campus";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();
const campus = useCampusStore();
const qrcode = computed(() => campus.qrcode);
const phone = computed(() => campus.phone);
/** #195 企微客服链接（校区行下发，空=未配置走原二维码/电话布局） */
const kfUrl = computed(() => campus.serviceKfUrl);
const close = () => emit("close");
const call = () => uni.makePhoneCall({ phoneNumber: phone.value });
/**
 * #195 在线客服：拉起微信客服会话。wx.openCustomerServiceChat 未收录进
 * @dcloudio/types——宽位调用（mp 端 uni 运行时 Proxy 会回落到 wx 同名 API，
 * H5 端无此能力给明确提示）。corpAccessId=企微企业 ID（campus 行
 * serviceKfCorpId 下发，缺失提示「客服未配置」）；fail 静默：企微侧未绑定
 * 客服/用户取消等不阻断弹层。
 */
function openKf() {
  if (!kfUrl.value) return;
  if (!campus.serviceKfCorpId) {
    uni.showToast({ title: "客服未配置", icon: "none" });
    return;
  }
  const openChat = (
    uni as unknown as {
      openCustomerServiceChat?: (o: {
        corpAccessId: string;
        extInfo: { url: string };
        showMessageCard: boolean;
        fail?: () => void;
      }) => void;
    }
  ).openCustomerServiceChat;
  if (!openChat) {
    uni.showToast({ title: "当前环境不支持在线客服", icon: "none" });
    return;
  }
  openChat({
    corpAccessId: campus.serviceKfCorpId,
    extInfo: { url: kfUrl.value },
    showMessageCard: false,
    fail: () => {},
  });
}
</script>
<style scoped>
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(6, 46, 35, 0.45);
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}
.sheet {
  width: 100%;
  max-width: 560rpx;
  background: #fff;
  border-radius: 28rpx;
  padding: 40rpx 36rpx 28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sheet__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #153628;
  margin-bottom: 28rpx;
}
.sheet__qr {
  width: 320rpx;
  height: 320rpx;
  border-radius: 16rpx;
  border: 1rpx solid #eef3ef;
}
.sheet__phone {
  font-size: 40rpx;
  font-weight: 800;
  color: #0b4b36;
  letter-spacing: 1rpx;
}
.sheet__tip {
  font-size: 22rpx;
  color: #8a978f;
  margin-top: 18rpx;
}
.sheet__call {
  margin-top: 28rpx;
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 42rpx;
  background: #12a05e;
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  border: 0;
}
.sheet__call::after {
  border: 0;
}
.sheet__call.ghost {
  background: #f0f5f1;
  color: #0b4b36;
}
.sheet__close {
  margin-top: 20rpx;
  font-size: 24rpx;
  color: #8a978f;
  padding: 10rpx;
}
/* #195：kf 分支内号码/二维码与「在线客服」主按钮的间距（不动基类，免影响未配置布局） */
.sheet__phone--kf {
  margin-top: 30rpx;
}
.sheet__qr--kf {
  margin-top: 30rpx;
}
</style>
