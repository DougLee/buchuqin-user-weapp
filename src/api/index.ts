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
  /** 微信小程序登录（后端未配置 WX_* 时 501，request.ts 已负责回退 test-login） */
  wechatLogin: (code: string) =>
    request<LoginResult>("/auth/wechat-login", {
      method: "POST",
      data: { code },
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
  payOrder: (id: string) =>
    request<Order>(`/orders/${id}/pay`, { method: "POST" }),
  /** 微信预支付：mock=true 表示商户 env 未配置（前端改走 /orders/:id/pay 演示通道） */
  prepay: (orderId: string) =>
    request<PrepayResult>("/payments/wechat/prepay", {
      method: "POST",
      data: { orderId },
    }),
  paymentStatus: (orderId: string) =>
    request<PaymentStatus>(`/payments/${orderId}/status`),
  orders: async (status = "all") =>
    (await request<PageResult<Order>>(`/orders?status=${status}`)).items,
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
  readNotification: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: "POST" }),
};
