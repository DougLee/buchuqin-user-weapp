<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow, onUnload } from "@dcloudio/uni-app";
import {
  fetchMiniProgramCampuses,
  finishBootConfirm,
  readBootConfirmContext,
} from "../../utils/bootCampus";
import type { BootCampusOption } from "../../utils/bootCampus";
import { useSessionStore } from "../../stores/session";
import { APP_NAME } from "../../config/app";

/**
 * IKSN19 新用户首启校区确认页（阻断式，无跳过）：
 * 冷启动校区门拉到多校区列表时由门打开；页面展示预选校区 + 大按钮「进入 XX 校区」，
 * 点列表可改选，确认即带所选 campusId 完成微信登录，成功才放行底层挂起的登录等待方。
 * 预选：自然流量为列表第一项；分享链路为分享校区（已下架/非法时门侧已回落第一项）。
 * 失败兜底：登录失败停留本页可重试；未确认离开（iOS 侧滑等）onUnload 放行等待方走
 * 现状静默登录，绝不卡死启动。
 */
const session = useSessionStore();
const options = ref<BootCampusOption[]>([]);
const selectedId = ref("");
const busy = ref(false);
const booted = ref(false);
/** 门带进来的上下文；null=非门路径（极端场景直接复活本页），页面自查列表 */
const gateContext = readBootConfirmContext();
const selectedName = computed(
  () => options.value.find((c) => c.id === selectedId.value)?.name || "",
);
/** 列表装载：门路径直接用门拉到的列表（不再打接口）；自查路径现场拉 */
async function load(list?: BootCampusOption[]) {
  try {
    options.value = list ?? (await fetchMiniProgramCampuses());
    // 无预选或预选不在列表内（已下架）：回落第一项
    if (
      !selectedId.value ||
      !options.value.some((c) => c.id === selectedId.value)
    ) {
      selectedId.value = options.value[0]?.id || "";
    }
  } catch {
    options.value = [];
  } finally {
    booted.value = true;
  }
  // 自查场景单校区：无需确认，直接兜底放行（正常门路径不会进本页）
  if (!gateContext && options.value.length === 1) void confirm();
}
onShow(() => {
  const current = readBootConfirmContext();
  if (current) {
    selectedId.value = current.preselectId;
    void load(current.options);
  } else {
    void load();
  }
});
function pick(id: string) {
  if (busy.value) return;
  selectedId.value = id;
}
/** 确认进入：完成首登（成功才回退放行）；失败停留本页可重试 */
async function confirm() {
  if (busy.value || !selectedId.value) return;
  busy.value = true;
  try {
    await session.confirmFirstLogin(selectedId.value);
    uni.navigateBack({ fail: () => finishBootConfirm("") });
  } catch {
    // request 层已 toast 具体原因；busy 复位等用户再点（重试兜底）
    busy.value = false;
  }
}
/** 自查路径拉取失败的重试：回骨架态重新拉列表 */
function retry() {
  booted.value = false;
  void load();
}
onUnload(() => {
  // 未确认即离开（iOS 侧滑/极端返回）：放行等待方走兜底登录，绝不卡死
  finishBootConfirm("");
});
</script>
<template>
  <view class="page confirm">
    <view class="confirm__head">
      <text class="confirm__title">选择你的校区</text>
      <text class="muted confirm__sub"
        >{{ APP_NAME }} 新人福利与商品价格按校区发放，选对校区才能领到属于你的优惠</text
      >
    </view>
    <view v-if="!booted && !options.length" class="confirm-skeleton">
      <view class="confirm-skeleton__card" />
      <view class="confirm-skeleton__card" />
    </view>
    <template v-else>
      <view v-if="options.length" class="confirm__chosen card">
        <text class="confirm__chosen-label">当前选择</text>
        <text class="confirm__chosen-name">{{
          selectedName || "请选择校区"
        }}</text>
        <text class="muted confirm__chosen-tip">确认后商品、价格与新人券按该校区发放</text>
      </view>
      <button
        v-if="options.length"
        class="primary-btn confirm__go"
        :disabled="busy || !selectedId"
        @tap="confirm"
      >
        {{ busy ? "正在进入…" : `进入${selectedName}校区` }}
      </button>
      <view v-if="options.length > 1" class="confirm__list">
        <text class="confirm__list-title">选错了？点按下方可改选</text>
        <view
          v-for="c in options"
          :key="c.id"
          class="confirm__row card"
          :class="{ 'confirm__row--on': c.id === selectedId }"
          @tap="pick(c.id)"
          ><view class="confirm__row-main"
            ><text class="confirm__row-name">{{ c.name }}</text
            ><text class="muted confirm__row-sub">{{ c.shortName }}</text></view
          ><view
            class="confirm__dot"
            :class="{ 'confirm__dot--on': c.id === selectedId }"
          />
        </view>
      </view>
      <view v-if="booted && !options.length" class="confirm__empty">
        <text class="confirm__empty-title">校区列表加载失败</text>
        <text class="muted confirm__empty-sub">请检查网络后重试</text>
        <button
          class="primary-btn confirm__retry"
          :disabled="busy"
          @tap="retry"
        >
          重新加载
        </button>
      </view>
    </template>
  </view>
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.confirm {
  padding-top: calc(48rpx + env(safe-area-inset-top));
}
.confirm__head {
  padding: 12rpx 6rpx 34rpx;
}
.confirm__title {
  display: block;
  font-size: 44rpx;
  font-weight: 900;
  margin-bottom: 14rpx;
}
.confirm__sub {
  font-size: 26rpx;
  line-height: 1.6;
}
.confirm__chosen {
  padding: 40rpx 34rpx;
  text-align: center;
}
.confirm__chosen-label {
  display: block;
  font-size: 22rpx;
  color: $muted;
  letter-spacing: 4rpx;
  margin-bottom: 16rpx;
}
.confirm__chosen-name {
  display: block;
  font-size: 42rpx;
  font-weight: 900;
  color: $primary-dark;
  margin-bottom: 14rpx;
}
.confirm__chosen-tip {
  font-size: 24rpx;
}
.confirm__go {
  margin-top: 30rpx;
}
.confirm__list {
  margin-top: 52rpx;
}
.confirm__list-title {
  display: block;
  font-size: 24rpx;
  color: $muted;
  margin: 0 2rpx 18rpx;
}
.confirm__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 26rpx 28rpx;
  margin-bottom: 18rpx;
}
.confirm__row--on {
  border: 4rpx solid $primary;
  background: linear-gradient(135deg, #fff, #f5fff6);
}
.confirm__row-main {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.confirm__row-name {
  font-size: 30rpx;
  font-weight: 800;
}
.confirm__row-sub {
  font-size: 22rpx;
}
.confirm__dot {
  flex: none;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  border: 4rpx solid $line;
}
.confirm__dot--on {
  border: 10rpx solid $primary;
}
.confirm__empty {
  text-align: center;
  padding: 90rpx 0 30rpx;
}
.confirm__empty-title {
  display: block;
  font-size: 32rpx;
  font-weight: 900;
  margin-bottom: 10rpx;
}
.confirm__empty-sub {
  display: block;
  font-size: 24rpx;
  margin-bottom: 36rpx;
}
.confirm__retry {
  margin: 0 40rpx;
}
.confirm-skeleton__card {
  height: 220rpx;
  border-radius: 28rpx;
  margin-bottom: 24rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: confirm-pulse 1.2s infinite;
}
@keyframes confirm-pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
