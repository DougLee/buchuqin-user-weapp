<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import { fenToYuan } from "../../utils/money";
import type { Banner, Order } from "../../types";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
const orderId = ref(""),
  order = ref<Order>(),
  cancelling = ref(false),
  /** 订单卡加载中（2026-08-24）：拉单期间给同构占位，卡片不突兀弹入 */
  loading = ref(true),
  /** 支付成功页广告位（IKA57E→IKB87P 大卡版）：最多 2 条，空数组不渲染 */
  ads = ref<Banner[]>([]),
  /** 楼栋福利群引导（IKE4FR）：楼栋→校级兜底后端已做；未配置 null 不渲染 */
  group = ref<Awaited<ReturnType<typeof api.wechatGroup>>>(null),
  /** 支付后推荐券（道哥 2026-09-08）：featured 券中面额最大的一张，
   *  一键领取复用券中心 claimCoupon；无推荐/已领取 → 不渲染 */
  featuredCoupon = ref<Awaited<ReturnType<typeof api.coupons>>["claimable"][number]>(),
  couponClaimed = ref(false);
  // 营销位总量 2（道哥 2026-09-08：广告+券合计最多两个）：
  // 推荐券存在且未领 → 券占 1 槽、广告 1 条；无券/已领 → 广告 2 条
  const marketingAdCount = computed(() =>
    featuredCoupon.value && !couponClaimed.value ? 1 : 2,
  );
  const marketingAds = computed(() => ads.value.slice(0, marketingAdCount.value));
onLoad(async (q) => {
  orderId.value = String(q?.id || "");
  // 广告位拉取失败静默（不影响支付结果展示）
  api
    .paySuccessBanners()
    .then((list) => (ads.value = (list ?? []).slice(0, 2)))
    .catch(() => {});
  // 群码拉取失败静默：卡片不渲染即可，不影响支付结果展示
  api
    .wechatGroup()
    .then((g) => (group.value = g))
    .catch(() => {});
  // 支付后推荐券：featured 且可领的取面额最大一张；拉取失败静默
  api
    .coupons()
    .then((bundle) => {
      const picks = bundle.claimable
        .filter((c) => c.featuredAfterPay)
        .sort((a, b) => b.amount - a.amount);
      featuredCoupon.value = picks[0];
    })
    .catch(() => {});
  try {
    if (orderId.value) order.value = await api.order(orderId.value);
  } finally {
    loading.value = false;
  }
});
/** 广告点击进图文详情（IKA57E）：复用 Banner 图文基建，storage 传参 */
function openAd(banner: Banner) {
  uni.setStorageSync("bannerContent", JSON.stringify(banner));
  uni.navigateTo({ url: "/pages/content/detail" });
}
/** 一键领取推荐券（道哥 2026-09-08）：领取成功卡片变已领态 */
const claimingCoupon = ref(false);
async function claimFeaturedCoupon() {
  const c = featuredCoupon.value;
  if (!c || claimingCoupon.value) return;
  claimingCoupon.value = true;
  try {
    await api.claimCoupon(c.id);
    couponClaimed.value = true;
    uni.showToast({ title: `已领取 ¥${fenToYuan(c.amount)} 券`, icon: "none" });
  } catch (err) {
    uni.showToast({
      title: err instanceof Error ? err.message : "领取失败，请重试",
      icon: "none",
    });
  } finally {
    claimingCoupon.value = false;
  }
}
function goHome() {
  // IK9SNY：switchTab 失败（极端栈状态）兜底 reLaunch，确保落到首页而非上一页
  uni.switchTab({
    url: "/pages/index/index",
    fail: () => uni.reLaunch({ url: "/pages/index/index" }),
  });
}
/**
 * 取消确认（IK9AWR）：后端 cancel 接口暂无 reason 字段，
 * 原原因选择弹窗收集后不上传属 UI 表演，已移除；接口支持后再恢复选择并上传。
 * G2（2026-08-19 grilling）：仅待支付可取消；已支付订单按 ADR-0004 走客服，
 * 不再显示取消入口（原"按支付渠道发起退款"文案与后端 400 事实矛盾）。
 */
function openCancel() {
  uni.showModal({
    title: "取消订单",
    content: "订单尚未支付，取消后直接关闭",
    confirmColor: "#d4380d",
    success: async (m) => {
      if (!m.confirm || !order.value || cancelling.value) return;
      cancelling.value = true;
      try {
        await api.cancelOrder(order.value.id);
        uni.showToast({ title: "订单已取消", icon: "success" });
        // IKAHBQ：订单已非 tab 页，改 navigateTo
        setTimeout(() => uni.navigateTo({ url: "/pages/orders/index" }), 600);
      } finally {
        cancelling.value = false;
      }
    },
  });
}
</script>
<template>
  <view class="page success"
    ><view class="banner"
      ><view class="banner__check">✓</view
      ><text class="banner__title">支付成功</text
      ><text class="banner__sub"
        >这一袋已经从校园仓出发接力，留意消息通知</text
      ></view
    ><!-- 订单卡骨架（2026-08-24）：三行同构占位 --><view
      v-if="loading"
      class="order success-skeleton"
      ><view v-for="n in 3" :key="n" class="success-skeleton__row" /></view
    ><view v-else-if="order" class="order card"
      ><view class="order__row"
        ><text class="muted">订单编号</text
        ><text>{{ order.orderNo }}</text></view
      ><view class="order__row"
        ><text class="muted">实付金额</text
        ><text class="order__amount"
          >¥{{ fenToYuan(order.payableAmount) }}</text
        ></view
      ><view class="order__row"
        ><text class="muted">送达寝室</text
        ><text
          >{{ order.address.buildingName }} · {{ order.address.room }}</text
        ></view
      ></view
    ><!-- 楼栋福利群引导（IKE4FR 道哥拍板A，先于领券卡：群、券、广告）：
     背景图与首页福利群卡同源（home-card-group-v4 右装饰左留白），
     文字压左、二维码白底块居右；未配置群不占位 -->
    <view v-if="group" class="group-card card" role="button">
      <view class="group-card__meta">
        <view class="group-card__head"
          ><text class="group-card__title">{{
            group.scope === "building" ? "本楼栋福利群" : "校园福利大群"
          }}</text
          ><text class="group-card__badge">官方</text></view
        >
        <text class="group-card__sub">配送动态 · 优惠福利，进群早知道</text>
        <text class="group-card__hint">长按右侧二维码，识别进群</text>
      </view>
      <view class="group-card__qrwrap">
        <image
          class="group-card__qr"
          :src="group.image"
          mode="aspectFit"
          show-menu-by-longpress
        />
      </view>
    </view><!-- 支付后推荐券（道哥 2026-09-08）：featured 券一键领取，
         领取后变已领态（券额大字左、按钮右），无推荐不占位 -->
    <view
      v-if="featuredCoupon && !couponClaimed"
      class="pay-coupon card"
      role="button"
      @tap="claimFeaturedCoupon"
    >
      <view class="pay-coupon__amount"
        ><text class="pay-coupon__symbol">¥</text
        >{{ fenToYuan(featuredCoupon.amount) }}</view
      >
      <view class="pay-coupon__meta">
        <text class="pay-coupon__name">{{ featuredCoupon.name }}</text>
        <text class="pay-coupon__cond"
          >{{
            featuredCoupon.threshold > 0
              ? `满 ${fenToYuan(featuredCoupon.threshold)} 元可用`
              : "无门槛"
          }} · 下单自动抵扣</text
        >
      </view>
      <view class="pay-coupon__btn" :class="{ 'pay-coupon__btn--busy': claimingCoupon }">
        {{ claimingCoupon ? "领取中…" : "领取" }}
      </view>
    </view>
    <view
      v-else-if="couponClaimed"
      class="pay-coupon pay-coupon--done card"
      >已放入你的优惠券账户，下单立减</view
    >
    <!-- 支付成功页广告位（IKA57E→IKB87P 大卡版）：图上文下，最多 2 条，未配置不占位 -->
    <view v-if="marketingAds.length" class="ads">
      <text class="ads__caption">为你推荐</text>
      <view
        v-for="banner in marketingAds"
        :key="banner.id"
        class="ad card"
        role="button"
        @tap="openAd(banner)"
        ><view
          class="ad__media"
          :class="`ad__media--${banner.color || 'green'}`"
          ><image
            v-if="banner.image"
            class="ad__image"
            :src="banner.image"
            mode="aspectFill"
          /><text v-if="banner.badge" class="ad__badge">{{
            banner.badge
          }}</text></view
        ></view
      >
    </view><view class="actions safe-bottom"
      ><button class="primary-btn actions__home" @tap="goHome"
        >返回首页</button
      ><button
        v-if="order?.status === 'pending-payment'"
        class="actions__cancel"
        :disabled="cancelling"
        @tap="openCancel"
        >{{ cancelling ? "正在取消…" : "取消订单" }}</button
      ></view
    ></view
  >
  <CartOverlay />
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64rpx 40rpx 48rpx;
}
.banner__check {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary, $primary-dark);
  color: #fff;
  font-size: 64rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 32rpx rgba(7, 136, 59, 0.28);
}
.banner__title {
  font-size: 44rpx;
  font-weight: 900;
  margin-top: 28rpx;
}
.banner__sub {
  color: $muted;
  margin-top: 12rpx;
}
.order {
  padding: 28rpx;
}
/* 订单卡骨架（2026-08-24）：shimmer 与全端同款 */
.success-skeleton__row {
  height: 44rpx;
  border-radius: 12rpx;
  margin: 22rpx 0;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: success-pulse 1.2s infinite;
}
@keyframes success-pulse {
  50% {
    opacity: 0.55;
  }
}
/* 支付后推荐券卡（道哥 2026-09-08）：券额大字左 + 信息中 + 领取钮右；
   已领态整卡弱化 */
.pay-coupon {
  margin-top: 24rpx;
  height: 200rpx;
  padding: 0 28rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  /* 白底细边（虚线券边显杂，白底更简洁） */
  background: #fff;
  border: 2rpx solid rgba(226, 92, 5, 0.28);
}
.pay-coupon--done {
  border-style: solid;
  justify-content: center;
  color: #b96f33;
  font-weight: 700;
  font-size: 26rpx;
}
.pay-coupon__amount {
  font-size: 56rpx;
  font-weight: 900;
  color: #e25c05;
  line-height: 1;
  flex: none;
}
.pay-coupon__symbol {
  font-size: 26rpx;
  margin-right: 4rpx;
}
.pay-coupon__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.pay-coupon__name {
  font-size: 28rpx;
  font-weight: 800;
  color: $ink;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pay-coupon__cond {
  font-size: 22rpx;
  color: #b96f33;
}
.pay-coupon__btn {
  flex: none;
  min-height: 72rpx;
  padding: 0 36rpx;
  display: flex;
  align-items: center;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #ff9a5c, $orange);
  color: #fff;
  font-size: 27rpx;
  font-weight: 900;
  box-shadow: 0 6rpx 16rpx rgba(217, 95, 16, 0.25);
}
.pay-coupon__btn--busy {
  opacity: 0.6;
}
/* 群引导卡（IKE4FR）：橙系延续首页福利群卡认知，横向 QR+文案；
   订单卡与广告位之间（自有运营 > 商业广告），间距同 28rpx */
.group-card {
  /* 三营销卡统一 200rpx 高（道哥 2026-09-08：等大更整洁） */
  margin-top: 24rpx;
  height: 200rpx;
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  /* 背景图同首页福利群卡（home-card-group-v4：右侧装饰左侧留白），
     文案压左、QR 白底块居右，#fff1e2 兜底 */
  background:
    url("https://static.buchuqin.com/app/public/home-card-group-v4.webp") right
      center / cover no-repeat,
    #fff1e2;
  border: 2rpx solid rgba(255, 122, 33, 0.24);
  box-shadow: 0 8rpx 24rpx rgba(217, 95, 16, 0.08);
}
.group-card__qrwrap {
  padding: 10rpx;
  background: #fff;
  border-radius: 14rpx;
  flex: none;
  box-shadow: 0 4rpx 12rpx rgba(217, 95, 16, 0.12);
}
.group-card__qr {
  width: 152rpx;
  height: 152rpx;
  display: block;
}
.group-card__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.group-card__head {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.group-card__title {
  font-size: 30rpx;
  font-weight: 900;
  color: #c2570f;
}
.group-card__badge {
  padding: 2rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 122, 33, 0.16);
  color: #c2570f;
  font-size: 18rpx;
  font-weight: 800;
}
.group-card__sub {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #b96f33;
  font-weight: 600;
}
.group-card__hint {
  margin-top: 16rpx;
  font-size: 22rpx;
  color: #c98a4a;
}
/* 广告位大卡（IKA57E→IKB87P）：图上文下、图满卡宽，整卡可点；
   IKB5PB 间距保留（与支付信息卡 28rpx），两卡之间 24rpx */
.ads {
  margin-top: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.ads__caption {
  color: $muted;
  font-size: 24rpx;
  padding-left: 4rpx;
}
.ad {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* 媒体区：有图铺图（aspectFill 防跳版），无图落主题色块（角标仍在） */
.ad__media {
  position: relative;
  height: 200rpx;
  background: linear-gradient(135deg, $primary, $primary-dark);
}
.ad__media--orange {
  background: linear-gradient(135deg, #ffa04d, $orange);
}
.ad__media--dark {
  background: linear-gradient(135deg, #3c5a4e, #1f2e28);
}
.ad__image {
  width: 100%;
  height: 100%;
}
.ad__badge {
  position: absolute;
  left: 20rpx;
  top: 20rpx;
  background: rgba(255, 255, 255, 0.94);
  color: $primary-dark;
  font-size: 22rpx;
  font-weight: 700;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
}
/* 纯图卡（道哥 2026-09-08：广告只显示图片）——图为主角加高一档 */
.ad__media {
  height: 340rpx;
}
.order__row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
}
.order__amount {
  font-weight: 900;
  color: $primary-dark;
}
.actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 18rpx 28rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-shadow: 0 -10rpx 30rpx rgba(21, 75, 38, 0.09);
  z-index: 20;
}
.actions button {
  margin: 0;
  width: 100%;
}
.actions__home {
  min-height: 96rpx;
  font-size: 32rpx;
}
.actions__cancel {
  min-height: 80rpx;
  background: transparent;
  color: #9aa39d;
  font-size: 26rpx;
}
.actions__cancel::after {
  border: none;
}
</style>
