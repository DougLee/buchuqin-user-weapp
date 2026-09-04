import type { ApiResult, LoginResult } from "../types";
export const BASE_URL =
  // 本机 API 固定 3100（3000 被占），dev 裸跑不再需要前置 VITE_API_BASE_URL；生产构建同源相对路径 /api/v1
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3100/api/v1";
const ORIGIN = BASE_URL.replace(/\/api\/v1\/?$/, "");
/** 后端返回的相对资源路径（如 /api/v1/uploads/xx.jpg）拼成可访问的完整地址 */
export function toAbsoluteUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${ORIGIN}${url}`;
}
/** @dcloudio/types 未收录 PATCH（微信基础库 wx.request 已支持），这里放宽 method */
type RequestOptions = Omit<UniApp.RequestOptions, "url" | "method"> & {
  method?: UniApp.RequestOptions["method"] | "PATCH";
  /** 静默请求（IKD6FH）：失败不弹全局 toast，由调用方自行降级（如寝室列表 404 回退手填） */
  silent?: boolean;
};
function isApiResult<T>(value: unknown): value is ApiResult<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "data" in value
  );
}
/** ADR-0005 错误分类：business=业务拒绝（重试无意义）；network=断网/超时；server=5xx。两者后者才值得「点击重试」 */
export type ApiErrorKind = "business" | "network" | "server";
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  constructor(message: string, kind: ApiErrorKind, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}
/** 网络失败/服务故障才可重试（ADR-0005）：页面错误态/重试卡只认这个 */
export function isRetryable(e: unknown): boolean {
  return e instanceof ApiError && e.kind !== "business";
}
/** Nest 校验管道的 message 是数组（如 ["addressId must be a string"]），拼成一句 */
function readableMessage(raw: unknown): string {
  if (Array.isArray(raw)) return raw.filter(Boolean).join("；");
  return typeof raw === "string" && raw ? raw : "";
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
/** 登录通道：小程序只走微信登录（正式通道，失败不回退；test-login 已随 ADR-0004 下线）。
 *  H5 等非小程序环境无登录通道，直接拒绝。 */
function loginFlow(): Promise<string> {
  // #ifndef MP-WEIXIN
  return Promise.reject(new Error("请在微信小程序中打开"));
  // #endif
  // #ifdef MP-WEIXIN
  return wechatLogin().catch((error) => {
    // 失败给用户明确提示，由用户重试（凭证未配/网络异常都会走到这里）
    const message =
      error instanceof WechatLoginNotConfigured
        ? "登录服务未配置，请联系管理员"
        : "微信登录失败，请重试";
    uni.showToast({ title: message, icon: "none" });
    throw error instanceof Error ? error : new Error(message);
  });
  // #endif
}
/** 真正的登录通道：401 不能靠"重登"自愈（会死循环）；profile 等带鉴权接口允许自动重登 */
const LOGIN_CHANNELS = ["/auth/wechat-login"];
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
  // silent 是本层约定，不透传给 uni.request（IKD6FH）
  const { silent, ...rest } = options;
  const token = await ensureToken(path);
  const send = (authToken: string, retried: boolean) =>
    new Promise<T>((resolve, reject) => {
      uni.request({
        ...(rest as UniApp.RequestOptions),
        url: `${BASE_URL}${path}`,
        header: {
          "content-type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(rest.header || {}),
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
          // ADR-0005：错误分类收敛在 request 层，toast 是业务提醒唯一出口，
          // 页面不得重复提醒；401 不 toast（登录通道已提示）
          const raw =
            typeof res.data === "object" && res.data !== null
              ? (res.data as { message?: unknown }).message
              : undefined;
          const detail = readableMessage(
            isApiResult<T>(res.data) ? res.data.message : raw,
          );
          let apiError: ApiError;
          if (res.statusCode === 401) {
            apiError = new ApiError("登录已过期，请重试", "business", 401);
          } else if (res.statusCode === 429) {
            apiError = new ApiError(
              "操作太频繁，请 1 分钟后再试",
              "business",
              429,
            );
          } else if (res.statusCode >= 500) {
            apiError = new ApiError(
              "服务暂时不可用，请稍后再试",
              "server",
              res.statusCode,
            );
          } else {
            apiError = new ApiError(
              detail || `请求失败（${res.statusCode}）`,
              "business",
              res.statusCode,
            );
          }
          if (res.statusCode !== 401 && !silent)
            uni.showToast({ title: apiError.message, icon: "none" });
          reject(apiError);
        },
        fail() {
          if (!silent)
            uni.showToast({ title: "网络异常，请检查网络后重试", icon: "none" });
          reject(new ApiError("网络异常，请检查网络后重试", "network"));
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
