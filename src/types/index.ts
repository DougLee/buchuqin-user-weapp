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
  /** 商品介绍（IKAHAU）：详情接口返回，空 = 不渲染区块；列表不带 */
  description?: string;
  /** 限时特价（ADR-0006）：活动期 price 即促销价、originalPrice 划线让位为商品原价 */
  promotion?: {
    id: string;
    type: "seckill" | "clearance";
    /** 促销价，单位：分 */
    price: number;
    endsAt: string;
  };
  /** IKG8FF 秒杀限购：生效秒杀活动商品才有——purchased=true 置灰「已抢购」，数量上限 limit */
  seckillLimit?: { limit: number; purchased: boolean };
  weight: number;
}
/** /home 促销分组条目（IKAHFG/ADR-0006）：活动 + 商品视图 */
export interface HomePromotion {
  id: string;
  type: "seckill" | "clearance";
  /** 促销价，单位：分 */
  price: number;
  endsAt: string;
  product: Product;
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
  /** 图文详情长图（IKC1AD）：点击 Banner 进详情页通铺展示的主口径 */
  detailImage?: string | null;
  /** 旧版逐行文字详情（IK9SNN），保留兼容；detailImage 优先 */
  content?: string | null;
  /** 展示位置（IKA57F）：home 首页轮播 / pay-success 支付成功页广告位 */
  placement?: "home" | "pay-success";
  /** 点击跳转（IKE9YC）：none 无 / page 站内页面；配置了优先于图文详情 */
  linkType?: "none" | "page";
  /** 站内页面路径（支持带参，如 pages/product/detail?id=xxx） */
  linkUrl?: string;
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
  /** IKGNMV（一单一秒杀）：购物车里已有的秒杀 SKU id——其他秒杀品加购置灰用 */
  seckillIdInCart?: string;
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
/**
 * 校区打烊配置（IKGI1C）：随校区视图下发（/home 的 campus 与 /campus/current
 * 同源）。closedNow/closedReason 由服务端按当前时间实时算好——客户端时钟不可信，
 * 前端直接消费，不自算时间窗。
 */
export interface CampusCloseState {
  /** 打烊开始 HH:mm（start > end = 跨零点窗，如 22:00–08:00） */
  closeStart?: string | null;
  /** 恢复接单时间 HH:mm */
  closeEnd?: string | null;
  /** 商家手动闭店开关 */
  manualClosed?: boolean;
  /** 当前是否闭店（服务端判定） */
  closedNow?: boolean;
  /** 闭店原因：manual 手动闭店 | window 打烊时间窗 */
  closedReason?: "manual" | "window" | null;
}
/** 楼栋寝室条目（IKD6FH 地址四级选择）：GET /campuses/current/buildings/:buildingId/rooms */
export interface Room {
  id: string;
  floor: number;
  /** 寝室号，如 "318" */
  roomNo: string;
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
/** 楼长招募报名（IKEAGE）：一人一条在途，报名页即进度页 */
export interface RecruitingApplication {
  id: string;
  campusId: string;
  buildingId: string;
  buildingName: string;
  name: string;
  phone: string;
  note: string;
  /** pending 待联系 | interviewing 面试中 | approved 已通过 | rejected 已拒绝 */
  status: "pending" | "interviewing" | "approved" | "rejected";
  rejectReason: string;
  /** approved 时后端附带：实习楼长工号（骑手小程序登录凭证） */
  staffNo?: string;
  createdAt: string;
}
export interface LoginResult {
  token: string;
  /** IKDETO：当次为注册（首建档）——C 端据此弹一次迎新礼包 */
  isNewUser?: boolean;
  user: SessionUser;
}
export interface Coupon {
  id: string;
  name: string;
  /** 券品种（IKDCVO）：platform 金额券下单抵扣 | partner 异业券到店展示暂不核销 */
  kind: "platform" | "partner";
  /** 发放方式：manual 领券中心 | lottery 转盘 | signup 注册发 */
  trigger: "manual" | "lottery" | "signup";
  /** 优惠说明（异业券到店权益等） */
  remark: string;
  /** 面额，单位：分；partner 券恒为 0 */
  amount: number;
  /** 使用门槛，单位：分；partner 券恒为 0 */
  threshold: number;
  status: string;
  /** 过期时间；null = 长期有效（IKDCVO） */
  expiresAt: string | null;
  total?: number;
  remain?: number;
  /** 支付后推荐（道哥 2026-09-08）：支付成功页领券卡筛选用 */
  featuredAfterPay?: boolean;
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
  /** IKGN4W：楼长缺失提示（非空 = 地址楼栋无在职楼长，提交前弹窗确认） */
  managerTip?: string;
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
