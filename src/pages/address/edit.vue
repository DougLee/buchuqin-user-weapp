<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import type { Building, Room } from "../../types";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
const editId = ref(""),
  saving = ref(false),
  buildings = ref<Building[]>([]),
  /** 配送学校名（IKAJT2 去硬编码）：接口下发 */
  campusName = ref(""),
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
/** 三级联动（套餐A）数据源：当前楼栋全部房间一次拉回，前端按层分组 */
const allRooms = ref<Room[]>([]);
/** 房间列表是否已就位（区分「没录数据」与「还没拉到」） */
const roomsLoaded = ref(false);
/** 该楼有数据的楼层集合（升序）：枚举不到的层不出现 */
const floors = computed(() =>
  [...new Set(allRooms.value.map((r) => r.floor))].sort((a, b) => a - b),
);
const floorLabels = computed(() => floors.value.map((f) => `${f} 层`));
const floorIndex = computed(() => floors.value.indexOf(form.floor ?? -1));
/** 已选楼层的寝室号列表 */
const floorRooms = computed(() =>
  allRooms.value.filter((r) => r.floor === form.floor).map((r) => r.roomNo),
);
/** 寝室号模糊筛选（2026-09-08 道哥）：房间多时输入数字即过滤，
 *  点选落值——值恒来自已录入列表，不破坏后端寝室校验 */
const roomQuery = ref("");
const roomDropdown = ref(false);
const filteredRooms = computed(() => {
  const q = roomQuery.value.trim();
  if (!q) return floorRooms.value;
  return floorRooms.value.filter((r) => r.includes(q));
});
// form.room 是唯一事实源（含编辑回填/切楼层清空），输入框文案随之同步
watch(
  () => form.room,
  (v) => (roomQuery.value = v || ""),
);
function onRoomInput(event: InputEvent) {
  // uni 类型把 InputEvent.detail 收窄为 number（旧接口）——运行时是 { value }
  roomQuery.value = (event.detail as unknown as { value: string }).value;
  roomDropdown.value = true;
}
function onRoomBlur() {
  // 延时收起：给下拉项的 tap 留出触发窗口（blur 先于 tap 的平台行为）
  setTimeout(() => (roomDropdown.value = false), 180);
}
function pickRoom(room: string) {
  form.room = room;
  roomAnchor = roomKey(currentBuilding.value?.id, form.floor);
  roomDropdown.value = false;
}
/** 真实楼栋但没录寝室数据：出提示、楼层/寝室置灰、禁保存（套餐A） */
const noRoomData = computed(() => {
  const building = currentBuilding.value;
  return (
    !!building &&
    !building.id.startsWith("legacy-") &&
    roomsLoaded.value &&
    allRooms.value.length === 0
  );
});
/** 楼栋id → 全楼房间缓存：来回切楼不重复请求 */
const roomsByBuilding = new Map<string, Room[]>();
/** 已选寝室号所属的「楼栋id:楼层」锚点：与当前组合不符才清空寝室号，
 *  避免编辑旧地址回填时被 watcher 误清 */
let roomAnchor = "";
function roomKey(buildingId: string | undefined, floor: number | undefined) {
  return `${buildingId || ""}:${floor ?? ""}`;
}
/** 拉当前楼栋全部房间。legacy 伪楼栋（历史地址，后台无此楼）跳过；
 *  接口 silent：空列表按「未录入」处理，失败同（换楼栋可重试） */
async function loadBuildingRooms() {
  const building = currentBuilding.value;
  if (!building || building.id.startsWith("legacy-")) {
    allRooms.value = [];
    roomsLoaded.value = false;
    return;
  }
  const cached = roomsByBuilding.get(building.id);
  if (cached) {
    allRooms.value = cached;
    roomsLoaded.value = true;
    return;
  }
  allRooms.value = [];
  roomsLoaded.value = false;
  try {
    const list = await api.buildingRooms(building.id);
    // 响应期间楼栋可能又变了：过期响应直接丢弃
    if (currentBuilding.value?.id !== building.id) return;
    roomsByBuilding.set(building.id, list);
    allRooms.value = list;
    roomsLoaded.value = true;
  } catch {
    /* 静默：按未录入处理 */
  }
}
// 楼栋变化：重拉房间分组
watch(() => currentBuilding.value?.id, loadBuildingRooms);
// 楼层/楼栋组合变化：已选寝室号不属于新组合时清空（回填锚点保护）
watch(
  () => roomKey(currentBuilding.value?.id, form.floor),
  (key) => {
    if (roomAnchor !== key) form.room = "";
  },
);
function onFloorPick(event: { detail: { value: number | string } }) {
  const floor = floors.value[Number(event.detail.value)];
  if (floor !== undefined) form.floor = floor;
}
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
  const [buildingRes, campusRes] = await Promise.allSettled([
    api.buildings(),
    api.currentCampus(),
  ]);
  if (buildingRes.status === "fulfilled") buildings.value = buildingRes.value;
  if (campusRes.status === "fulfilled") campusName.value = campusRes.value.name;
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
  // IKD6FH：回填的寝室号锚定到「楼栋+楼层」，watcher 首次触发时才不会误清
  roomAnchor = roomKey(currentBuilding.value?.id, form.floor);
});
async function save() {
  const floor = form.floor;
  const building = currentBuilding.value;
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
  // 套餐A：真实楼栋的楼层/寝室必须是枚举值（楼未录数据在下面先拦）；
  // legacy 旧地址不动就不碰，跳过枚举校验
  if (building && !building.id.startsWith("legacy-")) {
    if (noRoomData.value) {
      uni.showToast({ title: `${building.name} 寝室数据未录入`, icon: "none" });
      return;
    }
    if (
      roomsLoaded.value &&
      (!floors.value.includes(floor) || !floorRooms.value.includes(form.room))
    ) {
      uni.showToast({ title: "请重新选择楼层与寝室号", icon: "none" });
      return;
    }
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
      ><text class="campus__name">{{
        campusName || "当前校区"
      }}</text
      ><text class="muted">配送范围为校内寝室，可在「我的-当前校区」切换</text></view
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
        ><text v-if="noRoomData" class="warn"
          >该楼栋寝室数据未录入，请换楼栋或联系管理员</text
        ></label
      ><label
        ><text>所在楼层</text
        ><picker
          mode="selector"
          :range="floorLabels"
          :value="floorIndex"
          :disabled="!floors.length"
          @change="onFloorPick"
          ><view class="picker" :class="{ 'picker--empty': !form.floor }"
            >{{ form.floor ? form.floor + " 层" : "请选择楼层"
            }}<text class="picker__arrow">⌄</text></view
          ></picker
        ></label
      ><label
        ><text>寝室号</text
        ><!-- 2026-09-08 道哥：房间多，滚轮改输入即筛选——值恒来自已录入列表 -->
        <view class="room-select">
          <input
            class="room-input"
            :class="{ 'picker--empty': !form.room }"
            :value="roomQuery"
            :placeholder="
              floorRooms.length
                ? '输入数字筛选，如 6'
                : '请先选择楼栋与楼层'
            "
            placeholder-class="room-input__ph"
            :disabled="!floorRooms.length"
            @input="onRoomInput"
            @focus="roomDropdown = true"
            @blur="onRoomBlur"
          />
          <scroll-view
            v-if="roomDropdown && floorRooms.length"
            scroll-y
            class="room-dropdown"
          >
            <view
              v-for="room in filteredRooms"
              :key="room"
              class="room-option"
              @tap="pickRoom(room)"
              >{{ room }}</view
            >
            <view v-if="!filteredRooms.length" class="room-option room-option--empty"
              >无匹配寝室，换个数字试试</view
            >
          </scroll-view>
        </view>
      </label
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
    ><button class="primary-btn" :disabled="saving || noRoomData" @tap="save">
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
.room-select {
  position: relative;
}
.room-input {
  min-height: 68rpx;
  width: 100%;
  font-size: 30rpx;
  font-weight: 700;
  color: $ink;
}
.room-input__ph {
  color: $muted;
  font-weight: 400;
}
.room-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  max-height: 420rpx;
  margin-top: 8rpx;
  background: #fff;
  border: 2rpx solid rgba(32, 74, 45, 0.12);
  border-radius: 16rpx;
  box-shadow: 0 12rpx 30rpx rgba(21, 75, 38, 0.12);
}
.room-option {
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
}
.room-option:active {
  background: $primary-soft;
}
.room-option--empty {
  color: $muted;
  font-weight: 400;
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
.warn {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #e64340;
  font-weight: 600;
}
</style>
