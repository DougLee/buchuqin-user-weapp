import { api } from "../api";
import type { WechatPayParams } from "../types";

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
 * 支付收银台统一流程（IK8W5R → ADR-0004 真实化）：
 * 1. POST /payments/wechat/prepay 拿预支付参数（商户未配置时 501，错误透传给调用方提示）
 * 2. uni.requestPayment 拉起微信收银台 → GET /payments/:orderId/status 确认结果
 * 返回是否已支付；取消/失败返回 false，由调用方跳订单详情页提供"继续支付"入口，不留死路。
 */
export async function startPayFlow(orderId: string): Promise<boolean> {
  const prepay = await api.prepay(orderId);
  if (!prepay.payParams) return false;
  try {
    await requestPayment(prepay.payParams);
  } catch {
    // 用户取消收银台或支付失败：订单仍为待支付，详情页可继续支付
    return false;
  }
  const status = await api.paymentStatus(orderId);
  return status.paid;
}
