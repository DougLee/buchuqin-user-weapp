import type { ApiResult, LoginResult } from "../types";
export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
const ORIGIN = BASE_URL.replace(/\/api\/v1\/?$/, "");
/** 后端返回的相对资源路径（如 /api/v1/uploads/xx.jpg）拼成可访问的完整地址 */
export function toAbsoluteUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${ORIGIN}${url}`;
}
/** @dcloudio/types 未收录 PATCH（微信基础库 wx.request 已支持），这里放宽 method */
type RequestOptions = Omit<UniApp.RequestOptions, "url" | "method"> & {
  method?: UniApp.RequestOptions["method"] | "PATCH";
};
function isApiResult<T>(value: unknown): value is ApiResult<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "data" in value
  );
}
/** 低层 POST：不走统一 request（避免触发 ensureToken 递归），保留状态码供登录回退判断 */
function post(
  path: string,
  data: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) =>
    uni.request({
      url: `${BASE_URL}${path}`,
      method: "POST",
      data,
      header: { "content-type": "application/json" },
      success(res) {
        resolve({ status: res.statusCode, body: res.data });
      },
      fail: reject,
    }),
  );
}
function tokenFrom(body: unknown): string {
  if (isApiResult<LoginResult>(body)) return body.data.token;
  throw new Error("登录失败");
}
/** 演示登录通道（本地/H5/微信登录未配置时的回退兜底） */
async function testLogin(): Promise<string> {
  const { status, body } = await post("/auth/test-login", {
    identity: "user",
  });
  if (status >= 300) throw new Error("登录失败");
  return tokenFrom(body);
}
// #ifdef MP-WEIXIN
/** 后端 WX_APPID/WX_SECRET 未配置时返回 501"微信登录未配置"，需回退 test-login */
class WechatLoginNotConfigured extends Error {}
function wxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) =>
    uni.login({
      provider: "weixin",
      success(res) {
        if (res.code) resolve(res.code);
        else reject(new Error("uni.login 未返回 code"));
      },
      fail: reject,
    }),
  );
}
async function wechatLogin(): Promise<string> {
  const code = await wxLoginCode();
  // 双小程序凭证路由（IK8W5Q）：带上本端 appid，后端挑对应 secret
  const { status, body } = await post("/auth/wechat-login", {
    code,
    appid: "wxc814687e5ae26924",
  });
  if (status === 501) throw new WechatLoginNotConfigured();
  if (status >= 300) throw new Error("微信登录失败");
  return tokenFrom(body);
}
// #endif
/** 登录通道选择：小程序只走微信登录（正式通道，失败不回退）；
 *  H5 等无 uni.login 的环境保留 test-login 演示通道 */
function loginFlow(): Promise<string> {
  // #ifdef MP-WEIXIN
  return wechatLogin().catch((error) => {
    // 正式通道（2026-08-18 道哥拍板）：小程序不再回退 test-login，
    // 失败给用户明确提示，由用户重试（凭证未配/网络异常都会走到这里）
    const message =
      error instanceof WechatLoginNotConfigured
        ? "登录服务未配置，请联系管理员"
        : "微信登录失败，请重试";
    uni.showToast({ title: message, icon: "none" });
    throw error instanceof Error ? error : new Error(message);
  });
  // #endif
  // #ifndef MP-WEIXIN
  return testLogin();
  // #endif
}
/** 真正的登录通道：401 不能靠"重登"自愈（会死循环）；profile 等带鉴权接口允许自动重登 */
const LOGIN_CHANNELS = ["/auth/test-login", "/auth/wechat-login"];
let loginPromise: Promise<string> | undefined;
async function ensureToken(path: string, force = false) {
  const cached = uni.getStorageSync("token") as string;
  if (!force && (cached || path.startsWith("/auth/"))) return cached;
  if (force) uni.removeStorageSync("token");
  loginPromise ??= loginFlow().then((token) => {
    uni.setStorageSync("token", token);
    return token;
  }).finally(() => (loginPromise = undefined));
  return loginPromise;
}
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = await ensureToken(path);
  const send = (authToken: string, retried: boolean) =>
    new Promise<T>((resolve, reject) => {
      uni.request({
        ...(options as UniApp.RequestOptions),
        url: `${BASE_URL}${path}`,
        header: {
          "content-type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(options.header || {}),
        },
        success: async (res) => {
          // token 过期/失效：清缓存强制重登一次后重试
          if (
            res.statusCode === 401 &&
            !retried &&
            !LOGIN_CHANNELS.includes(path)
          ) {
            try {
              const fresh = await ensureToken(path, true);
              resolve(await send(fresh, true));
            } catch (error) {
              reject(error instanceof Error ? error : new Error("登录失败"));
            }
            return;
          }
          if (
            isApiResult<T>(res.data) &&
            res.statusCode >= 200 &&
            res.statusCode < 300 &&
            res.data.code === 0
          ) {
            resolve(res.data.data);
            return;
          }
          // 非标准信封的报错：429 给人话；Nest 异常体 {statusCode,message} 取 message
          const nestError =
            typeof res.data === "object" && res.data !== null
              ? (res.data as { message?: string }).message
              : undefined;
          const message =
            res.statusCode === 429
              ? "操作太频繁，请 1 分钟后再试"
              : isApiResult<T>(res.data)
                ? res.data.message
                : nestError || `请求失败（${res.statusCode}）`;
          uni.showToast({ title: message || "请求失败", icon: "none" });
          reject(new Error(message));
        },
        fail(error) {
          uni.showToast({ title: "服务暂时不可用", icon: "none" });
          reject(error);
        },
      });
    });
  return send(token, false);
}
interface UploadResult {
  url: string;
}
/** 上传图片到 /files/images（≤5MB、image/*），返回后端持久化的相对 URL */
export async function uploadImage(filePath: string): Promise<string> {
  const token = await ensureToken("/files/images");
  const url = `${BASE_URL}/files/images`;
  // #ifdef H5
  const blob = await (await fetch(filePath)).blob();
  const form = new FormData();
  form.append("file", blob, "proof.jpg");
  const response = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const body = (await response.json()) as ApiResult<UploadResult>;
  if (!response.ok || body.code !== 0) {
    uni.showToast({ title: body.message || "图片上传失败", icon: "none" });
    throw new Error(body.message || "图片上传失败");
  }
  return body.data.url;
  // #endif
  // #ifndef H5
  return new Promise<string>((resolve, reject) => {
    uni.uploadFile({
      url,
      filePath,
      name: "file",
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        try {
          const body = JSON.parse(res.data) as ApiResult<UploadResult>;
          if (
            res.statusCode >= 200 &&
            res.statusCode < 300 &&
            body.code === 0
          ) {
            resolve(body.data.url);
            return;
          }
          throw new Error(body.message || "图片上传失败");
        } catch (error) {
          uni.showToast({ title: "图片上传失败", icon: "none" });
          reject(error instanceof Error ? error : new Error("图片上传失败"));
        }
      },
      fail(error) {
        uni.showToast({ title: "服务暂时不可用", icon: "none" });
        reject(error);
      },
    });
  });
  // #endif
}
