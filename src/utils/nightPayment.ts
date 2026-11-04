import { nightApi } from "../api/night";
import { useNightCartStore } from "../stores/nightCart";
import type { WechatPayParams } from "../types";

/** 微信收银台（夜宵通道）：参数结构与白天一致，仅下单/查单端点不同 */
function requestPayment(params: WechatPayParams): Promise<void> {
  return new Promise((resolve, reject) =>
    uni.requestPayment({
      provider: "wxpay",
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign,
      success: () => resolve(),
      fail: reject,
    }),
  );
}

/**
 * 夜宵订单支付统一流程：
 * 1. POST /night/orders/:id/pay 预下单拉 payParams（商户未配置时业务错误
 *    由 request 层 toast，异常向上抛给调用方）
 * 2. uni.requestPayment 拉起收银台 → GET /night/orders/:id/pay-status
 *    确认结果（服务端查单兜底落账）
 * 返回是否已支付；用户取消/失败返回 false，调用方跳订单详情继续支付。
 * 支付成功且调用方传了 storeId 时清空该店铺夜宵本地购物车（夜宵购物车
 * 是客户端态，按 storeId 分桶，钱已付即清；列表/详情页传 order.store.id）。
 */
export async function startNightPayFlow(
  orderId: string,
  storeId?: string,
): Promise<boolean> {
  const prepay = await nightApi.prepay(orderId);
  if (!prepay.payParams) return false;
  try {
    await requestPayment(prepay.payParams);
  } catch {
    // 用户取消收银台或支付失败：订单仍为待支付，详情页可继续支付
    return false;
  }
  const status = await nightApi.payStatus(orderId);
  if (status.paid && storeId) useNightCartStore().clear(storeId);
  return status.paid;
}
