import { BASE_URL } from "../api/base";
import { WECHAT_APP_ID } from "../config/app";

/**
 * IKSN19 新用户首启校区门（跨校区新人券漏发治理）：
 * 登录前先决定要带的 campusId，优先级——
 * 1. storage 已有 selectedCampusId（此前确认/选过）：直接复用，token 过期静默重登也带它；
 * 2. 按 appid 拉开放校区列表（GET /auth/mini-program-campuses，匿名可调）：
 *    - 单校区（小满/大雄）：静默直落唯一校区，不弹任何页面、不依赖后端 fallback；
 *    - 多校区（不出寝）：打开阻断式确认页（pages/campus/confirm），确认页内
 *      登录成功才放行所有挂起的登录等待方；分享链路校区在列表内则预选（可改选）；
 *    - 列表拉取失败 / 用户未经确认离开确认页（iOS 侧滑等）：返回空串，
 *      走现状静默登录兜底（分享校区仍随 IKGZSU 语义带上），绝不卡死在启动环节。
 * 老用户（已有 token）不进本模块；401 过期静默重登传 allowConfirmPage=false，
 * 只读缓存不拉列表不弹页（老用户现状不变）。
 * 本模块被 api/request.ts 反向引用，故只依赖 api/base 的常量，不 import request。
 */
export interface BootCampusOption {
  id: string;
  name: string;
  shortName: string;
}
/** 已确认校区持久化键（IKSN19-D）：新用户首登与后续静默重登都显式落它 */
const SELECTED_KEY = "selectedCampusId";
export function readSelectedCampusId(): string {
  return (uni.getStorageSync(SELECTED_KEY) as string) || "";
}
export function rememberSelectedCampusId(id: string) {
  if (id) uni.setStorageSync(SELECTED_KEY, id);
}
/** IKGZSU 分享校区 storage 中转（IKSN19 补缺口）：分享落地页 onLoad 在
 *  首个请求前写入；App onLaunch 的 ensureLogin 抢先于页面 onLoad 触发登录，
 *  request 层又不能反依赖 store（成环）——分享校区经 storage 送达校区门。 */
const SHARED_KEY = "sharedCampusId";
export function setSharedCampusId(id: string) {
  if (id) uni.setStorageSync(SHARED_KEY, id);
}
export function readSharedCampusId(): string {
  return (uni.getStorageSync(SHARED_KEY) as string) || "";
}
function clearSharedCampusId() {
  uni.removeStorageSync(SHARED_KEY);
}
/** 匿名接口：本组织开放校区（type=campus + status=active），按创建时间升序。
 *  appid 必传（多品牌各查各的组织）；组织解析不到时后端回落全部开放校区。
 *  信封与 request 层同款（code=0），失败静默由调用方自行兜底。 */
export function fetchMiniProgramCampuses(): Promise<BootCampusOption[]> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/auth/mini-program-campuses?appid=${encodeURIComponent(WECHAT_APP_ID)}`,
      method: "GET",
      success(res) {
        const body = res.data as { code?: number; data?: BootCampusOption[] };
        if (
          res.statusCode >= 200 &&
          res.statusCode < 300 &&
          body?.code === 0 &&
          Array.isArray(body.data)
        ) {
          resolve(body.data);
          return;
        }
        reject(new Error(`校区列表拉取失败（${res.statusCode}）`));
      },
      fail: reject,
    });
  });
}

/* ---------- 阻断式确认页门 ---------- */
interface BootConfirmContext {
  options: BootCampusOption[];
  preselectId: string;
}
let confirmContext: BootConfirmContext | null = null;
let confirmWaiter: ((campusId: string) => void) | null = null;
let gatePromise: Promise<string> | null = null;
/** 确认页渲染上下文（pages/campus/confirm onShow 读取）；null=非门路径（页面自查） */
export function readBootConfirmContext(): BootConfirmContext | null {
  return confirmContext;
}
/**
 * 登录前决策入口：返回要带的 campusId（空串=不带，走后端 fallback）。
 * 并发登录调用方共享同一份决策；确认页路径的承诺要到确认页回传才兑现，
 * 期间所有登录调用方挂起，不会漏出无 campusId 的首登。
 */
export function resolveLoginCampus(
  opts: { sharedCampusId?: string; allowConfirmPage?: boolean } = {},
): Promise<string> {
  const cached = readSelectedCampusId();
  if (cached) return Promise.resolve(cached);
  // token 过期静默重登（老用户）：后端对老用户忽略 campusId，无缓存直接兜底，
  // 不拉列表不弹页（IKSN19：老用户现状不变，也省一次网络往返）
  if (opts.allowConfirmPage === false) return Promise.resolve("");
  gatePromise ??= decideFirstCampus(opts.sharedCampusId || "");
  const decided = gatePromise;
  // 空串结果不缓存：失败兜底/未确认离开后，下次登录尝试重新决策（网络恢复能接上）
  void decided.then((id) => {
    if (!id) gatePromise = null;
  });
  return decided;
}
async function decideFirstCampus(sharedCampusId: string): Promise<string> {
  let list: BootCampusOption[];
  try {
    list = await fetchMiniProgramCampuses();
  } catch {
    return ""; // 列表接口失败（网络差/异常）：现状静默登录兜底；
    // 分享校区键保留，兜底登录仍按 IKGZSU 语义带上
  }
  if (!list.length) return "";
  // 分享校区在这里才读（而非函数入参处）：App onLaunch 的 ensureLogin 抢先
  // 于分享落地页 onLoad 执行，列表网络往返期间 onLoad 必然已写好 storage 键
  const shared = sharedCampusId || readSharedCampusId();
  clearSharedCampusId(); // 决策已捕获分享校区；仅失败出口保留键供兜底登录
  if (list.length === 1) {
    // 单校区组织：静默直落唯一校区，显式带 campusId，不依赖后端 fallback
    rememberSelectedCampusId(list[0].id);
    return list[0].id;
  }
  // 多校区组织：阻断式确认页。分享校区在列表内才预选，已下架/非法回落第一项
  confirmContext = {
    options: list,
    preselectId: list.some((c) => c.id === shared) ? shared : list[0].id,
  };
  return openConfirmPage();
}
function openConfirmPage(): Promise<string> {
  return new Promise<string>((resolve) => {
    confirmWaiter = resolve;
    const navigate = () =>
      uni.navigateTo({
        url: "/pages/campus/confirm",
        // 冷启动首页推入途中可能撞导航过渡：失败重试一次，再失败兜底放行不卡死
        fail: () =>
          setTimeout(() => {
            if (confirmWaiter !== resolve) return;
            uni.navigateTo({
              url: "/pages/campus/confirm",
              fail: () => finishBootConfirm(""),
            });
          }, 350),
      });
    navigate();
  });
}
/** 确认页回传结果：campusId=已确认（页面内登录成功，token 已落）；
 *  空串=未经确认离开，等待方走无 campusId 的兜底登录。 */
export function finishBootConfirm(campusId: string) {
  const waiter = confirmWaiter;
  confirmWaiter = null;
  confirmContext = null;
  waiter?.(campusId);
}
