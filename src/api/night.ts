import { request } from "./request";
import { fetchAddresses } from './addresses';
import type {
  NightCouponBundle,
  NightEntry,
  NightOrder,
  NightPayStatus,
  NightPrepayResult,
  NightProduct,
  NightStoreRow,
} from "../types/night";
import type { UserCoupon } from "../types";

/**
 * 夜宵店（/night/*）API 层：与白天 api/index.ts 完全隔离的独立封装。
 * 鉴权复用现有用户登录态（request 层 ensureToken），基地址同 BASE_URL。
 */
export const nightApi = {
  /** 夜宵入口数据：入口横幅判定源（inNightSession 三元组） */
  entry: () => request<NightEntry>("/night/entry"),
  /** 楼栋店铺列表（三态；buildingId 过滤=进本楼店前置校验） */
  stores: (buildingId?: string) =>
    request<{ session: NightStoreRow["session"]; stores: NightStoreRow[] }>(
      `/night/stores${buildingId ? `?buildingId=${encodeURIComponent(buildingId)}` : ""}`,
    ),
  /** 店铺详情（三态+营业时间+公告） */
  storeDetail: (storeId: string) =>
    request<NightStoreRow>(`/night/stores/${storeId}`),
  /** 本店可购商品（上架+售卖许可+库存>0） */
  storeProducts: (storeId: string) =>
    request<NightProduct[]>(`/night/stores/${storeId}/products`),
  /** 提交夜宵订单（服务端全量重验+券锁定+库存原子扣减） */
  submitOrder: (data: {
    requestId?: string;
    expectedProductAmount?: number;
    expectedDeliveryFee?: number;
    storeId: string;
    items: Array<{ productId: string; quantity: number; asSeckill?: boolean; promotionId?: string }>;
    couponId?: string;
    addressId: string;
    remark?: string;
  }) => request<NightOrder>("/night/orders", { method: "POST", data }),
  /** 我的夜宵订单（status 过滤；服务端懒关超时未支付单） */
  orders: (status = "all", page = 1) =>
    request<{ items: NightOrder[]; total: number; page: number; pageSize: number }>(`/night/orders?status=${encodeURIComponent(status)}&page=${page}&pageSize=20`),
  /** 夜宵订单详情 */
  order: (id: string) => request<NightOrder>(`/night/orders/${id}`),
  /** 取消订单（未接单；已支付走原路退款） */
  cancelOrder: (id: string, reason?: string) =>
    request<NightOrder>(`/night/orders/${id}/cancel`, {
      method: "POST",
      data: { reason },
    }),
  /** 确认收货（delivered → completed） */
  confirmOrder: (id: string) =>
    request<NightOrder>(`/night/orders/${id}/confirm`, { method: "POST" }),
  /** 售后申请（一期轻量：类型+文字描述） */
  applyAfterSale: (
    id: string,
    data: { type: string; description: string; images?: string[]; productIds?: string[] },
  ) =>
    request<{ id: string; afterSaleStatus: string }>(
      `/night/orders/${id}/after-sale`,
      { method: "POST", data },
    ),
  afterSales: (page = 1) => request<{ items: NightOrder[]; refundedAmount: number; total: number; page: number; pageSize: number }>(`/night/after-sales?page=${page}&pageSize=20`),
  withdrawAfterSale: (id: string) => request<{ id: string; afterSaleStatus: string }>(`/night/orders/${id}/after-sale/withdraw`, { method: 'POST' }),
  /** 夜宵订单微信支付下单（YX 业务标记） */
  prepay: (orderId: string) =>
    request<NightPrepayResult>(`/night/orders/${orderId}/pay`, {
      method: "POST",
    }),
  /** 支付结果查询（查单兜底落账） */
  payStatus: (orderId: string) =>
    request<NightPayStatus>(`/night/orders/${orderId}/pay-status`),
  /** 夜宵券（可领+我的，businessType=night 隔离） */
  coupons: () => request<NightCouponBundle>("/night/coupons"),
  /** 领取夜宵券（白天券在夜宵渠道拒收） */
  claimCoupon: (couponId: string) =>
    request<UserCoupon>(`/night/coupons/${couponId}/claim`, {
      method: "POST",
    }),
  /** 复用白天地址列表（夜宵结算按楼栋过滤） */
  addresses: fetchAddresses,
};
