<script setup lang="ts">
import { ref } from "vue";
import { businessDate, afterSaleDescription } from "../../utils/businessDisplay";
import { onLoad, onReachBottom, onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { nightApi } from "../../api/night";
import BusinessModeTabs from "../../components/BusinessModeTabs.vue";
import { businessUrl, resolveBusinessType, type BusinessType } from "../../utils/businessContext";
import type { NightOrder } from "../../types/night";
const businessType = ref<BusinessType>('day');
let requestedType: unknown, generation = 0;
const page = ref(1), total = ref(0), refundedAmount = ref(0), loadingMore = ref(false), moreError = ref(false), withdrawing = ref('');
onLoad(query => { requestedType = query?.businessType; });
function selectBusiness(type: BusinessType) { requestedType = type; void load(); }
function openRecord(item: CaseRow) { uni.navigateTo({ url: businessType.value === 'night' ? `/pages/night/order-detail?id=${encodeURIComponent(item.orderId)}` : businessUrl(`/pages/orders/detail?id=${encodeURIComponent(item.orderId)}`, 'day') }); }
async function withdraw(item: CaseRow) {
  if (withdrawing.value) return;
  const result = await uni.showModal({ title: '撤销售后申请', content: '仅撤销尚未审核的申请，已发生的退款不会被取消。', confirmText: '确认撤销' });
  if (!result.confirm) return;
  withdrawing.value = item.id;
  const type = businessType.value;
  try { await (type === 'night' ? nightApi.withdrawAfterSale(item.orderId) : api.cancelAfterSale(item.id)); await load(); }
  catch { /* Request layer displays rejection. */ }
  finally { withdrawing.value = ''; }
}
type CaseRow = Pick<Refund, 'id' | 'orderId' | 'description' | 'reason' | 'createdAt' | 'amount' | 'status'>;
function nightCase(order: NightOrder): CaseRow {
  const request = [...order.timeline].reverse().find(step => step.key === 'after-sale');
  const statuses: Record<string, string> = { requested: 'pending', 'refund-processing': 'refunding', resolved: 'refunded', withdrawn: 'cancelled', rejected: 'rejected' };
  return { id: order.id, orderId: order.id, description: request?.description || order.refund?.reason || '退款记录', reason: '', createdAt: request?.time || order.refund?.createdAt || order.createdAt,
    amount: order.refund?.amount || 0, status: order.refund?.status === 'succeeded' ? 'refunded' : order.refund?.status === 'failed' ? 'failed' : statuses[order.afterSaleStatus || ''] || 'pending' };
}
import { fenToYuan } from "../../utils/money";
import type { Refund } from "../../types";
import { setupDefaultShare } from "../../utils/share";
import { useCampusStore } from "../../stores/campus";
const campusStore = useCampusStore();
setupDefaultShare();
/** Refund 单模型状态 → 中文。 */
const REFUND_STATUS_TEXT: Record<string, string> = {
  pending: "待处理",
  approved: "已批准",
  refunding: "退款中",
  refunded: "已退款",
  rejected: "已拒绝",
  failed: "退款失败",
  cancelled: "已撤销",
};
function statusText(status: string): string {
  return REFUND_STATUS_TEXT[status] ?? status;
}
const refunds = ref<CaseRow[]>([]),
  loading = ref(true),
  error = ref(false);
onShow(() => load());
onReachBottom(() => load(false));
async function load(reset = true) {
  if (!reset && (businessType.value !== 'night' || loading.value || loadingMore.value || refunds.value.length >= total.value)) return;
  const current = reset ? ++generation : generation, identity = uni.getStorageSync('token');
  if (reset) { loading.value = true; error.value = false; } else { loadingMore.value = true; moreError.value = false; }
  try {
    const type = reset ? await resolveBusinessType(requestedType) : businessType.value;
    let rows: CaseRow[], count: number, sum: number, nextPage = 1;
    if (type === 'night') {
      const result = await nightApi.afterSales(reset ? 1 : page.value + 1);
      rows = result.items.map(nightCase); count = result.total; sum = result.refundedAmount; nextPage = result.page;
    } else { rows = await api.refunds(); count = rows.length; sum = rows.filter(row => row.status === 'refunded').reduce((amount, row) => amount + row.amount, 0); }
    if (current !== generation || identity !== uni.getStorageSync('token')) return;
    businessType.value = type; total.value = count; refundedAmount.value = sum; page.value = nextPage;
    const seen = new Set(refunds.value.map(row => row.id));
    refunds.value = reset ? rows : [...refunds.value, ...rows.filter(row => !seen.has(row.id))];
  } catch { if (current === generation) { if (reset) error.value = true; else moreError.value = true; } }
  finally { if (current === generation) { loading.value = false; loadingMore.value = false; } }
}
</script>
<template>
  <view class="page"
    ><BusinessModeTabs :model-value="businessType" :disabled="loading || !!withdrawing" @change="selectBusiness" /><view v-if="error" class="as-retry card" @tap="load()"
      ><text class="as-retry__title">加载失败</text
      ><text class="muted">网络异常，点击重试</text></view
    ><!-- 加载骨架（2026-08-24）：loading 变量早已存在，此处补接线（汇总卡+记录行） --><view
      v-else-if="loading"
      class="as-skeleton"
      ><view class="as-skeleton__summary" /><view class="as-skeleton__row" /><view
        class="as-skeleton__row"
      /></view
    ><template v-else
    ><view class="summary card"
      ><text class="summary__value"
        >¥{{
          fenToYuan(refundedAmount)
        }}</text
      ><text class="muted">累计退款</text></view
    ><!-- 售后福利群（IKQXSD 道哥 2026-10-27）：校区配置了二维码才渲染，
        长按识别进群——品牌绿渐变+卡片浮层质感，与页面清新风格一体 --><view
      v-if="campusStore.afterSalesGroupQrcode"
      class="group-card"
      ><view class="group-card__head"
        ><view class="group-card__badge"></view
        ><view class="group-card__titles"
          ><text class="group-card__title">售后福利群</text
          ><text class="group-card__sub">专属售后通道 · 福利优先享</text></view
        ></view
      ><image
        :src="campusStore.afterSalesGroupQrcode"
        class="group-card__qr"
        mode="aspectFit"
        show-menu-by-longpress
      /><text class="group-card__tip">长按识别二维码 · 加入福利群</text></view
    ><view class="section-title"
      ><text class="section-title__main">售后记录</text></view
    ><view v-if="!refunds.length" class="empty card"
      ><text class="empty__title">还没有售后记录</text
      ><text class="muted">订单送达后，可在订单详情申请质量售后</text></view
    ><view v-for="item in refunds" :key="item.id" class="case card" @tap="openRecord(item)"
      ><view
        ><text class="case__title">{{ afterSaleDescription(item.description || item.reason || "退款申请") }}</text
        ><text class="muted"
          >订单 {{ item.orderId.slice(-8) }} · {{ businessDate(item.createdAt) }}</text
        ></view
      ><view class="case__right"
        ><text class="case__status">{{ statusText(item.status) }}</text
        ><text class="refund__amount">{{ item.amount ? `¥${fenToYuan(item.amount)}` : '金额待审核' }}</text><button v-if="item.status === 'pending'" :disabled="!!withdrawing" @tap.stop="withdraw(item)">{{ withdrawing === item.id ? '撤销中…' : '撤销申请' }}</button></view
      ></view
    ><view v-if="moreError" class="empty" @tap="load(false)">加载失败，点击重试</view><view v-else-if="refunds.length < total" class="empty">{{ loadingMore ? '加载中…' : '上拉查看更多' }}</view></template
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
/* 加载骨架（2026-08-24）：汇总大卡 + 两行记录占位，shimmer 与全端同款 */
.as-skeleton__summary,
.as-skeleton__row {
  border-radius: 24rpx;
  margin-bottom: 20rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: as-pulse 1.2s infinite;
}
.as-skeleton__summary {
  height: 180rpx;
}
.as-skeleton__row {
  height: 130rpx;
}
@keyframes as-pulse {
  50% {
    opacity: 0.55;
  }
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
.case__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10rpx;
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

/* 售后福利群卡片（IKQXSD）：品牌绿渐变头+白底码区浮层，质感对齐页面卡片语言 */
.group-card {
  margin-top: 22rpx;
  background: #fff;
  border-radius: 28rpx;
  box-shadow: 0 8rpx 28rpx rgba(21, 75, 38, 0.07);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 30rpx;
}
.group-card__head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 26rpx 30rpx;
  background: linear-gradient(135deg, $primary-dark, $primary);
  color: #fff;
}
/* 纯 CSS 群徽标（不用 emoji）：圆底双气泡 */
.group-card__badge {
  position: relative;
  width: 44rpx;
  height: 36rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  border-radius: 12rpx;
}
.group-card__badge::after {
  content: "";
  position: absolute;
  right: -10rpx;
  bottom: -6rpx;
  width: 16rpx;
  height: 14rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  border-radius: 6rpx 6rpx 6rpx 2rpx;
  background: linear-gradient(135deg, $primary-dark, $primary);
}
.group-card__titles {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.group-card__title {
  font-size: 30rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}
.group-card__sub {
  font-size: 21rpx;
  opacity: 0.85;
}
.group-card__qr {
  width: 320rpx;
  height: 320rpx;
  margin-top: 30rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(32, 74, 45, 0.08);
}
.group-card__tip {
  margin-top: 18rpx;
  font-size: 22rpx;
  color: $muted;
  letter-spacing: 1rpx;
}
</style>
