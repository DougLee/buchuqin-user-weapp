import { onShareAppMessage } from "@dcloudio/uni-app";

/**
 * 通用兜底分享（IKC7V6）：非核心页面声明转发能力，避免胶囊菜单
 * 「转发给朋友」置灰（观感像功能残缺）。
 * 不传 imageUrl——微信自动截当前页面作为分享图（原生行为，零成本）；
 * 落地统一回首页（个人页/结算页等不作为传播入口）。
 * 朋友圈 onShareTimeline 仅首页/商品详情声明（单页模式落地当前页，
 * 个人页进朋友圈无意义）。
 */
export function setupDefaultShare() {
  onShareAppMessage(() => ({
    title: "不出寝，零食送到寝室",
    path: "/pages/index/index",
  }));
}
