const appId = String(import.meta.env.VITE_WECHAT_APP_ID || "").trim();
const appName = String(import.meta.env.VITE_APP_NAME || "").trim();

if (!appId) {
  throw new Error("缺少 VITE_WECHAT_APP_ID，请使用对应品牌的 dev/build 命令启动");
}
if (!appName) {
  throw new Error("缺少 VITE_APP_NAME，请使用对应品牌的 dev/build 命令启动");
}

/** 当前构建对应的微信小程序 AppID，也是 API 识别组织的唯一客户端标识。 */
export const WECHAT_APP_ID = appId;
/** 当前构建对应的小程序展示名称。 */
export const APP_NAME = appName;
