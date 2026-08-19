export interface Product {
  id: string;
  categoryId: string;
  name: string;
  subtitle: string;
  /** 单位：分 */
  price: number;
  /** 单位：分 */
  originalPrice: number;
  stock: number;
  sales: number;
  tag: string;
  image: string;
  /** 详情多图（IK9SNR）：后台维护的图集，首图兼容旧字段 image */
  images?: string[];
  weight: number;
}
export interface Category {
  id: string;
  name: string;
  /** 类别图（IK9RX0）：后台可改，空串 = 无图回退文字 tab */
  image?: string;
}
/** 首页 Banner（IK9RX2）：后台营销板块管理，/home 返回启用列表。 */
export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  /** 预置主题键 green/orange/dark 或自定义 #RRGGBB */
  color: string;
  image?: string | null;
  /** 图文详情（IK9SNN）：后台配置的跳转内容，空则不可点 */
  content?: string | null;
}
export interface CartLine {
  product: Product;
  quantity: number;
}
export interface Cart {
  items: CartLine[];
  /** 单位：分 */
  productAmount: number;
  totalQuantity: number;
  /** 起送门槛，单位：分 */
  deliveryThreshold: number;
}
export interface Address {
  id: string;
  campusName: string;
  buildingId?: string;
  buildingName: string;
  floor: number;
  room: string;
  contactName: string;
  phone: string;
  isDefault: boolean;
}
/** 校园楼栋预设（GET /campuses/current/buildings），地址表单的楼栋选择器数据源 */
export interface Building {
  id: string;
  name: string;
  minFloor: number;
  maxFloor: number;
  hasElevator: boolean;
  gender: string;
  available: boolean;
}
/** 订单聚合阶段（后端 statusPhase，前端 tab 直接映射；IK93GQ 12 态状态机） */
export type OrderStatusPhase = "payment" | "fulfillment" | "done" | "exception";
export interface Order {
  id: string;
  orderNo: string;
  status: string;
  statusPhase: OrderStatusPhase;
  statusText: string;
  createdAt: string;
  /** 以下金额字段单位均为：分 */
  payableAmount: number;
  productAmount: number;
  deliveryFee: number;
  discount: number;
  items: CartLine[];
  address: Address;
  estimatedArrival: string;
  timeline: Array<{
    key: string;
    title: string;
    description: string;
    time?: string;
    done: boolean;
  }>;
}
export interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}
/** 登录后的会话用户（test-login 与 wechat-login 统一口径，avatar 等字段可缺省） */
export interface SessionUser {
  id: string;
  campusId?: string;
  role?: string;
  nickname: string;
  phone?: string;
  avatar?: string;
}
export interface LoginResult {
  token: string;
  user: SessionUser;
}
export interface Coupon {
  id: string;
  name: string;
  /** 面额，单位：分 */
  amount: number;
  /** 使用门槛，单位：分 */
  threshold: number;
  status: string;
  expiresAt: string;
  total?: number;
  remain?: number;
}
export type UserCouponStatus = "claimed" | "locked" | "used" | "released";
export interface UserCoupon {
  id: string;
  userId: string;
  couponId: string;
  status: UserCouponStatus;
  claimedAt: string;
  coupon: Coupon;
}
export interface CouponBundle {
  claimable: Coupon[];
  mine: UserCoupon[];
}
export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
}
export interface AfterSale {
  id: string;
  orderId: string;
  type: string;
  description: string;
  images: string[];
  status: string;
  createdAt: string;
}
export interface Refund {
  id: string;
  orderId: string;
  /** 退款金额，单位：分 */
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}
export interface Settlement extends Cart {
  /** 以下金额字段单位均为：分 */
  deliveryFee: number;
  discount: number;
  payableAmount: number;
  estimatedArrival: string;
}
/** 微信支付收银台参数 */
export interface WechatPayParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
}
/** POST /payments/wechat/prepay 响应（ADR-0004：商户未配置时接口直接 501，无 mock 字段） */
export interface PrepayResult {
  orderId?: string;
  orderNo?: string;
  /** 支付金额，单位：分 */
  amount?: number;
  /** 订阅消息模板（支付成功/送达，ADR-0004）：支付前 requestSubscribeMessage 用 */
  subscribeTemplates?: string[];
  payParams?: WechatPayParams;
}
/** GET /payments/wechat/templates 响应（进页预载，缓存供支付前授权） */
export interface SubscribeTemplatesResult {
  templates: string[];
}
/** GET /payments/:orderId/status 响应 */
export interface PaymentStatus {
  orderId: string;
  orderNo: string;
  status: string;
  statusText: string;
  paid: boolean;
  paidAt: string | null;
  /** 订单金额，单位：分 */
  amount: number;
}
