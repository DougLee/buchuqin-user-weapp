<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { isRetryable } from "../../api/request";
import { fenToYuan } from "../../utils/money";
import type { Coupon, UserCoupon, UserCouponStatus } from "../../types";
const claimable = ref<Coupon[]>([]),
  mine = ref<UserCoupon[]>([]),
  claiming = ref(""),
  loading = ref(true),
  error = ref(false);
const statusLabels: Record<UserCouponStatus, string> = {
  claimed: "未使用",
  locked: "下单锁定",
  used: "已使用",
  released: "已退回",
};
/** 券不可用行内标注（ADR-0005/IKA00Q）：过期置灰 + 状态改「已过期」，
 *  不再显示「未使用/去使用」误导；门槛原因在结算页券列表就地标差价 */
function expired(c: UserCoupon) {
  return new Date(c.coupon.expiresAt).getTime() <= Date.now();
}
onShow(load);
/**
 * silent（IKA08Y）：静默重拉不切骨架——领取成功后原地更新两列，
 * 消除整页闪断；状态仍以服务端返回为准（IK9SO0 原则不变）
 */
async function load(silent = false) {
  if (!silent) {
    loading.value = true;
    error.value = false;
  }
  try {
    const bundle = await api.coupons();
    claimable.value = bundle.claimable;
    mine.value = bundle.mine;
  } catch (e) {
    // ADR-0005(IKA00Q)：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
    if (isRetryable(e) && !silent) error.value = true;
  } finally {
    if (!silent) loading.value = false;
  }
}
async function claim(coupon: Coupon) {
  if (claiming.value) return;
  claiming.value = coupon.id;
  try {
    await api.claimCoupon(coupon.id);
    uni.showToast({ title: "领取成功", icon: "success" });
    // IK9SO0：领取成功后整页重拉，两列状态以服务端为准——
    // 旧写法本地挪数组，任何偏差都会让卡片停留「领取中…」观感
    // IKA08Y：改静默拉取，不再整页闪骨架
    await load(true);
  } catch {
    /* request 层已 toast 业务错误（重复领取/库存不足等） */
  } finally {
    claiming.value = "";
  }
}
</script>
<template>
  <view class="page"
    ><view v-if="error" class="cp-retry card" @tap="load"
      ><text class="cp-retry__title">优惠券加载失败</text
      ><text class="muted">网络异常，点击重试</text></view
    ><view v-else-if="loading" class="cp-skeleton"
      ><view v-for="n in 3" :key="n" class="skeleton-block" /></view
    ><template v-else
    ><template v-if="claimable.length"
      ><view class="section-title"
        ><text class="section-title__main">可以领的券</text></view
      ><view class="coupon card" v-for="c in claimable" :key="c.id"
        ><!-- 金额列（IKA08W）：外层满高居中，内层基线对齐 --><view
          class="coupon__money"
          ><view class="coupon__money-inner"
            ><text class="symbol">¥</text
            ><text>{{ fenToYuan(c.amount) }}</text></view
          ></view
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
      ><view
        class="coupon card"
        v-for="c in mine"
        :key="c.id"
        :class="{ 'coupon--dead': expired(c) }"
        ><!-- 金额列（IKA08W）：外层满高居中，内层基线对齐 --><view
          class="coupon__money"
          ><view class="coupon__money-inner"
            ><text class="symbol">¥</text
            ><text>{{ fenToYuan(c.coupon.amount) }}</text></view
          ></view
        ><view class="coupon__body"
          ><view class="coupon__name-row"
            ><text class="coupon__name">{{ c.coupon.name }}</text
            ><text
              class="coupon__status"
              :class="expired(c) ? 'coupon__status--expired' : `coupon__status--${c.status}`"
              >{{ expired(c) ? "已过期" : statusLabels[c.status] }}</text
            ></view
          ><text class="muted"
          >满 {{ fenToYuan(c.coupon.threshold) }} 元可用</text
          ><text class="coupon__date"
          >有效期至 {{ c.coupon.expiresAt.slice(0, 10) }}</text
          ></view
        ><!-- 过期券不再给「去使用」（ADR-0005/IKA00Q） --><button
          v-if="
            (c.status === 'claimed' || c.status === 'released') && !expired(c)
          "
          @tap="uni.switchTab({ url: '/pages/category/index' })"
        >
          去使用
        </button></view
      ></view
    ><view v-else class="empty card"
      ><text>{{
        claimable.length
          ? "还没有优惠券，先去上面领一张吧"
          : "还没有优惠券，去下单解锁更多福利吧"
      }}</text></view
    ><view class="rules"
      ><text class="rules__title">使用说明</text
      ><text>· 每笔订单最多使用一张优惠券</text
      ><text>· 优惠券仅限湖北工业大学校园仓商品</text
      ><text>· 退款是否返券以活动规则为准</text></view
    ></template
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
  /* IKA08W：外层满高弹性盒只管垂直居中，基线对齐交给内层 */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52rpx;
  font-weight: 900;
}
.coupon__money-inner {
  display: flex;
  /* IK9SO0：¥ 与金额基线对齐，比例协调（原 24/64 失衡） */
  align-items: baseline;
  gap: 4rpx;
}
.symbol {
  font-size: 30rpx;
  font-weight: 800;
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
/* 过期券置灰（ADR-0005/IKA00Q）：整体降透明度，金额面去色 */
.coupon--dead {
  opacity: 0.55;
}
.coupon--dead .coupon__money {
  background: linear-gradient(135deg, #aeb8b2, #97a49c);
}
.coupon__status--expired {
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
.cp-retry {
  padding: 110rpx 30rpx;
  text-align: center;
}
.cp-retry__title {
  display: block;
  font-weight: 900;
  color: $primary-dark;
  margin-bottom: 8rpx;
}
.cp-skeleton .skeleton-block {
  height: 190rpx;
  border-radius: 28rpx;
  margin-bottom: 22rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: cp-pulse 1.2s infinite;
}
@keyframes cp-pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
