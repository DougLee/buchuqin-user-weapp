<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import type { Address } from "../../types";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
const addresses = ref<Address[]>([]),
  selectedId = ref(""),
  busy = ref(false),
  /** 当前校区名（IKAJT2 去硬编码）：提示条随切换的校区走 */
  campusName = ref(""),
  /** 首次加载标记（2026-08-24 骨架屏）：盖住首帧，「还没有地址」引导不再抢跑 */
  booted = ref(false);
async function refresh() {
  try {
    const [list, campus] = await Promise.allSettled([
      api.addresses(),
      api.currentCampus(),
    ]);
    if (list.status === "fulfilled") {
      addresses.value = list.value;
      selectedId.value =
        uni.getStorageSync("selectedAddressId") ||
        addresses.value[0]?.id ||
        "";
    }
    if (campus.status === "fulfilled") campusName.value = campus.value.name;
  } finally {
    booted.value = true;
  }
}
onShow(refresh);
function select(a: Address) {
  selectedId.value = a.id;
  uni.setStorageSync("selectedAddressId", a.id);
  uni.showToast({ title: "已选为收货寝室", icon: "success" });
  setTimeout(() => uni.navigateBack(), 400);
}
function edit(a: Address) {
  uni.navigateTo({ url: `/pages/address/edit?id=${a.id}` });
}
async function remove(a: Address) {
  const res = await uni.showModal({
    title: "删除这间寝室地址？",
    content: `${a.buildingName} ${a.room}（${a.contactName}）将被移除`,
    confirmText: "删除",
    confirmColor: "#d4380d",
  });
  if (!res.confirm || busy.value) return;
  busy.value = true;
  try {
    await api.deleteAddress(a.id);
    if (selectedId.value === a.id) uni.removeStorageSync("selectedAddressId");
    uni.showToast({ title: "已删除", icon: "success" });
    await refresh();
  } finally {
    busy.value = false;
  }
}
async function makeDefault(a: Address) {
  if (busy.value || a.isDefault) return;
  busy.value = true;
  try {
    await api.setDefaultAddress(a.id);
    uni.showToast({ title: "已设为默认地址", icon: "success" });
    await refresh();
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <view class="page"
    ><view class="notice"
      >当前配送{{ campusName || "所在校区" }}校内寝室</view
    ><!-- 加载骨架（2026-08-24）：地址卡同构占位 --><view
      v-if="!booted && !addresses.length"
      class="addr-skeleton"
      ><view v-for="n in 3" :key="n" class="addr-skeleton__card" /></view
    ><view v-else-if="!addresses.length" class="empty-hint"
      ><text class="empty-hint__title">还没有寝室地址</text
      ><text class="muted">点下方按钮添加一间，楼长才知道送到哪</text></view
    ><view
      v-for="a in addresses"
      :key="a.id"
      class="address card"
      :class="{ 'address--selected': selectedId === a.id }"
      @tap="select(a)"
      ><view class="address__head"
        ><view class="address__title"
          ><text>{{ a.buildingName }} · {{ a.room }} 寝室</text
          ><text v-if="a.isDefault" class="tag tag--default">默认</text
          ><text v-if="selectedId === a.id" class="tag">已选择</text></view
        ></view
      ><text class="muted">{{ a.campusName }} · {{ a.floor }} 楼</text
      ><text class="person">{{ a.contactName }}　{{ a.phone }}</text
      ><view class="address__actions" @tap.stop
        ><text
          v-if="!a.isDefault"
          class="address__action"
          @tap="makeDefault(a)"
          >设为默认</text
        ><text class="address__action" @tap="edit(a)">编辑</text
        ><text class="address__action address__action--danger" @tap="remove(a)"
          >删除</text
        ></view
      ></view
    ><button
      class="primary-btn"
      @tap="uni.navigateTo({ url: '/pages/address/edit' })"
    >
      添加寝室地址</button
    ><view class="help"
      ><text class="help__title">为什么只支持校内地址？</text
      ><text class="muted"
        >商品从{{ campusName || "所在校区" }}的校园仓出发，通过配送员与楼长两段接力，才能送到你的寝室门口。</text
      ></view
    ></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.empty-hint {
  text-align: center;
  padding: 110rpx 0 40rpx;
}
/* 加载骨架（2026-08-24）：与 .address 卡同构，shimmer 与全端同款 */
.addr-skeleton__card {
  height: 252rpx;
  border-radius: 24rpx;
  margin-bottom: 20rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: addr-pulse 1.2s infinite;
}
@keyframes addr-pulse {
  50% {
    opacity: 0.55;
  }
}
.empty-hint__title {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
  margin-bottom: 12rpx;
}
.notice {
  background: $primary-soft;
  color: $primary-dark;
  border: 2rpx solid rgba(37, 185, 90, 0.12);
  border-radius: 24rpx;
  padding: 22rpx;
  margin-bottom: 24rpx;
  font-size: 24rpx;
}
.address {
  padding: 30rpx;
  margin-bottom: 20rpx;
  position: relative;
}
.address--selected {
  border: 4rpx solid $primary;
  background: linear-gradient(135deg, #fff, #f5fff6);
}
.address__head {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  font-size: 34rpx;
  font-weight: 900;
  margin-bottom: 12rpx;
}
.address__title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}
.tag {
  background: $primary;
  color: #fff;
  border-radius: 18rpx;
  padding: 6rpx 14rpx;
  font-size: 20rpx;
  white-space: nowrap;
}
.tag--default {
  background: #ff7a1a;
}
.person {
  display: block;
  margin-top: 22rpx;
  font-weight: 700;
}
.address__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10rpx;
  margin-top: 22rpx;
  padding-top: 20rpx;
  border-top: 2rpx dashed $line;
}
/* 操作热区（IK9AWL）：文字链升级为 ≥88rpx 命中块，避免误触相邻操作 */
.address__action {
  min-width: 128rpx;
  min-height: 88rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 25rpx;
  font-weight: 700;
  color: $primary-dark;
}
.address__action--danger {
  color: #d4380d;
}
.primary-btn {
  margin-top: 32rpx;
}
.help {
  margin-top: 48rpx;
  padding: 26rpx;
  background: #fff;
  border-radius: 24rpx;
}
.help__title {
  display: block;
  font-weight: 900;
  margin-bottom: 14rpx;
}
</style>
