<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useSessionStore } from "../../stores/session";
import type { Building, RecruitingApplication } from "../../types";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
/**
 * 楼长招募报名页（IKEAGE，2026-09-09 道哥定稿「高级简洁」重设计）：
 * 纯 CSS 浅绿渐变打底（无图片背景，永无接缝）；横幅为圆角卡片；
 * 权益四列白卡上浮叠横幅；表单横排字段；橙色 CTA 点睛。
 * 报名页即进度页——首访表单（校区自由选、楼栋联动、手机号预填授权号）；
 * 在途显示进度；被拒显示原因可重报；通过显示工号 + 骑手小程序登录指引。
 * 身份证不采集（后台补录）。
 */
const session = useSessionStore();
const loading = ref(true),
  app = ref<RecruitingApplication | null>(null),
  campuses = ref<Array<{ id: string; name: string; shortName: string }>>([]),
  buildings = ref<Building[]>([]),
  submitting = ref(false),
  /** rejected 后的「重新报名」：置 true 回到表单态（保留上次填写） */
  reapplying = ref(false),
  /** 审核前修改报名（IKEAGE）：pending/interviewing 回填表单走 PATCH */
  editing = ref(false);
const form = reactive({
  campusId: "",
  buildingId: "",
  name: "",
  phone: "",
  note: "",
});
const campusName = computed(
  () => campuses.value.find((c) => c.id === form.campusId)?.name ?? "",
);
const buildingName = computed(
  () => buildings.value.find((b) => b.id === form.buildingId)?.name ?? "",
);
/** 页面态：表单（无在途 / 被拒 / 审核前点「修改」）或进度卡 */
const showForm = computed(
  () =>
    !app.value ||
    app.value.status === "rejected" ||
    ((app.value.status === "pending" ||
      app.value.status === "interviewing") &&
      editing.value),
);
/** 进入编辑：回填当前报名数据，楼栋列表随校区联动 */
async function enterEdit() {
  if (!app.value) return;
  form.campusId = app.value.campusId;
  form.buildingId = app.value.buildingId;
  form.name = app.value.name;
  form.phone = app.value.phone;
  form.note = app.value.note;
  editing.value = true;
  await loadBuildings();
}
function cancelEdit() {
  editing.value = false;
}
const statusText = computed(() => {
  switch (app.value?.status) {
    case "pending":
      return "已收到报名";
    case "interviewing":
      return "面试沟通中";
    default:
      return "";
  }
});
onShow(async () => {
  try {
    await session.ensureLogin();
    const [mine, cs] = await Promise.allSettled([
      api.recruitApplication(),
      api.campuses(),
    ]);
    if (mine.status === "fulfilled") app.value = mine.value;
    if (cs.status === "fulfilled") {
      campuses.value = cs.value;
      // 默认当前校区（可自由改选，道哥拍板）
      if (!form.campusId)
        form.campusId =
          cs.value.find((c) => c.id === session.user?.campusId)?.id ??
          cs.value[0]?.id ??
          "";
    }
    // 首访表单预填：授权手机号；楼栋随校区联动加载
    if (!form.phone) form.phone = session.user?.phone ?? "";
    if (showForm.value && form.campusId) await loadBuildings();
  } finally {
    loading.value = false;
  }
});
async function loadBuildings() {
  if (!form.campusId) return;
  try {
    buildings.value = await api.buildings(form.campusId);
  } catch {
    buildings.value = [];
  }
  // 换校区后原楼栋不再属于新校区
  if (!buildings.value.some((b) => b.id === form.buildingId))
    form.buildingId = "";
}
function onCampusPick(e: { detail: { value: number | string } }) {
  const c = campuses.value[Number(e.detail.value)];
  if (!c || c.id === form.campusId) return;
  form.campusId = c.id;
  void loadBuildings();
}
function onBuildingPick(e: { detail: { value: number | string } }) {
  const b = buildings.value[Number(e.detail.value)];
  if (b) form.buildingId = b.id;
}
async function submit() {
  if (submitting.value) return;
  if (!form.name.trim()) {
    uni.showToast({ title: "请填写姓名", icon: "none" });
    return;
  }
  if (!/^1\d{10}$/.test(form.phone.trim())) {
    uni.showToast({ title: "手机号格式不正确", icon: "none" });
    return;
  }
  if (!form.campusId || !form.buildingId) {
    uni.showToast({ title: "请选择校区和楼栋", icon: "none" });
    return;
  }
  submitting.value = true;
  try {
    const body = {
      campusId: form.campusId,
      buildingId: form.buildingId,
      name: form.name.trim(),
      phone: form.phone.trim(),
      note: form.note.trim() || undefined,
    };
    app.value = editing.value
      ? await api.recruitUpdate(body)
      : await api.recruitApply(body);
    const doneText = editing.value ? "已保存" : "报名成功";
    editing.value = false;
    reapplying.value = false;
    uni.showToast({ title: doneText, icon: "success" });
  } catch {
    /* 业务原因 request 层已 toast（在途拦截等） */
  } finally {
    submitting.value = false;
  }
}
</script>
<template>
  <view class="page recruit">
    <!-- 双背景图（道哥 2026-09-09 定稿）：#77 横幅背景贴顶、#78 波浪品牌
         背景贴底（.recruit 三层 background），中段同源底色衔接；
         内容 padding-top 让位顶部背景，一屏呈现 -->
    <!-- 权益四列 -->
    <view class="perks card">
      <view class="perk">
        <view class="perk__ico"><text>时</text></view>
        <text class="perk__title">时间自由</text>
        <text class="perk__desc">灵活安排</text>
      </view>
      <view class="perk">
        <view class="perk__ico"><text>佣</text></view>
        <text class="perk__title">佣金奖励</text>
        <text class="perk__desc">多劳多得</text>
      </view>
      <view class="perk">
        <view class="perk__ico"><text>福</text></view>
        <text class="perk__title">专属福利</text>
        <text class="perk__desc">不定期惊喜</text>
      </view>
      <view class="perk">
        <view class="perk__ico"><text>楼</text></view>
        <text class="perk__title">服务本楼栋</text>
        <text class="perk__desc">同学更便利</text>
      </view>
    </view>

    <!-- 表单态：首访报名 / 被拒重报 -->
    <view v-if="loading" class="card form-card">
      <view v-for="n in 4" :key="n" class="skeleton-row" />
    </view>
    <view v-else-if="showForm" class="card form-card">
      <view class="form-card__head">
        <text class="form-card__title">{{
          editing ? "修改报名信息" : "楼长报名信息"
        }}</text>
        <text class="form-card__hint">{{
          editing ? "审核通过前可随时修改" : "期待优秀的你加入"
        }}</text>
      </view>
      <view class="field">
        <text class="field__label">姓名<text class="field__req"> *</text></text>
        <input
          v-model="form.name"
          class="field__control"
          placeholder="真实姓名"
          placeholder-class="field__placeholder"
          maxlength="20"
        />
      </view>
      <view class="field">
        <text class="field__label"
          >手机号<text class="field__req"> *</text></text
        >
        <input
          v-model="form.phone"
          class="field__control"
          type="number"
          placeholder="保持畅通，方便联系"
          placeholder-class="field__placeholder"
          maxlength="11"
        />
      </view>
      <view class="field">
        <text class="field__label">学校<text class="field__req"> *</text></text>
        <picker
          class="field__picker"
          mode="selector"
          :range="campuses.map((c) => c.name)"
          @change="onCampusPick"
        >
          <view class="field__control field__control--select">
            <text :class="{ field__placeholder: !campusName }">{{
              campusName || "选择学校"
            }}</text>
            <text class="field__arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="field">
        <text class="field__label"
          >宿舍楼<text class="field__req"> *</text></text
        >
        <picker
          class="field__picker"
          mode="selector"
          :range="buildings.map((b) => b.name)"
          @change="onBuildingPick"
        >
          <view class="field__control field__control--select">
            <text :class="{ field__placeholder: !buildingName }">{{
              buildingName || "选择楼栋"
            }}</text>
            <text class="field__arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="field field--top">
        <text class="field__label">自我介绍</text>
        <view class="field__area-wrap">
          <textarea
            v-model="form.note"
            class="field__area"
            placeholder="选填：空闲时间、相关经验等"
            placeholder-class="field__placeholder"
            maxlength="200"
          />
          <text class="field__count">{{ form.note.length }}/200</text>
        </view>
      </view>
      <button class="cta" :disabled="submitting" @tap="submit">
        {{ submitting ? "提交中…" : editing ? "保存修改" : "提交报名" }}
      </button>
      <text v-if="editing" class="cancel-edit" @tap="cancelEdit">取消修改</text>
      <text v-if="app?.status === 'rejected'" class="rejected-tip"
        >上次报名未通过：{{
          app.rejectReason || "未通过"
        }}，可调整后重新报名</text
      >
    </view>

    <!-- 进度态：审核中 / 面试中 -->
    <view v-else-if="app" class="card form-card status-card">
      <view class="status-dot" />
      <text class="status-card__title">{{ statusText }}</text>
      <text class="status-card__info"
        >{{ campusName || "报名校区" }} · {{ app.buildingName }}</text
      >
      <view class="steps">
        <view class="step step--done">
          <text class="step__no">1</text>
          <text>提交报名</text>
        </view>
        <view
          class="step"
          :class="{ 'step--done': app.status === 'interviewing' }"
        >
          <text class="step__no">2</text>
          <text>运营联系</text>
        </view>
        <view class="step">
          <text class="step__no">3</text>
          <text>面试上岗</text>
        </view>
      </view>
      <text class="status-card__hint">保持手机畅通，运营同学会联系你</text>
      <!-- IKEAGE：审核前可修改报名信息（回填表单走 PATCH） -->
      <view class="status-card__actions">
        <button class="edit-btn" :disabled="submitting" @tap="enterEdit">
          修改报名信息
        </button>
      </view>
    </view>

    <!-- 通过态：工号 + 上岗指引 -->
    <view v-if="app?.status === 'approved'" class="card form-card pass-card">
      <view class="pass-card__badge">已通过</view>
      <text class="pass-card__title">恭喜，成为实习楼长</text>
      <view class="pass-card__no">
        <text class="pass-card__no-label">你的工号</text>
        <text class="pass-card__no-value">{{ app.staffNo || "见短信" }}</text>
      </view>
      <view class="pass-card__guide">
        <text>1. 打开微信，搜索「不出寝食社配送」小程序</text>
        <text>2. 使用工号 + 姓名 登录</text>
        <text>3. 开始接单，收入实时可查</text>
      </view>
    </view>
  </view>
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
/* 双背景图（道哥 2026-09-09 定稿）：#77 横幅贴顶 + #78 波浪品牌贴底，
   中段纯色 #d9f9e8 与两图底色同源无缝；100% 宽时两图各显示高 ~59vw，
   padding-top 56vw 让位顶部背景（权益卡轻压其下沿 3vw 层次） */
.recruit {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 56vw 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background:
    url("https://static.buchuqin.com/app/public/recruit-banner-v3.webp") center
      top / 100% auto no-repeat,
    url("https://static.buchuqin.com/app/public/recruit-bg-bottom-v1.webp")
      center bottom / 100% auto no-repeat,
    linear-gradient(180deg, #d9f9e8 0%, #ddf9ea 100%);
}
/* 权益四列：白卡上浮压顶部背景下沿形成层次 */
.perks {
  position: relative;
  z-index: 2;
  margin: -150rpx 8rpx 0 8rpx;
  padding: 20rpx 8rpx;
  border-radius: 20rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4rpx;
  box-shadow: 0 10rpx 30rpx rgba(31, 122, 68, 0.08);
}
.perk {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6rpx;
}
.perk__ico {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #e8f8ef;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4rpx;
}
.perk__ico text {
  font-size: 24rpx;
  font-weight: 900;
  color: #159c55;
}
.perk__title {
  font-size: 23rpx;
  font-weight: 800;
  color: $ink;
}
.perk__desc {
  font-size: 18rpx;
  color: #8a958e;
}
/* 卡片基准：白底大圆角，统一投影（高级感核心=少而轻的阴影） */
.card {
  background: #fff;
  border-radius: 24rpx;
}
/* 表单卡 */
.form-card {
  margin-top: 20rpx;
  padding: 30rpx;
}
.form-card__head {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
  margin-bottom: 10rpx;
}
.form-card__title {
  font-size: 32rpx;
  font-weight: 900;
  color: $ink;
}
.form-card__hint {
  font-size: 21rpx;
  color: #8a958e;
}
/* 横排字段：左标签右控件，无边框浅灰底控件（更精致） */
.field {
  display: grid;
  grid-template-columns: 132rpx 1fr;
  align-items: center;
  gap: 20rpx;
  margin-top: 18rpx;
  min-height: 72rpx;
}
.field--top {
  align-items: start;
}
.field--top .field__label {
  padding-top: 16rpx;
}
.field__label {
  font-size: 26rpx;
  font-weight: 700;
  color: $ink;
}
.field__req {
  color: #e25c05;
}
.field__control {
  width: 100%;
  min-height: 72rpx;
  box-sizing: border-box;
  padding: 0 22rpx;
  border: 2rpx solid transparent;
  border-radius: 14rpx;
  background: #f5f8f5;
  font-size: 27rpx;
  color: $ink;
  transition: border-color 0.2s;
}
.field__control--select {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.field__arrow {
  color: #b3bcb5;
  font-size: 30rpx;
}
.field__placeholder {
  color: #a8b1aa;
}
.field__area-wrap {
  position: relative;
}
.field__area {
  width: 100%;
  box-sizing: border-box;
  min-height: 104rpx;
  padding: 14rpx 22rpx 34rpx;
  border: 2rpx solid transparent;
  border-radius: 14rpx;
  background: #f5f8f5;
  font-size: 25rpx;
}
.field__count {
  position: absolute;
  right: 18rpx;
  bottom: 10rpx;
  font-size: 19rpx;
  color: #b3bcb5;
}
/* CTA：橙色渐变点睛（设计稿语言），大圆角+轻投影 */
.cta {
  margin: 32rpx 0 0;
  width: 100%;
  min-height: 88rpx;
  line-height: 88rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #ffa940, #ff7a1f);
  color: #fff;
  font-size: 30rpx;
  font-weight: 900;
  box-shadow: 0 10rpx 26rpx rgba(255, 122, 31, 0.28);
}
.cta[disabled] {
  opacity: 0.6;
}
.rejected-tip {
  display: block;
  margin-top: 16rpx;
  font-size: 22rpx;
  color: #b96f33;
}
.skeleton-row {
  height: 72rpx;
  border-radius: 14rpx;
  margin: 18rpx 0;
  background: linear-gradient(90deg, #eef4ef, #fff, #eef4ef);
  animation: recruit-pulse 1.2s infinite;
}
@keyframes recruit-pulse {
  50% {
    opacity: 0.55;
  }
}
/* 进度卡 */
.status-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 44rpx 30rpx;
}
.status-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: #25b95a;
  box-shadow: 0 0 0 10rpx rgba(37, 185, 90, 0.14);
  animation: recruit-blink 1.6s infinite;
}
@keyframes recruit-blink {
  50% {
    box-shadow: 0 0 0 16rpx rgba(37, 185, 90, 0.05);
  }
}
.status-card__title {
  margin-top: 22rpx;
  font-size: 34rpx;
  font-weight: 900;
  color: $ink;
}
.status-card__info {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #667069;
}
.steps {
  margin: 32rpx 0 6rpx;
  width: 100%;
  display: flex;
  justify-content: space-around;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  font-size: 21rpx;
  color: #9aa39d;
}
.step__no {
  width: 42rpx;
  height: 42rpx;
  border-radius: 50%;
  border: 2rpx solid #e3e8e4;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: #9aa39d;
}
.step--done {
  color: #159c55;
  font-weight: 700;
}
.step--done .step__no {
  background: #25b95a;
  border-color: #25b95a;
  color: #fff;
}
.status-card__hint {
  margin-top: 18rpx;
  font-size: 21rpx;
  color: #8a958e;
}
/* 审核前修改报名入口（IKEAGE）：白底绿描边轻量按钮 */
.status-card__actions {
  margin-top: 28rpx;
  width: 100%;
}
.edit-btn {
  width: 100%;
  min-height: 80rpx;
  line-height: 80rpx;
  border-radius: 999rpx;
  background: #fff;
  border: 2rpx solid rgba(37, 185, 90, 0.45);
  color: #159c55;
  font-size: 27rpx;
  font-weight: 800;
}
.edit-btn::after {
  border: none;
}
.cancel-edit {
  display: block;
  text-align: center;
  margin-top: 20rpx;
  font-size: 24rpx;
  color: #8a958e;
}
/* 通过卡 */
.pass-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.pass-card__badge {
  padding: 6rpx 24rpx;
  border-radius: 999rpx;
  background: #e8f8ef;
  color: #159c55;
  font-size: 23rpx;
  font-weight: 800;
}
.pass-card__title {
  margin-top: 18rpx;
  font-size: 36rpx;
  font-weight: 900;
  color: $ink;
}
.pass-card__no {
  margin-top: 24rpx;
  width: 100%;
  padding: 24rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #e8f8ef, #fff);
  border: 2rpx dashed rgba(37, 185, 90, 0.35);
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.pass-card__no-label {
  font-size: 21rpx;
  color: #667069;
}
.pass-card__no-value {
  font-size: 48rpx;
  font-weight: 900;
  color: #159c55;
  letter-spacing: 4rpx;
}
.pass-card__guide {
  margin-top: 24rpx;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10rpx;
  font-size: 23rpx;
  color: $ink;
  text-align: left;
}
/* 报名说明：一行三列极简 */
.notes {
  margin-top: 22rpx;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10rpx;
}
.note {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
}
.note__no {
  flex: none;
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  color: #159c55;
  font-size: 19rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2rpx;
}
.note__text {
  font-size: 19rpx;
  color: #6f7d74;
  line-height: 1.5;
}
.brand-foot {
  display: block;
  text-align: center;
  margin-top: 26rpx;
  font-size: 20rpx;
  color: #93a299;
}
</style>
