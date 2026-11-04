<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { isRetryable } from "../../api/request";
import { nightApi } from "../../api/night";
import { useSessionStore } from "../../stores/session";
import type { NightStoreRow } from "../../types/night";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();

/**
 * 夜宵楼栋选择页（IKSW1F）：当前校区 → 本校区楼栋夜宵店列表（三态徽章）。
 * - 历史选择预填：storage nightBuildingId 高亮 +「上次去过」标记；
 * - 分享深链 ?buildingId=：高亮 +「来自分享」提示，接收者仍需点选确认本楼；
 * - 三态：营业中可进店；休息中可进店浏览（禁下单）；无楼长=招募中不可进店。
 */
const session = useSessionStore();
const stores = ref<NightStoreRow[]>([]);
const campusName = ref("");
/** 场次态（营业窗口外进店只能浏览） */
const sessionInfo = ref<NightStoreRow["session"]>();
const loading = ref(true);
const error = ref(false);
/** 历史选择/分享落点的楼栋 id（预填高亮） */
const prefillBuildingId = ref("");
/** 预填来源文案（上次去过 / 来自分享） */
const prefillTag = ref("");
/** 历史选择 storage 键：选完楼栋写回，下次进页预填 */
const LAST_BUILDING_KEY = "nightBuildingId";

const prefillRow = computed(() =>
  stores.value.find((b) => b.buildingId === prefillBuildingId.value),
);

async function load() {
  loading.value = true;
  error.value = false;
  try {
    const [entry, list] = await Promise.all([
      nightApi.entry(),
      nightApi.stores(),
    ]);
    campusName.value = entry.campusName;
    sessionInfo.value = {
      nightEnabled: entry.nightEnabled,
      inWindow: entry.inWindow,
      dayClosed: entry.dayClosed,
      inNightSession: entry.inNightSession,
      nightStartAt: entry.nightStartAt,
      nightEndAt: entry.nightEndAt,
    };
    stores.value = list.stores;
  } catch (e) {
    // ADR-0005：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
    if (isRetryable(e)) error.value = true;
  } finally {
    loading.value = false;
  }
}
onLoad((q) => {
  // 分享深链（店铺/商品分享带店铺参数 → 落本页过楼栋确认）：
  // buildingId 高亮预填，用户点选才算确认进店
  const shared = String(q?.buildingId || "");
  if (shared) {
    prefillBuildingId.value = shared;
    prefillTag.value = "来自分享";
  }
});
onShow(() => {
  void session.ensureLogin().catch(() => {});
  // 无分享参数时读历史选择（分享优先级更高，不覆盖）
  if (!prefillBuildingId.value) {
    const last = String(uni.getStorageSync(LAST_BUILDING_KEY) || "");
    if (last) {
      prefillBuildingId.value = last;
      prefillTag.value = "上次去过";
    }
  }
  load();
});
/** 状态徽章文案/样式键 */
function stateText(row: NightStoreRow): string {
  if (row.state === "open") return "营业中";
  if (row.state === "resting") return "休息中";
  return "招募楼长中";
}
function pick(row: NightStoreRow) {
  // 无楼长=该楼店未开张，不可进店
  if (row.state === "no-manager" || !row.storeId) {
    uni.showToast({ title: "本楼夜宵店招募楼长中，敬请期待", icon: "none" });
    return;
  }
  uni.setStorageSync(LAST_BUILDING_KEY, row.buildingId);
  uni.navigateTo({
    url: `/pages/night/store?storeId=${row.storeId}&buildingId=${row.buildingId}`,
  });
}
/** 夜宵订单列表（与白天订单页隔离） */
function goOrders() {
  uni.navigateTo({ url: "/pages/night/orders" });
}
</script>

<template>
  <view class="page"
    ><view class="head"
      ><text class="head__title">🌙 夜宵店</text
      ><text v-if="campusName" class="head__campus">{{ campusName }}</text
      ><text class="head__orders" @tap="goOrders">我的夜宵单</text></view
    ><view v-if="sessionInfo && !sessionInfo.inNightSession" class="window-tip"
      ><text
        >夜宵场次
        {{ sessionInfo.nightStartAt || "--:--" }}~{{
          sessionInfo.nightEndAt || "--:--"
        }}；当前不在场次窗口内，可先逛店，营业中才可下单</text
      ></view
    ><view
      v-if="prefillRow && prefillTag"
      class="prefill-tip"
      @tap="pick(prefillRow)"
      ><text class="prefill-tip__badge">{{ prefillTag }}</text
      ><text class="prefill-tip__name"
        >{{ prefillRow.buildingName }} · {{ stateText(prefillRow) }}</text
      ><text class="prefill-tip__go">进入</text></view
    ><view v-if="error" class="retry card" @tap="load"
      ><text class="retry__title">加载失败</text
      ><text class="muted">网络异常，点击重试</text></view
    ><view v-else-if="loading" class="skeleton"
      ><view v-for="n in 4" :key="n" class="skeleton__row" /></view
    ><view v-else-if="!stores.length" class="empty"
      ><text class="empty__mark">🌙</text
      ><text class="empty__title">本校区还没有夜宵店</text
      ><text class="muted">开通后这里会亮起来</text></view
    ><template v-else
    ><view
      v-for="row in stores"
      :key="row.buildingId"
      class="store card"
      :class="{
        'store--open': row.state === 'open',
        'store--prefill': row.buildingId === prefillBuildingId,
        'store--dim': row.state === 'no-manager',
      }"
      role="button"
      @tap="pick(row)"
      ><view class="store__head"
        ><text class="store__name">{{ row.buildingName }}</text
        ><text class="store__state" :class="`store__state--${row.state}`">{{
          stateText(row)
        }}</text></view
      ><text class="muted store__meta"
        >{{
          row.state === "no-manager"
            ? "虚位以待，欢迎报名楼长"
            : row.state === "open"
              ? "楼长营业中 · 零食送到寝室"
              : row.managerName
                ? `楼长 ${row.managerName} · 开门时间以店内为准`
                : "楼长休息中 · 可先浏览商品"
        }}</text
      ></view
    ></template
    ></view
  >
</template>

<style scoped lang="scss">
@import "../../styles/theme.scss";
.head {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  padding: 8rpx 4rpx 22rpx;
}
.head__title {
  font-size: 40rpx;
  font-weight: 900;
  color: $primary-dark;
}
.head__campus {
  font-size: 24rpx;
  color: $muted;
  font-weight: 700;
}
.head__orders {
  margin-left: auto;
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  background: $primary-soft;
  color: $primary-dark;
  font-size: 22rpx;
  font-weight: 800;
}
/* 场次窗口外提示：浅夜色底，说明可浏览不可下单 */
.window-tip {
  background: #f2f4f2;
  border: 2rpx solid rgba(30, 37, 32, 0.1);
  border-radius: 20rpx;
  padding: 18rpx 24rpx;
  font-size: 22rpx;
  color: #566159;
  line-height: 1.6;
  margin-bottom: 20rpx;
}
/* 历史选择/分享预填条：一眼回到上次那栋楼 */
.prefill-tip {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  background: linear-gradient(120deg, #1e2520, #17332a);
  box-shadow: 0 8rpx 22rpx rgba(10, 34, 24, 0.22);
  margin-bottom: 20rpx;
}
.prefill-tip__badge {
  flex-shrink: 0;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 224, 130, 0.18);
  border: 2rpx solid rgba(255, 224, 130, 0.45);
  color: #ffe082;
  font-size: 20rpx;
  font-weight: 700;
}
.prefill-tip__name {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  font-weight: 800;
  color: #fff;
}
.prefill-tip__go {
  flex-shrink: 0;
  font-size: 22rpx;
  font-weight: 800;
  color: #ffe082;
}
.retry {
  padding: 90rpx 30rpx;
  text-align: center;
}
.retry__title {
  display: block;
  font-weight: 900;
  color: $primary-dark;
  margin-bottom: 8rpx;
}
.skeleton {
  padding-top: 6rpx;
}
.skeleton__row {
  height: 150rpx;
  border-radius: 28rpx;
  margin-bottom: 20rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: night-pulse 1.2s infinite;
}
@keyframes night-pulse {
  50% {
    opacity: 0.55;
  }
}
.empty {
  text-align: center;
  padding-top: 140rpx;
}
.empty__mark {
  display: flex;
  width: 160rpx;
  height: 160rpx;
  margin: auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #1e2520;
  font-size: 60rpx;
}
.empty__title {
  display: block;
  font-size: 36rpx;
  font-weight: 900;
  margin: 40rpx 0 10rpx;
}
.store {
  padding: 30rpx;
  margin-bottom: 20rpx;
}
/* 营业中：品牌绿描边强调 */
.store--open {
  border: 3rpx solid rgba(37, 185, 90, 0.4);
  background: linear-gradient(135deg, $primary-soft, #fff);
}
/* 分享/历史预填：夜色描边呼应横幅 */
.store--prefill {
  border: 3rpx solid rgba(30, 37, 32, 0.35);
}
/* 招募中降透明度 */
.store--dim {
  opacity: 0.68;
}
.store__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.store__name {
  font-size: 34rpx;
  font-weight: 900;
}
.store__state {
  flex-shrink: 0;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
  font-weight: 800;
}
.store__state--open {
  background: $primary;
  color: #fff;
}
.store__state--resting {
  background: $cream;
  color: #8a5a1e;
}
.store__state--no-manager {
  background: $paper;
  border: 2rpx solid $line;
  color: $muted;
}
.store__meta {
  display: block;
  margin-top: 12rpx;
  font-size: 23rpx;
}
</style>
