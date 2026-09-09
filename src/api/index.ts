import { request, toAbsoluteUrl, uploadImage } from "./request";
import type {
  Address,
  AfterSale,
  Banner,
  Building,
  Cart,
  Category,
  CouponBundle,
  HomePromotion,
  LoginResult,
  Notification,
  Order,
  PaymentStatus,
  PrepayResult,
  Product,
  Refund,
  RecruitingApplication,
  Room,
  SessionUser,
  Settlement,
  SubscribeTemplatesResult,
  UserCoupon,
} from "../types";
interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export const api = {
  /** 微信小程序登录（唯一通道；后端未配置 WX_*_USER 时 501 报"登录服务未配置"）。
   *  appid 用于双小程序凭证路由（IK8W5Q），与 manifest 一致。 */
  wechatLogin: (code: string) =>
    request<LoginResult>("/auth/wechat-login", {
      method: "POST",
      data: { code, appid: "wxc814687e5ae26924" },
    }),
  /** 当前登录用户信息：已有 token 时静默换取，避免每次刷新都打登录接口（限流 10 次/分/IP） */
  profile: () => request<SessionUser>("/auth/profile"),
  /** 资料自助修改（IK9ROG）：昵称/头像落库，DB 为准 */
  updateProfile: (data: { nickname?: string; avatar?: string }) =>
    request<{ nickname: string; avatar: string }>("/auth/profile", {
      method: "PATCH",
      data,
    }),
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
      banners: Banner[];
      categories: Category[];
      hotProducts: Product[];
      /** 促销分组（IKAHFG/ADR-0006）：进行中活动，空数组 = 首页不渲染模块卡 */
      promotions?: HomePromotion[];
    }>("/home"),
  /** 支付成功页广告位（IKA57E→IKB87P）：大卡列表，sort 升序最多 2 条；空数组不占位 */
  paySuccessBanners: () =>
    request<Banner[]>("/banners/current?placement=pay-success"),
  /* ---------- 楼长招募（IKEAGE） ---------- */
  /** 我的报名（最新一条任意状态；approved 附工号）——报名页即进度页 */
  recruitApplication: () =>
    request<RecruitingApplication | null>("/recruit/application"),
  /** 报名（校区自由选，楼栋属该校区；一人一条在途） */
  recruitApply: (data: {
    campusId: string;
    buildingId: string;
    name: string;
    phone: string;
    note?: string;
  }) =>
    request<RecruitingApplication>("/recruit/applications", {
      method: "POST",
      data,
    }),

  /** 进群二维码（IKAJSZ）：楼栋群→校园大群回落；null = 后台未配置，入口不显示 */
  wechatGroup: () =>
    request<{ image: string; scope: "building" | "campus" } | null>(
      "/wechat-group",
    ),
  /** 抽奖大转盘（IKD6FB）：active=false 首页入口不渲染；drawnToday 供转盘页置灰 */
  wheel: () =>
    request<{
      active: boolean;
      prizes: {
        type: "coupon" | "partner" | "none";
        label: string;
        bizTitle: string;
        bizImage: string;
        bizNote: string;
      }[];
      drawnToday: boolean;
    }>("/wheel"),
  /** 抽奖（IKD6FB）：每日 1 次；平台券自动入账，异业券返回图文 */
  drawWheel: () =>
    request<{
      index: number;
      type: "coupon" | "partner" | "none";
      userCouponId: string | null;
      prize: {
        type: "coupon" | "partner" | "none";
        label: string;
        bizTitle: string;
        bizImage: string;
        bizNote: string;
      };
    }>("/wheel/draw", { method: "POST", body: "{}" }),
  /** 商品分类列表（IK97FA：分类页直连，替代 /home 聚合里的分类字段） */
  categories: () => request<Category[]>("/categories"),
  products: async (categoryId = "all", keyword = "") =>
    (
      await request<PageResult<Product>>(
        `/products?categoryId=${categoryId}&keyword=${encodeURIComponent(keyword)}`,
      )
    ).items,
  product: (id: string) => request<Product>(`/products/${id}`),
  /** 限时秒杀商品（IKBW0K）：进行中 seckill 活动带促销价（分类页伪分类用）。 */
  seckillProducts: () => request<Product[]>("/promotions/seckill"),
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
  buildings: (campusId?: string) =>
    request<Building[]>(
      `/campuses/current/buildings${campusId ? `?campusId=${encodeURIComponent(campusId)}` : ""}`,
    ),
  /** 楼栋寝室列表（寝室地址三级联动数据源）：floor 选填（不传=全楼，页面拉全按层分组）。
   *  silent：未导入寝室数据的楼返回空数组、失败不弹 toast，页面按「未录入」处理 */
  buildingRooms: (buildingId: string, floor?: number) =>
    request<Room[]>(
      `/campuses/current/buildings/${buildingId}/rooms${floor ? `?floor=${floor}` : ""}`,
      { silent: true },
    ),
  /** 校区选项（IKAJT2 选校区）：开放中校区列表 */
  campuses: () =>
    request<Array<{ id: string; name: string; shortName: string }>>(
      "/campuses",
    ),
  /** 我的校区详情（IKAJT2）：名称/仓名/配送费门槛，随切换即时生效 */
  currentCampus: () =>
    request<{
      id: string;
      name: string;
      shortName: string;
      warehouseName: string;
    }>("/campus/current"),
  /** 切换校区（IKAJT2）：返回换发 token（JWT 含新 campusId），会话按登录同款落库 */
  selectCampus: (campusId: string) =>
    request<LoginResult>("/auth/campuses/select", {
      method: "POST",
      data: { campusId },
    }),
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
  /** 订阅消息模板 ID（支付前 requestSubscribeMessage 用；失败静默） */
  subscribeTemplates: () =>
    request<SubscribeTemplatesResult>("/payments/wechat/templates"),
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
