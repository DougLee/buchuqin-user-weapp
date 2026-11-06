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
 * 支付成功后按账号、店铺扣除该订单数量；保留后来加购商品，重复查单不重复扣。
 */
export async function startNightPayFlow(
  orderId: string,
  storeId?: string,
): Promise<boolean> {
  const consume = async () => {
    if (!storeId) return;
    try { const paidOrder = await nightApi.order(orderId); useNightCartStore().consumeOrder(storeId, orderId, paidOrder.items); }
    catch { /* 支付已确认，购物车刷新失败不改变支付结果；详情仍可核对。 */ }
  };
  const existing = await nightApi.payStatus(orderId);
  if (['cancelled', 'refunded', 'exception'].includes(existing.status)) return false;
  if (existing.paid) {
    await consume();
    return true;
  }
  const prepay = await nightApi.prepay(orderId);
  if (!prepay.payParams) return false;
  try {
    // #ifdef H5
    if (import.meta.env.DEV && import.meta.env.VITE_NIGHT_LOCAL_PREVIEW === 'true' && prepay.payParams.appId === 'LOCAL_PREVIEW_ONLY') {
      const choice = await uni.showModal({ title: '本机模拟支付', content: '仅验证独立测试库内的订单流程，不会真实扣款。确认模拟支付？', confirmText: '模拟支付', cancelText: '取消' });
      if (!choice.confirm) return false;
      const response = await fetch('/__night-preview/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
      if (!response.ok) throw new Error('本机模拟支付失败');
    } else
    // #endif
    await requestPayment(prepay.payParams);
  } catch {
    // 用户取消收银台或支付失败：订单仍为待支付，详情页可继续支付
    return false;
  }
  const status = await nightApi.payStatus(orderId);
  if (status.paid) await consume();
  return status.paid;
}
