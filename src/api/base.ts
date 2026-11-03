/** API 地址单一来源（IKSN19 拆出）：request.ts 与启动校区门（utils/bootCampus）
 *  共用；独立成模块避免 request.ts ↔ 校区门互相 import 成环。 */
export const BASE_URL =
  // 本机 API 固定 3100（3000 被占），dev 裸跑不再需要前置 VITE_API_BASE_URL；生产构建同源相对路径 /api/v1
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3100/api/v1";
const ORIGIN = BASE_URL.replace(/\/api\/v1\/?$/, "");
/** 后端返回的相对资源路径（如 /api/v1/uploads/xx.jpg）拼成可访问的完整地址 */
export function toAbsoluteUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${ORIGIN}${url}`;
}
