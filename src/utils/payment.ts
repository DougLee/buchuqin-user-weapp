import { api } from "../api";
import type { WechatPayParams } from "../types";

/** 缓存的订阅消息模板 ID（进页预载；首次支付前若未取到则本次跳过授权）。 */
let cachedTemplateIds: string[] = [];

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
 * 预载订阅消息模板 ID（checkout / 订单列表 / 订单详情 onShow 调用）。
 * 静默失败：拿不到就不请求授权，不影响支付主流程。
 */
export async function preloadPayTemplates(): Promise<void> {
  try {
    const res = await api.subscribeTemplates();
    cachedTemplateIds = (res.templates ?? []).filter(Boolean);
  } catch {
    /* 401/网络异常等一律静默 */
  }
}

/**
 * 支付前请求订阅消息授权（ADR-0004 精简两条：支付成功 + 送达提醒）。
 * 必须在用户点按的同步链路里调用（微信手势上下文要求），所以放在 startPayFlow
 * 内所有 await 之前；用户拒绝或环境不支持一律静默，绝不阻塞支付。
 */
function requestSubscribeAuth(): void {
  if (!cachedTemplateIds.length) return;
  uni.requestSubscribeMessage({
    tmplIds: cachedTemplateIds.slice(0, 3),
    fail: () => {
      /* 拒绝授权/低版本基础库：静默跳过 */
    },
  });
}

/**
 * 支付收银台统一流程（IK8W5R → ADR-0004 真实化）：
 * 1. 请求订阅消息授权（若有缓存模板；在任何网络请求之前，保持手势上下文）
 * 2. POST /payments/wechat/prepay 拿预支付参数（商户未配置时 501，错误透传给调用方提示）
 * 3. uni.requestPayment 拉起微信收银台 → GET /payments/:orderId/status 确认结果
 * 返回是否已支付；取消/失败返回 false，由调用方跳订单详情页提供"继续支付"入口，不留死路。
 */
export async function startPayFlow(orderId: string): Promise<boolean> {
  requestSubscribeAuth();
  const prepay = await api.prepay(orderId);
  if (!prepay.payParams) return false;
  // 顺手缓存本次下发的模板 ID，下次支付前即可正常请求授权
  if (prepay.subscribeTemplates?.length)
    cachedTemplateIds = prepay.subscribeTemplates.filter(Boolean);
  try {
    await requestPayment(prepay.payParams);
  } catch {
    // 用户取消收银台或支付失败：订单仍为待支付，详情页可继续支付
    return false;
  }
  const status = await api.paymentStatus(orderId);
  return status.paid;
}
