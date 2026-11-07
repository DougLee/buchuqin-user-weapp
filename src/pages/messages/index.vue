<script setup lang="ts">
import { ref } from "vue";
import { onLoad, onReachBottom, onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import type { Notification } from "../../types";
import BusinessModeTabs from "../../components/BusinessModeTabs.vue";
import { businessUrl, resolveBusinessType, type BusinessType } from "../../utils/businessContext";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
const items = ref<Notification[]>([]), loading = ref(true), error = ref(false),
  page = ref(1), total = ref(0), loadingMore = ref(false), moreError = ref(false),
  businessType = ref<BusinessType>("day"), marking = ref(false);
let requestedType: unknown, generation = 0;
onLoad(query => { requestedType = query?.businessType; });
function selectBusiness(type: BusinessType) { requestedType = type; void load(); }
async function load(reset = true) {
  if (!reset && (loading.value || loadingMore.value || items.value.length >= total.value)) return;
  const current = reset ? ++generation : generation;
  const identity = uni.getStorageSync('token');
  if (reset) { loading.value = true; error.value = false; }
  else { loadingMore.value = true; moreError.value = false; }
  try {
    const type = reset ? await resolveBusinessType(requestedType) : businessType.value;
    const result = await api.notificationsPage(reset ? 1 : page.value + 1, 20, type);
    if (current !== generation || identity !== uni.getStorageSync('token')) return;
    const seen = new Set(items.value.map(row => row.id));
    items.value = reset ? result.items : [...items.value, ...result.items.filter(row => !seen.has(row.id))];
    businessType.value = type;
    page.value = result.page;
    total.value = result.total;
  } catch {
    if (current === generation) { if (reset) error.value = true; else moreError.value = true; }
  } finally {
    if (current === generation) { loading.value = false; loadingMore.value = false; }
  }
}
onShow(() => load());
onReachBottom(() => load(false));
async function read(item: Notification) {
  const current = generation;
  try {
    if (!item.read) { await api.readNotification(item.id); if (current !== generation) return; item.read = true; }
    if (item.orderId) uni.navigateTo({ url: item.businessType === 'night'
      ? `/pages/night/order-detail?id=${encodeURIComponent(item.orderId)}`
      : businessUrl(`/pages/orders/detail?id=${encodeURIComponent(item.orderId)}`, 'day') });
  } catch { /* Keep unread state when the server rejects the operation. */ }
}
async function readAll() {
  if (marking.value || !items.value.some(item => !item.read)) return;
  const current = generation, identity = uni.getStorageSync('token');
  marking.value = true;
  try {
    await api.readAllNotifications(businessType.value);
    if (current !== generation || identity !== uni.getStorageSync('token')) return;
    items.value = items.value.map(item => ({ ...item, read: true }));
    uni.showToast({ title: '已全部标为已读', icon: 'success' });
  } catch { /* Preserve state on failure. */ }
  finally { marking.value = false; }
}
function messageTime(iso: string) {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? new Date(time + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : '—';
}
</script>
<template>
  <view class="page"
    ><BusinessModeTabs :model-value="businessType" :disabled="loading || marking" @change="selectBusiness" /><view v-if="error" class="msg-retry card" @tap="load()"
      ><text class="msg-retry__title">消息加载失败</text
      ><text class="muted">网络异常，点击重试</text></view
    ><view v-else-if="loading" class="msg-skeleton"
      ><view v-for="n in 3" :key="n" class="skeleton-block" /></view
    ><template v-else
      ><view v-if="items.length && items.some((i) => !i.read)" class="read-all" role="button" aria-label="全部标为已读" @tap="readAll"
        ><text>全部已读</text></view
      ><view
        v-for="item in items"
        :key="item.id"
        class="message card"
        :class="{ 'message--unread': !item.read }"
        @tap="read(item)"
        ><view class="message__dot" /><view
          ><text class="message__title">{{ item.title }}</text
          ><text class="message__content">{{ item.content }}</text
          ><text class="message__time">{{
            messageTime(item.createdAt)
          }}</text></view
        ></view
      ><view v-if="!items.length" class="empty">暂时没有新消息</view
      ><view v-if="moreError" class="list-foot" @tap="load(false)">加载失败，点击重试</view><view v-else-if="items.length < total" class="list-foot">{{
        loadingMore ? "加载中…" : "上拉加载更多"
      }}</view
      ><view v-else class="list-foot">没有更多了</view
    ></template
    ></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.message {
  display: grid;
  grid-template-columns: 20rpx 1fr;
  gap: 18rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}
.message__dot {
  width: 14rpx;
  height: 14rpx;
  margin-top: 14rpx;
  border-radius: 50%;
  background: $line;
}
.message--unread {
  border-left: 7rpx solid $primary;
  background: linear-gradient(135deg, #f7fff8, #fff);
}
.message--unread .message__dot {
  background: $primary;
  box-shadow: 0 0 0 8rpx rgba(37, 185, 90, 0.12);
}
.message__title,
.message__content,
.message__time {
  display: block;
}
.message__title {
  font-weight: 900;
  font-size: 30rpx;
}
.message__content {
  color: #667069;
  line-height: 1.65;
  margin: 10rpx 0;
}
.message__time {
  font-size: 21rpx;
  color: #667069;
}
.empty {
  text-align: center;
  color: #667069;
  padding: 140rpx 30rpx;
  background: #fff;
  border-radius: 28rpx;
}
.read-all {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 16rpx;
  color: $primary-dark;
  font-size: 24rpx;
  font-weight: 700;
  text {
    padding: 8rpx 0 8rpx 40rpx;
  }
}
.list-foot {
  text-align: center;
  color: $muted;
  font-size: 22rpx;
  padding: 20rpx 0 10rpx;
}
.msg-retry {
  padding: 110rpx 30rpx;
  text-align: center;
}
.msg-retry__title {
  display: block;
  font-weight: 900;
  color: $primary-dark;
  margin-bottom: 8rpx;
}
.msg-skeleton .skeleton-block {
  height: 140rpx;
  border-radius: 28rpx;
  margin-bottom: 20rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: msg-pulse 1.2s infinite;
}
@keyframes msg-pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
