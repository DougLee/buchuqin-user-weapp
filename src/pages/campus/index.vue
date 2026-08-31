<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useSessionStore } from "../../stores/session";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
const session = useSessionStore(),
  options = ref<Array<{ id: string; name: string; shortName: string }>>([]),
  busy = ref(false),
  /** 首帧骨架标记：列表空时区分「加载中」与「无校区」 */
  booted = ref(false);
const currentCampusId = computed(() => session.user?.campusId ?? "");
async function refresh() {
  try {
    options.value = await api.campuses();
  } finally {
    booted.value = true;
  }
}
onShow(async () => {
  await session.ensureLogin();
  await refresh();
});
/** 切换确认（IKAJT2）：购物车/默认地址口径随校区切换，先告知再动手 */
async function pick(campus: { id: string; name: string }) {
  if (busy.value) return;
  if (campus.id === currentCampusId.value) {
    uni.showToast({ title: "已是当前校区", icon: "none" });
    return;
  }
  const res = await uni.showModal({
    title: `切换到${campus.name}？`,
    content:
      "商品、价格与起送门槛按校区生效；原校区购物车将清空，收货地址需重新选择。",
    confirmText: "切换",
  });
  if (!res.confirm) return;
  busy.value = true;
  try {
    await session.switchCampus(campus.id);
    // 选校区→选楼栋（IKAJT2 验收链路）：新校区还没有地址就去补楼栋
    const addresses = await api.addresses();
    if (!addresses.length) {
      const go = await uni.showModal({
        title: "还差一步",
        content: "先添加寝室楼栋地址，楼长才知道送到哪。",
        confirmText: "去添加",
        cancelText: "稍后",
      });
      if (go.confirm) {
        uni.redirectTo({ url: "/pages/address/edit" });
        return;
      }
    }
    uni.showToast({ title: "已切换校区", icon: "success" });
    setTimeout(() => uni.navigateBack(), 400);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <view class="page">
    <view class="notice"
      >商品、价格与配送费按校区独立运营，切换后立即生效。</view
    >
    <view v-if="!booted && !options.length" class="campus-skeleton"
      ><view v-for="n in 3" :key="n" class="campus-skeleton__row" />
    </view>
    <view v-else-if="!options.length" class="empty-hint">
      <text class="empty-hint__title">暂无可选校区</text>
      <text class="muted">新校区接入中，敬请期待</text>
    </view>
    <view
      v-for="c in options"
      :key="c.id"
      class="campus card"
      :class="{ 'campus--current': c.id === currentCampusId }"
      @tap="pick(c)"
      ><view class="campus__name"
        ><text>{{ c.name }}</text
        ><text v-if="c.id === currentCampusId" class="tag">当前</text></view
      ><text class="muted">{{ c.shortName }} · 校园仓直达寝室</text></view
    >
  </view>
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.notice {
  background: $primary-soft;
  color: $primary-dark;
  border: 2rpx solid rgba(37, 185, 90, 0.12);
  border-radius: 24rpx;
  padding: 22rpx;
  margin-bottom: 24rpx;
  font-size: 24rpx;
}
.campus {
  padding: 30rpx;
  margin-bottom: 20rpx;
}
.campus--current {
  border: 4rpx solid $primary;
  background: linear-gradient(135deg, #fff, #f5fff6);
}
.campus__name {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 34rpx;
  font-weight: 900;
  margin-bottom: 10rpx;
}
.tag {
  background: $primary;
  color: #fff;
  border-radius: 18rpx;
  padding: 6rpx 14rpx;
  font-size: 20rpx;
  white-space: nowrap;
}
.empty-hint {
  text-align: center;
  padding: 110rpx 0 40rpx;
}
.empty-hint__title {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
  margin-bottom: 12rpx;
}
.campus-skeleton__row {
  height: 140rpx;
  border-radius: 24rpx;
  margin-bottom: 20rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: campus-pulse 1.2s infinite;
}
@keyframes campus-pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
