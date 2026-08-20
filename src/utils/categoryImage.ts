import type { Category } from "../types";

/** 本地回退图标（IK9RX0）：后台未配图时按 id 哈希恒定取图，列表变动不漂移 */
const FALLBACK_ICONS = [
  "/static/products/chips.svg",
  "/static/products/soda.svg",
  "/static/products/noodle.svg",
  "/static/products/tissue.svg",
  "/static/products/grape.svg",
  "/static/products/biscuit.svg",
];

/**
 * 类别图（IK9VD3）：后台配图优先，无图回退本地哈希。
 * 首页金刚区与商品页侧栏共用同一函数，未配图类别两边恒显同一图标。
 */
export function categoryImage(item: Pick<Category, "id" | "image">): string {
  if (item.image) return item.image;
  let h = 0;
  for (const ch of item.id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return FALLBACK_ICONS[h % FALLBACK_ICONS.length];
}
