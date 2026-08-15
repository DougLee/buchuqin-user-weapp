<script setup lang="ts">
import { reactive, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
const orderId = ref(""),
  submitting = ref(false),
  uploading = ref(false),
  form = reactive({
    type: "quality",
    description: "商品存在质量问题，希望退款",
    images: [] as string[],
  });
onLoad((q) => {
  orderId.value = String(q?.orderId || "");
});
async function chooseProof() {
  if (uploading.value) return;
  const result = await uni.chooseImage({
    count: 3 - form.images.length,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
  });
  const paths = Array.isArray(result.tempFilePaths)
    ? result.tempFilePaths
    : [result.tempFilePaths];
  uploading.value = true;
  try {
    // 选中即上传，提交时只发送已持久化的 URL
    const urls = await Promise.all(paths.map((p) => api.uploadImage(p)));
    form.images = [...form.images, ...urls];
  } finally {
    uploading.value = false;
  }
}
async function submit() {
  if (uploading.value) {
    uni.showToast({ title: "凭证还在上传中，稍等一下", icon: "none" });
    return;
  }
  if (form.description.length < 5) {
    uni.showToast({ title: "请详细描述问题", icon: "none" });
    return;
  }
  if (!form.images.length) {
    uni.showToast({ title: "请上传至少一张问题凭证", icon: "none" });
    return;
  }
  submitting.value = true;
  try {
    await api.createAfterSale(orderId.value, { ...form });
    uni.showToast({ title: "售后申请已提交", icon: "success" });
    setTimeout(() => uni.redirectTo({ url: "/pages/after-sales/index" }), 600);
  } finally {
    submitting.value = false;
  }
}
</script>
<template>
  <view class="page"
    ><view class="tip">请在送达后 24 小时内提交，平台审核后处理退款。</view
    ><view class="form card"
      ><text class="label">问题类型</text
      ><view class="types"
        ><view
          v-for="item in [
            ['quality', '质量问题'],
            ['missing', '商品缺失'],
            ['damaged', '包装破损'],
          ]"
          :key="item[0]"
          class="type"
          :class="{ 'type--active': form.type === item[0] }"
          @tap="form.type = item[0]"
          >{{ item[1] }}</view
        ></view
      ><text class="label">问题描述</text
      ><textarea
        v-model="form.description"
        maxlength="300"
        placeholder="请说明商品出现了什么问题"
      /><text class="label">问题凭证</text
      ><view class="proof" @tap="chooseProof"
        ><template v-if="form.images.length"
          ><image
            v-for="image in form.images"
            :key="image"
            :src="api.toAbsoluteUrl(image)"
            mode="aspectFill" /></template
        ><text v-else>{{ uploading ? "凭证上传中…" : "拍照或从相册选择（至少 1 张）" }}</text></view
      ></view
    ><button
      class="primary-btn"
      :disabled="submitting || uploading"
      @tap="submit"
    >
      {{ submitting ? "正在提交…" : uploading ? "凭证上传中…" : "提交售后申请" }}
    </button></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.tip {
  background: $primary-soft;
  color: $primary-dark;
  padding: 22rpx;
  border-radius: 22rpx;
  margin-bottom: 22rpx;
  border: 2rpx solid rgba(37, 185, 90, 0.12);
}
.form {
  padding: 30rpx;
}
.label {
  display: block;
  font-weight: 900;
  margin: 22rpx 0 14rpx;
}
.types {
  display: flex;
  gap: 14rpx;
  flex-wrap: wrap;
}
.type {
  min-height: 72rpx;
  padding: 14rpx 22rpx;
  border: 2rpx solid $line;
  border-radius: 36rpx;
  font-size: 23rpx;
  display: flex;
  align-items: center;
}
.type--active {
  background: $primary;
  color: #fff;
  border-color: $primary;
}
.form textarea {
  width: 100%;
  height: 220rpx;
  background: $paper;
  border: 2rpx solid $line;
  border-radius: 22rpx;
  padding: 20rpx;
  line-height: 1.6;
}
.proof {
  min-height: 174rpx;
  border: 3rpx dashed rgba(37, 185, 90, 0.35);
  background: #f8fff9;
  border-radius: 22rpx;
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: center;
  color: #667069;
  padding: 12rpx;
}
.proof image {
  width: 120rpx;
  height: 120rpx;
  border-radius: 18rpx;
}
.primary-btn {
  margin-top: 30rpx;
}
</style>
