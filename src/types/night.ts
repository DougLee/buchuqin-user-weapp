/**
 * 夜宵店（/night/*）契约类型：与白天店完全隔离（商品/价格/购物车/券/订单）。
 * 金额字段单位一律为分，展示层经 fenToYuan 转元。
 */

/** GET /night/entry：夜宵入口三元组（开关/场次窗口/白天闭店态）+ 窗口时间 */
export interface NightEntry {
  campusId: string;
  campusName: string;
  /** 校区夜宵总开关（后台配置） */
  nightEnabled: boolean;
  /** 夜宵窗口 HH:mm（跨零点合法，如 22:00~02:00） */
  nightStartAt: string | null;
  nightEndAt: string | null;
  /** 夜间配送费（分；校区未配置回落白天即时送口径） */
  nightDeliveryFee: number;
  /** 白天业务是否闭店（手动闭店或打烊窗内；服务端实时判定） */
  dayClosed: boolean;
  /** 当前是否处于夜宵时间窗 */
  inWindow: boolean;
  /** 三元组终值：夜宵可购窗口（开夜宵 + 闭店 + 在窗内）——入口横幅判定源 */
  inNightSession: boolean;
  nowMinutes: number;
}

/** 店铺三态：no-manager 无楼长招募中 / resting 有楼长未营业 / open 营业中 */
export type NightStoreState = "no-manager" | "resting" | "open";

/** 夜宵场次快照（stores 列表与详情共用） */
export interface NightSession {
  nightEnabled: boolean;
  inWindow: boolean;
  dayClosed: boolean;
  inNightSession: boolean;
  nightStartAt: string | null;
  nightEndAt: string | null;
}

/** GET /night/stores 行：楼栋 × 夜宵店三态 */
export interface NightStoreRow {
  buildingId: string;
  buildingName: string;
  storeId: string | null;
  state: NightStoreState;
  storeStatus: string | null;
  managerName: string | null;
  /** 公告位预留（一期恒空串） */
  announcement: string;
  /** 详情接口附带（列表行没有） */
  session?: NightSession;
}

/** GET /night/stores/:id/products 行（引夜宵统一售价主档） */
export interface NightProduct {
  /** NightProduct 楼栋行 id（下单用的 productId） */
  id: string;
  catalogProductId: string;
  name: string;
  image: string;
  subtitle: string;
  /** 夜宵售价，单位：分 */
  price: number;
  stock: number;
  soldOut: boolean;
}

/** 夜宵订单行快照（服务端 items JSON 透传） */
export interface NightOrderLine {
  nightProductId: string;
  catalogProductId: string;
  name: string;
  image: string;
  /** 夜宵售价，单位：分 */
  price: number;
  quantity: number;
}

/** 夜宵订单时间线节点（轻量自持，不复用白天 12 态） */
export interface NightTimelineStep {
  key: string;
  title: string;
  time?: string;
}

/** 夜宵订单视图（orderView 全量口径） */
export interface NightOrder {
  id: string;
  orderNo: string;
  status: string;
  statusText: string;
  items: NightOrderLine[];
  /** 商品原价合计，单位：分 */
  productAmount: number;
  /** 夜宵券优惠，单位：分 */
  couponDiscount: number;
  /** 配送费，单位：分 */
  deliveryFee: number;
  /** 应付 = 商品 − 券优惠 + 配送费，单位：分 */
  payableAmount: number;
  commissionRate: number;
  address: {
    buildingId: string;
    buildingName: string;
    floor: number;
    room: string;
    contactName: string;
    phone: string;
  };
  remark: string;
  timeline: NightTimelineStep[];
  couponSnapshot: { name: string; amount: number; threshold: number } | null;
  /** 夜宵业务日期（跨零点归属场次日） */
  businessDate: string;
  /** 待支付截止（ISO；null=非待支付态） */
  timeoutAt: string | null;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  /** null 无售后 / requested 申请中 / resolved 已处理 */
  afterSaleStatus: string | null;
  store: { id: string; buildingName: string } | null;
}

/** POST /night/orders/:id/pay 响应 */
export interface NightPrepayResult {
  orderId: string;
  orderNo: string;
  /** 应付金额，单位：分 */
  amount: number;
  payParams: {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
  };
}

/** GET /night/orders/:id/pay-status 响应 */
export interface NightPayStatus {
  orderId: string;
  orderNo: string;
  status: string;
  statusText: string;
  paid: boolean;
}

/** GET /night/coupons 行（可领） */
export interface NightClaimableCoupon {
  id: string;
  name: string;
  /** 面额，单位：分 */
  amount: number;
  /** 门槛，单位：分 */
  threshold: number;
  businessType: string;
  remain: number | null;
  expiresAt: string | null;
}

/** GET /night/coupons 行（我的；结构对齐白天 UserCoupon） */
export interface NightUserCoupon {
  id: string;
  couponId: string;
  status: string;
  claimedAt: string;
  coupon: {
    id: string;
    name: string;
    amount: number;
    threshold: number;
    businessType: string;
    expiresAt: string | null;
  };
}

/** GET /night/coupons 响应 */
export interface NightCouponBundle {
  claimable: NightClaimableCoupon[];
  mine: NightUserCoupon[];
}
