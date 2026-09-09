<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useSessionStore } from "../../stores/session";
import type { Building, RecruitingApplication } from "../../types";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
/**
 * 楼长招募报名页（IKEAGE，2026-09-09 道哥设计稿）：
 * banner 配自定义路径直达。报名页即进度页——首访表单（校区自由选、
 * 楼栋联动、手机号预填授权号）；在途显示进度；被拒显示原因可重报；
 * 通过显示工号 + 骑手小程序登录指引。身份证不采集（后台补录）。
 */
const session = useSessionStore();
const loading = ref(true),
  app = ref<RecruitingApplication | null>(null),
  campuses = ref<Array<{ id: string; name: string; shortName: string }>>([]),
  buildings = ref<Building[]>([]),
  submitting = ref(false),
  /** rejected 后的「重新报名」：置 true 回到表单态（保留上次填写） */
  reapplying = ref(false);
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
/** 页面态：表单（无在途 / 被拒重报）或进度（pending/interviewing/approved） */
const showForm = computed(
  () =>
    !app.value ||
    (app.value.status === "rejected" && reapplying.value) ||
    app.value.status === "rejected",
);
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
    app.value = await api.recruitApply({
      campusId: form.campusId,
      buildingId: form.buildingId,
      name: form.name.trim(),
      phone: form.phone.trim(),
      note: form.note.trim() || undefined,
    });
    reapplying.value = false;
    uni.showToast({ title: "报名成功", icon: "success" });
  } catch {
    /* 业务原因 request 层已 toast（在途拦截等） */
  } finally {
    submitting.value = false;
  }
}
</script>
<template>
  <view class="page recruit">
    <!-- Hero：背景素材（static 域名，50KB webp）+ 标题排版压图 -->
    <view class="hero">
      <image
        class="hero__bg"
        src="https://static.buchuqin.com/app/public/recruit-bg-v1.webp"
        mode="widthFix"
      />
      <view class="hero__text">
        <text class="hero__title">楼长招募</text>
        <text class="hero__sub">做本楼栋的零食管家，吃住寝室楼里的小生意</text>
      </view>
    </view>
    <!-- 卖点（设计稿权益区） -->
    <view class="perks card">
      <view class="perk">
        <text class="perk__title">配送提成</text>
        <text class="perk__desc">每单结算，多劳多得</text>
      </view>
      <view class="perk">
        <text class="perk__title">时间自由</text>
        <text class="perk__desc">课余接单，不耽误学业</text>
      </view>
      <view class="perk">
        <text class="perk__title">楼栋我做主</text>
        <text class="perk__desc">本楼栋零食运营与售后</text>
      </view>
    </view>

    <!-- 表单态：首访报名 / 被拒重报 -->
    <view v-if="loading" class="card form-card">
      <view v-for="n in 4" :key="n" class="skeleton-row" />
    </view>
    <view v-else-if="showForm" class="card form-card">
      <text class="form-card__title">留下你的信息</text>
      <text class="form-card__hint">运营同学会尽快联系你安排面试</text>
      <view class="field">
        <text class="field__label">姓名</text>
        <input
          v-model="form.name"
          class="field__input"
          placeholder="真实姓名"
          placeholder-class="field__placeholder"
          maxlength="20"
        />
      </view>
      <view class="field">
        <text class="field__label">手机号</text>
        <input
          v-model="form.phone"
          class="field__input"
          type="number"
          placeholder="保持畅通，方便联系"
          placeholder-class="field__placeholder"
          maxlength="11"
        />
      </view>
      <view class="field">
        <text class="field__label">学校</text>
        <picker
          class="field__picker"
          mode="selector"
          :range="campuses.map((c) => c.name)"
          @change="onCampusPick"
        >
          <view class="field__input field__input--select">
            <text :class="{ 'field__placeholder': !campusName }">{{
              campusName || "选择学校"
            }}</text>
            <text class="field__arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="field">
        <text class="field__label">宿舍楼</text>
        <picker
          class="field__picker"
          mode="selector"
          :range="buildings.map((b) => b.name)"
          @change="onBuildingPick"
        >
          <view class="field__input field__input--select">
            <text :class="{ 'field__placeholder': !buildingName }">{{
              buildingName || "选择楼栋"
            }}</text>
            <text class="field__arrow">›</text>
          </view>
        </picker>
      </view>
      <view class="field">
        <text class="field__label">自我介绍</text>
        <textarea
          v-model="form.note"
          class="field__textarea"
          placeholder="选填：说说你的空闲时间、寝室经历等"
          placeholder-class="field__placeholder"
          maxlength="200"
        />
      </view>
      <button class="primary-btn submit-btn" :disabled="submitting" @tap="submit">
        {{ submitting ? "提交中…" : "报名成为楼长" }}
      </button>
      <text v-if="app?.status === 'rejected'" class="rejected-tip"
        >上次报名未通过：{{ app.rejectReason || "未通过" }}，可调整后重新报名</text
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
.page {
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}
/* Hero：素材图通栏铺顶，标题压在图上（图自带留白，text 定位其上） */
.hero {
  position: relative;
}
.hero__bg {
  width: 100%;
  display: block;
}
.hero__text {
  position: absolute;
  left: 48rpx;
  bottom: 64rpx;
  right: 48rpx;
  display: flex;
  flex-direction: column;
}
.hero__title {
  font-size: 56rpx;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 4rpx 16rpx rgba(7, 60, 30, 0.35);
}
.hero__sub {
  margin-top: 10rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 2rpx 8rpx rgba(7, 60, 30, 0.4);
}
/* 卖点三列（设计稿权益区） */
.perks {
  margin: -36rpx 28rpx 0;
  position: relative;
  z-index: 2;
  padding: 28rpx 20rpx;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
}
.perk {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8rpx;
}
.perk__title {
  font-size: 26rpx;
  font-weight: 900;
  color: $primary-dark;
}
.perk__desc {
  font-size: 20rpx;
  color: #667069;
}
/* 表单/进度/通过统一浮卡 */
.form-card {
  margin: 24rpx 28rpx 0;
  padding: 36rpx 32rpx;
}
.form-card__title {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
  color: $ink;
}
.form-card__hint {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #667069;
}
.field {
  margin-top: 30rpx;
}
.field__label {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: $ink;
  margin-bottom: 12rpx;
}
.field__input {
  width: 100%;
  min-height: 88rpx;
  box-sizing: border-box;
  padding: 0 24rpx;
  border: 2rpx solid $line;
  border-radius: 16rpx;
  background: #fafcfa;
  font-size: 28rpx;
  color: $ink;
}
.field__input--select {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.field__arrow {
  color: #9aa39d;
  font-size: 32rpx;
}
.field__placeholder {
  color: #9aa39d;
}
.field__textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 140rpx;
  padding: 20rpx 24rpx;
  border: 2rpx solid $line;
  border-radius: 16rpx;
  background: #fafcfa;
  font-size: 26rpx;
}
.submit-btn {
  margin-top: 40rpx;
  width: 100%;
  min-height: 92rpx;
  font-size: 30rpx;
}
.submit-btn[disabled] {
  opacity: 0.6;
}
.rejected-tip {
  display: block;
  margin-top: 20rpx;
  font-size: 22rpx;
  color: #b96f33;
}
.skeleton-row {
  height: 88rpx;
  border-radius: 16rpx;
  margin: 22rpx 0;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
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
}
.status-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: $primary;
  box-shadow: 0 0 0 10rpx rgba(37, 185, 90, 0.15);
  animation: recruit-blink 1.6s infinite;
}
@keyframes recruit-blink {
  50% {
    box-shadow: 0 0 0 18rpx rgba(37, 185, 90, 0.06);
  }
}
.status-card__title {
  margin-top: 24rpx;
  font-size: 36rpx;
  font-weight: 900;
  color: $ink;
}
.status-card__info {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #667069;
}
.steps {
  margin: 36rpx 0 8rpx;
  width: 100%;
  display: flex;
  justify-content: space-around;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  font-size: 22rpx;
  color: #9aa39d;
}
.step__no {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2rpx solid $line;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: #9aa39d;
}
.step--done {
  color: $primary-dark;
  font-weight: 700;
}
.step--done .step__no {
  background: $primary;
  border-color: $primary;
  color: #fff;
}
.status-card__hint {
  margin-top: 20rpx;
  font-size: 22rpx;
  color: #667069;
}
/* 通过卡 */
.pass-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.pass-card__badge {
  padding: 6rpx 26rpx;
  border-radius: 999rpx;
  background: $primary-soft;
  color: $primary-dark;
  font-size: 24rpx;
  font-weight: 800;
}
.pass-card__title {
  margin-top: 20rpx;
  font-size: 38rpx;
  font-weight: 900;
  color: $ink;
}
.pass-card__no {
  margin-top: 28rpx;
  width: 100%;
  padding: 26rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, $primary-soft, #fff);
  border: 2rpx dashed rgba(37, 185, 90, 0.4);
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.pass-card__no-label {
  font-size: 22rpx;
  color: #667069;
}
.pass-card__no-value {
  font-size: 52rpx;
  font-weight: 900;
  color: $primary-dark;
  letter-spacing: 4rpx;
}
.pass-card__guide {
  margin-top: 28rpx;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
  font-size: 24rpx;
  color: $ink;
  text-align: left;
}
</style>
