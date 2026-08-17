<script setup lang="ts">
import { ref } from "vue";
import { onReachBottom, onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import type { Notification } from "../../types";
const items = ref<Notification[]>([]),
  loading = ref(true),
  error = ref(false),
  page = ref(1),
  total = ref(0),
  loadingMore = ref(false);
async function load(reset = true) {
  if (reset) {
    loading.value = true;
    page.value = 1;
  }
  error.value = false;
  try {
    const res = await api.notificationsPage(page.value);
    items.value = reset ? res.items : [...items.value, ...res.items];
    total.value = res.total;
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}
onShow(() => load());
onReachBottom(async () => {
  if (loadingMore.value || loading.value || error.value) return;
  if (items.value.length >= total.value) return;
  loadingMore.value = true;
  try {
    page.value += 1;
    await load(false);
  } finally {
    loadingMore.value = false;
  }
});
async function read(item: Notification) {
  if (!item.read) {
    await api.readNotification(item.id);
    item.read = true;
  }
}
/** 全部已读（IK9AWO）：POST /notifications/read-all 后本地全标 */
async function readAll() {
  if (!items.value.some((item) => !item.read)) return;
  await api.readAllNotifications();
  items.value = items.value.map((item) => ({ ...item, read: true }));
  uni.showToast({ title: "已全部标为已读", icon: "success" });
}
</script>
<template>
  <view class="page"
    ><view v-if="error" class="msg-retry card" @tap="load()"
      ><text class="msg-retry__title">消息加载失败</text
      ><text class="muted">网络异常，点击重试</text></view
    ><view v-else-if="loading" class="msg-skeleton"
      ><view v-for="n in 3" :key="n" class="skeleton-block" /></view
    ><template v-else
      ><view v-if="items.length && items.some((i) => !i.read)" class="read-all"
        ><text @tap="readAll">全部已读</text></view
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
            item.createdAt.slice(0, 16).replace("T", " ")
          }}</text></view
        ></view
      ><view v-if="!items.length" class="empty">暂时没有新消息</view
      ><view v-else-if="items.length < total" class="list-foot">{{
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
