import { request, toAbsoluteUrl, uploadImage } from "./request";
import type {
  Address,
  AfterSale,
  Building,
  Cart,
  Category,
  CouponBundle,
  LoginResult,
  Notification,
  Order,
  PaymentStatus,
  PrepayResult,
  Product,
  Refund,
  SessionUser,
  Settlement,
  UserCoupon,
} from "../types";
interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export const api = {
  login: () =>
    request<LoginResult>("/auth/test-login", {
      method: "POST",
      data: { identity: "user" },
    }),
  /** 微信小程序登录（后端未配置 WX_* 时 501，request.ts 已负责回退 test-login）。
   *  appid 用于双小程序凭证路由（IK8W5Q），与 manifest 一致。 */
  wechatLogin: (code: string) =>
    request<LoginResult>("/auth/wechat-login", {
      method: "POST",
      data: { code, appid: "wxc814687e5ae26924" },
    }),
  /** 当前登录用户信息：已有 token 时静默换取，避免每次刷新都打登录接口（限流 10 次/分/IP） */
  profile: () => request<SessionUser>("/auth/profile"),
  /**
   * 绑定手机号（POST /auth/phone）：
   * - { code }：微信小程序手机号授权码（getPhoneNumber 回调 e.detail.code），后端换取真实号码
   * - { phone }：手输直传（H5 / 后端暂不支持 code 时的降级路径）
   */
  bindPhone: (data: { code: string } | { phone: string }) =>
    request<{ id: string; phone: string }>("/auth/phone", {
      method: "POST",
      data,
    }),
  home: () =>
    request<{
      campus: { name: string };
      banners: Array<{
        id: string;
        title: string;
        subtitle: string;
        badge: string;
        color: string;
      }>;
      categories: Category[];
      hotProducts: Product[];
    }>("/home"),
  /** 商品分类列表（IK97FA：分类页直连，替代 /home 聚合里的分类字段） */
  categories: () => request<Category[]>("/categories"),
  products: async (categoryId = "all", keyword = "") =>
    (
      await request<PageResult<Product>>(
        `/products?categoryId=${categoryId}&keyword=${encodeURIComponent(keyword)}`,
      )
    ).items,
  product: (id: string) => request<Product>(`/products/${id}`),
  cart: () => request<Cart>("/cart"),
  updateCart: (items: Array<{ productId: string; quantity: number }>) =>
    request<Cart>("/cart", { method: "PUT", data: { items } }),
  /** 后端 /addresses 返回 {items,page,pageSize,total} 分页信封，这里解包成数组供页面直接用 */
  addresses: async () =>
    (await request<PageResult<Address>>("/addresses")).items,
  addAddress: (data: Record<string, unknown>) =>
    request<Address>("/addresses", { method: "POST", data }),
  updateAddress: (id: string, data: Record<string, unknown>) =>
    request<Address>(`/addresses/${id}`, { method: "PATCH", data }),
  deleteAddress: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/addresses/${id}`, {
      method: "DELETE",
    }),
  setDefaultAddress: (id: string) =>
    request<Address>(`/addresses/${id}/default`, { method: "PUT" }),
  /** 当前校园的楼栋预设列表（地址表单楼栋选择器） */
  buildings: () =>
    request<Building[]>("/campuses/current/buildings"),
  coupons: () => request<CouponBundle>("/coupons"),
  claimCoupon: (couponId: string) =>
    request<UserCoupon>(`/coupons/${couponId}/claim`, { method: "POST" }),
  uploadImage,
  toAbsoluteUrl,
  slots: () =>
    request<Array<{ id: string; label: string; available: boolean }>>(
      "/delivery/slots",
    ),
  checkout: (data: Record<string, unknown>) =>
    request<Settlement>("/orders/checkout", { method: "POST", data }),
  createOrder: (data: Record<string, unknown>) =>
    request<Order>("/orders", { method: "POST", data }),
  /** 微信预支付（ADR-0004：商户未配置时 501，演示支付通道已下线） */
  prepay: (orderId: string) =>
    request<PrepayResult>("/payments/wechat/prepay", {
      method: "POST",
      data: { orderId },
    }),
  paymentStatus: (orderId: string) =>
    request<PaymentStatus>(`/payments/${orderId}/status`),
  orders: async (status = "all") =>
    (await request<PageResult<Order>>(`/orders?status=${status}`)).items,
  /** 订单分页契约（IK9AWO）：滚动加载用，返回完整信封 {items,total,page,pageSize} */
  ordersPage: (status = "all", page = 1, pageSize = 20) =>
    request<PageResult<Order>>(
      `/orders?status=${status}&page=${page}&pageSize=${pageSize}`,
    ),
  order: (id: string) => request<Order>(`/orders/${id}`),
  cancelOrder: (id: string) =>
    request<Order>(`/orders/${id}/cancel`, { method: "POST" }),
  /** 确认收货：仅 delivered（已送达待确认）状态可调 */
  confirmReceipt: (id: string) =>
    request<Order>(`/orders/${id}/confirm-receipt`, { method: "POST" }),
  createAfterSale: (id: string, data: Record<string, unknown>) =>
    request<AfterSale>(`/orders/${id}/after-sales`, { method: "POST", data }),
  afterSales: () => request<AfterSale[]>("/after-sales"),
  refunds: () => request<Refund[]>("/refunds"),
  /** 同 /addresses：解包分页信封 */
  notifications: async () =>
    (await request<PageResult<Notification>>("/notifications")).items,
  /** 消息分页契约（IK9AWO）：滚动加载用 */
  notificationsPage: (page = 1, pageSize = 20) =>
    request<PageResult<Notification>>(
      `/notifications?page=${page}&pageSize=${pageSize}`,
    ),
  /** 全部已读（IK9AWO）：POST /notifications/read-all */
  readAllNotifications: () =>
    request<{ updated: number }>("/notifications/read-all", {
      method: "POST",
      data: {},
    }),
  readNotification: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: "POST" }),
};
