<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { isRetryable } from "../../api/request";
import { fenToYuan } from "../../utils/money";
import type { AfterSale, Refund } from "../../types";
/** 售后单状态 → 中文（后端值：pending/approved/rejected） */
const AFTERSALE_STATUS_TEXT: Record<string, string> = {
  pending: "待处理",
  approved: "退款完成",
  rejected: "已驳回",
};
function statusText(status: string): string {
  return AFTERSALE_STATUS_TEXT[status] ?? status;
}
const cases = ref<AfterSale[]>([]),
  refunds = ref<Refund[]>([]),
  loading = ref(true),
  error = ref(false);
onShow(load);
async function load() {
  loading.value = true;
  error.value = false;
  // 两接口独立容错（IK9AWK），任一失败给整页重试
  const [c, r] = await Promise.allSettled([api.afterSales(), api.refunds()]);
  if (c.status === "fulfilled") cases.value = c.value;
  if (r.status === "fulfilled") refunds.value = r.value;
  // ADR-0005(IKA00Q)：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
  if (
    (c.status === "rejected" && isRetryable(c.reason)) ||
    (r.status === "rejected" && isRetryable(r.reason))
  )
    error.value = true;
  loading.value = false;
}
</script>
<template>
  <view class="page"
    ><view v-if="error" class="as-retry card" @tap="load"
      ><text class="as-retry__title">加载失败</text
      ><text class="muted">网络异常，点击重试</text></view
    ><template v-else
    ><view class="summary card"
      ><text class="summary__value"
        >¥{{ fenToYuan(refunds.reduce((n, r) => n + r.amount, 0)) }}</text
      ><text class="muted">累计退款</text></view
    ><view class="section-title"
      ><text class="section-title__main">售后记录</text></view
    ><view v-if="!cases.length" class="empty card"
      ><text class="empty__title">还没有售后记录</text
      ><text class="muted">订单送达后，可在订单详情申请质量售后</text></view
    ><view v-for="item in cases" :key="item.id" class="case card"
      ><view
        ><text class="case__title">{{ item.description }}</text
        ><text class="muted">订单 {{ item.orderId.slice(-8) }}</text></view
      ><text class="case__status">{{ statusText(item.status) }}</text></view
    ><view class="section-title"
      ><text class="section-title__main">退款明细</text></view
    ><view v-for="r in refunds" :key="r.id" class="refund"
      ><view
        ><text>{{ r.reason }}</text
        ><text class="muted">{{ r.createdAt.slice(0, 10) }}</text></view
      ><text class="refund__amount">+¥{{ fenToYuan(r.amount) }}</text></view
    ></template
    ></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.summary {
  padding: 38rpx;
  background: linear-gradient(135deg, $primary-dark, $primary);
  color: #fff;
  box-shadow: 0 14rpx 32rpx rgba(7, 136, 59, 0.2);
}
.summary__value {
  display: block;
  font-size: 54rpx;
  font-weight: 900;
  margin-bottom: 8rpx;
}
.summary .muted {
  color: #e8ffed !important;
}
.as-retry {
  padding: 110rpx 30rpx;
  text-align: center;
}
.as-retry__title {
  display: block;
  font-weight: 900;
  color: $primary-dark;
  margin-bottom: 8rpx;
}
.empty,
.case {
  padding: 30rpx;
}
.empty {
  text-align: center;
}
.empty__title {
  display: block;
  font-weight: 900;
  margin-bottom: 8rpx;
}
.case {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 18rpx;
}
.case__title {
  display: block;
  font-weight: 800;
  margin-bottom: 8rpx;
}
.case__status {
  color: $primary-dark;
  background: $primary-soft;
  border-radius: 18rpx;
  padding: 8rpx 14rpx;
  font-weight: 800;
  white-space: nowrap;
}
.refund {
  display: flex;
  justify-content: space-between;
  padding: 24rpx 18rpx;
  background: #fff;
  border-bottom: 2rpx solid $line;
}
.refund:first-of-type {
  border-radius: 24rpx 24rpx 0 0;
}
.refund text {
  display: block;
}
.refund__amount {
  color: $green;
  font-size: 32rpx;
  font-weight: 900;
}
</style>
