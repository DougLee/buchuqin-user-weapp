<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
/**
 * 图文详情页（IK9SNN）：首页 Banner 点击跳转的活动/公告内容。
 * 数据经 storage 传递（Banner 已在 /home 拉取，不重复建后端详情端点），
 * content 为后台维护的多行文本（支持以 https:// 开头的行渲染为图片）。
 */
const title = ref(""),
  subtitle = ref(""),
  badge = ref(""),
  image = ref(""),
  /** 长图详情（IKC1AD）：配置了 detailImage 时整页通铺展示长图 */
  longImage = ref(""),
  /** 文本行 / 图片行 判别后的渲染项 */
  blocks = ref<Array<{ type: "text" | "image"; value: string }>>([]);
onLoad(() => {
  const raw = uni.getStorageSync("bannerContent") as string;
  uni.removeStorageSync("bannerContent");
  if (!raw) return;
  const banner = JSON.parse(raw) as {
    title?: string;
    subtitle?: string;
    badge?: string;
    image?: string | null;
    detailImage?: string | null;
    content?: string | null;
  };
  title.value = banner.title ?? "";
  subtitle.value = banner.subtitle ?? "";
  badge.value = banner.badge ?? "";
  image.value = banner.image ?? "";
  longImage.value = banner.detailImage?.trim() ?? "";
  blocks.value = String(banner.content ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      /^https?:\/\//.test(line)
        ? { type: "image", value: line }
        : { type: "text", value: line },
    );
});
</script>
<template>
  <view class="page content"
    ><!-- IKC1AD：长图详情模式——无封面/标题栏/卡片包裹，整宽通铺看长图 -->
    <view v-if="longImage" class="content__long"
      ><image :src="longImage" mode="widthFix"
    /></view>
    <template v-else
      ><view v-if="image" class="content__cover"
        ><image :src="image" mode="aspectFill" /></view
      ><view class="content__head"
      ><text v-if="badge" class="content__badge">{{ badge }}</text
      ><text class="content__title">{{ title }}</text
      ><text v-if="subtitle" class="content__sub">{{ subtitle }}</text></view
    ><view class="content__body card"
      ><template v-if="blocks.length"
        ><template v-for="(b, i) in blocks" :key="i"
          ><!-- 图片行（content 里 https 开头的行）整宽展示，其余为文本段 -->
          <image
            v-if="b.type === 'image'"
            class="content__image"
            :src="b.value"
            mode="widthFix"
          />
          <text v-else class="content__line">{{ b.value }}</text></template
        ></template
      ><text v-else class="content__line muted">暂无详细介绍</text></view
    ></template
  ></view
>
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.content__cover {
  margin: -10rpx -10rpx 20rpx;
  border-radius: 24rpx;
  overflow: hidden;
  aspect-ratio: 2.2/1;
}
.content__cover image {
  width: 100%;
  height: 100%;
}
/* IKC1AD：长图详情通铺（对冲 page 内边距，widthFix 自撑高） */
.content__long {
  margin: -10rpx;
}
.content__long image {
  display: block;
  width: 100%;
}
.content__head {
  padding: 0 6rpx;
}
.content__badge {
  display: inline-block;
  font-size: 20rpx;
  font-weight: 700;
  color: #fff;
  background: $primary;
  border-radius: 999rpx;
  padding: 6rpx 20rpx;
  margin-bottom: 16rpx;
}
.content__title {
  display: block;
  font-size: 40rpx;
  font-weight: 900;
}
.content__sub {
  display: block;
  color: #667069;
  margin-top: 10rpx;
}
.content__body {
  margin-top: 24rpx;
  padding: 30rpx;
}
.content__line {
  display: block;
  font-size: 28rpx;
  line-height: 1.8;
  margin-bottom: 14rpx;
}
.content__image {
  width: 100%;
  border-radius: 16rpx;
  margin-bottom: 14rpx;
}
</style>
