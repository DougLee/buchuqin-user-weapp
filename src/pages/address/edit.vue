<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import type { Building } from "../../types";
const editId = ref(""),
  saving = ref(false),
  buildings = ref<Building[]>([]),
  form = reactive({
    buildingName: "",
    floor: undefined as number | undefined,
    room: "",
    contactName: "",
    phone: "",
  });
const buildingNames = computed(() => buildings.value.map((b) => b.name));
const buildingIndex = computed(() =>
  buildingNames.value.indexOf(form.buildingName),
);
const currentBuilding = computed(() =>
  buildings.value.find((b) => b.name === form.buildingName),
);
const floorPlaceholder = computed(() =>
  currentBuilding.value
    ? `${currentBuilding.value.minFloor}-${currentBuilding.value.maxFloor} 层`
    : "所在楼层",
);
function onBuildingPick(event: { detail: { value: number | string } }) {
  const name = buildingNames.value[Number(event.detail.value)];
  if (name) {
    form.buildingName = name;
    // 换楼栋后原楼层可能越界，交给保存校验提示
  }
}
onLoad(async (q) => {
  editId.value = String(q?.id || "");
  if (editId.value)
    uni.setNavigationBarTitle({ title: "编辑寝室地址" });
  buildings.value = await api.buildings();
  if (!editId.value) return;
  const list = await api.addresses();
  const found = list.find((a) => a.id === editId.value);
  if (!found) return;
  form.buildingName = found.buildingName;
  form.floor = found.floor;
  form.room = found.room;
  form.contactName = found.contactName;
  form.phone = found.phone;
  // 历史地址的楼栋可能不在预设列表（后台调整过楼栋）：补进选项避免选择器显示为空
  if (!buildingNames.value.includes(found.buildingName))
    buildings.value = [
      {
        id: found.buildingId ?? `legacy-${found.buildingName}`,
        name: found.buildingName,
        minFloor: found.floor,
        maxFloor: found.floor,
        hasElevator: false,
        gender: "mixed",
        available: true,
      },
      ...buildings.value,
    ];
});
async function save() {
  const floor = form.floor;
  const range = currentBuilding.value;
  if (
    !form.buildingName ||
    !floor ||
    !form.room ||
    !form.contactName ||
    !/^1\d{10}$/.test(form.phone)
  ) {
    uni.showToast({ title: "请完整填写寝室与手机号", icon: "none" });
    return;
  }
  if (range && (floor < range.minFloor || floor > range.maxFloor)) {
    uni.showToast({
      title: `${range.name} 楼层为 ${range.minFloor}-${range.maxFloor}`,
      icon: "none",
    });
    return;
  }
  saving.value = true;
  try {
    const payload = {
      buildingName: form.buildingName,
      floor,
      room: form.room,
      contactName: form.contactName,
      phone: form.phone,
    };
    const address = editId.value
      ? await api.updateAddress(editId.value, payload)
      : await api.addAddress(payload);
    uni.setStorageSync("selectedAddressId", address.id);
    uni.showToast({
      title: editId.value ? "地址已更新" : "地址已保存并选中",
      icon: "success",
    });
    setTimeout(() => uni.navigateBack(), 500);
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <view class="page"
    ><view class="campus card"
      ><text class="campus__label">配送学校</text
      ><text class="campus__name">湖北工业大学</text
      ><text class="muted">当前试点校园，不可切换</text></view
    ><view class="form card"
      ><label
        ><text>宿舍楼栋</text
        ><picker
          mode="selector"
          :range="buildingNames"
          :value="buildingIndex"
          @change="onBuildingPick"
          ><view class="picker" :class="{ 'picker--empty': !form.buildingName }"
            >{{ form.buildingName || "请选择楼栋" }}<text class="picker__arrow"
              >⌄</text
            ></view
          ></picker
        ></label
      ><label
        ><text>所在楼层</text
        ><input
          v-model.number="form.floor"
          type="number"
          :placeholder="floorPlaceholder" /></label
      ><label
        ><text>寝室号</text
        ><input v-model="form.room" type="number" placeholder="例如：318" /></label
      ><label
        ><text>联系人</text
        ><input v-model="form.contactName" placeholder="你的称呼" /></label
      ><label
        ><text>手机号</text
        ><input
          v-model="form.phone"
          type="number"
          maxlength="11"
          placeholder="用于配送联系" /></label></view
    ><button class="primary-btn" :disabled="saving" @tap="save">
      {{ saving ? "正在保存…" : editId ? "保存修改" : "保存寝室地址" }}
    </button></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.campus,
.form {
  padding: 30rpx;
}
.campus {
  background: linear-gradient(135deg, $primary-soft, #fff);
  border-left: 8rpx solid $primary;
}
.campus__label,
.campus__name {
  display: block;
}
.campus__label {
  color: $primary-dark;
  font-size: 22rpx;
  font-weight: 800;
}
.campus__name {
  font-size: 36rpx;
  font-weight: 900;
  margin: 10rpx 0;
}
.form {
  margin-top: 24rpx;
}
.form label {
  display: block;
  padding: 24rpx 0;
  border-bottom: 2rpx solid $line;
}
.form label:last-child {
  border: none;
}
.form label > text {
  display: block;
  font-size: 23rpx;
  color: #667069;
  margin-bottom: 10rpx;
  font-weight: 700;
}
.form input {
  height: 68rpx;
  font-size: 30rpx;
  font-weight: 700;
}
.picker {
  min-height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 30rpx;
  font-weight: 700;
}
.picker--empty {
  color: $muted;
  font-weight: 400;
}
.picker__arrow {
  color: $primary-dark;
  font-size: 30rpx;
}
.primary-btn {
  margin-top: 34rpx;
}
</style>
