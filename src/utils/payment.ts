import { api } from "../api";
import type { WechatPayParams } from "../types";
import { fenToYuan } from "./money";

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

/** 演示通道金额确认：amount 为整数分（契约 API-3），展示文案统一除 100 转元 */
async function confirmMockPay(amount?: number): Promise<boolean> {
  const content = amount
    ? `微信支付未配置，演示通道确认支付 ¥${fenToYuan(amount)}`
    : "微信支付未配置，走演示通道完成支付";
  const { confirm } = await uni.showModal({ title: "确认支付", content });
  return confirm;
}

/**
 * 支付收银台统一流程（IK8W5R）：
 * 1. POST /payments/wechat/prepay 拿预支付参数
 * 2. mock:false → uni.requestPayment 拉起微信收银台 → GET /payments/:orderId/status 确认结果
 *    mock:true  → 微信支付商户号未配置，走原 POST /orders/:id/pay 演示通道（通道保留）
 * 返回是否已支付；取消/失败返回 false，由调用方跳订单详情页提供"继续支付"入口，不留死路。
 */
export async function startPayFlow(orderId: string): Promise<boolean> {
  const prepay = await api.prepay(orderId);
  if (prepay.mock || !prepay.payParams) {
    // 演示通道：确认后才真正扣款，取消则留在待支付（与收银台取消语义一致）
    if (!(await confirmMockPay(prepay.amount))) return false;
    await api.payOrder(orderId);
    return true;
  }
  try {
    await requestPayment(prepay.payParams);
  } catch {
    // 用户取消收银台或支付失败：订单仍为待支付，详情页可继续支付
    return false;
  }
  const status = await api.paymentStatus(orderId);
  return status.paid;
}
