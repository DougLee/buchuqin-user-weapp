import type { Banner } from "../types";

/** tab 页清单（IKE9YC）：跳这些页须 switchTab（navigateTo 会 fail） */
const TAB_PAGES = [
  "/pages/index/index",
  "/pages/category/index",
  "/pages/cart/index",
  "/pages/profile/index",
];

/**
 * Banner 可点性（IKE9YC）：配置了站内跳转，或有图文详情（长图/旧文字）。
 * 驱动按压反馈样式与点击热区。
 */
export function bannerClickable(banner: Banner): boolean {
  if (banner.linkType === "page" && banner.linkUrl?.trim()) return true;
  return Boolean(banner.detailImage?.trim() || banner.content?.trim());
}

/**
 * Banner 点击分发（IKE9YC）：跳转优先——linkType=page 跳配置的站内页面
 * （tab 页 switchTab，参数丢弃为微信限制；普通页 navigateTo，路径错误
 * toast 提示）；未配跳转走图文详情（IK9SNN/IKC1AD 老逻辑，storage 传参）；
 * 都没有则静默不可点。
 */
export function openBannerTarget(banner: Banner): void {
  // 跳转优先：配置了站内页面就跳，detailImage 不再决定点击
  if (banner.linkType === "page" && banner.linkUrl?.trim()) {
    const url = banner.linkUrl.trim();
    const path = url.startsWith("/") ? url : `/${url}`;
    if (TAB_PAGES.includes(path.split("?")[0])) {
      uni.switchTab({ url: path.split("?")[0] });
      return;
    }
    uni.navigateTo({
      url: path,
      fail: () =>
        uni.showToast({ title: "跳转页面不存在", icon: "none" }),
    });
    return;
  }
  if (!banner.detailImage?.trim() && !banner.content?.trim()) return;
  uni.setStorageSync(
    "bannerContent",
    JSON.stringify({
      title: banner.title,
      subtitle: banner.subtitle,
      badge: banner.badge,
      image: banner.image,
      detailImage: banner.detailImage ?? "",
      content: banner.content ?? "",
    }),
  );
  uni.navigateTo({ url: "/pages/content/detail" });
}
