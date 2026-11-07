import { defineStore } from "pinia";
import { api } from "../api";
import { useCartStore } from "./cart";
import { useNightCartStore } from "./nightCart";
import { uploadImage } from "../api/request";
import {
  finishBootConfirm,
  readSharedCampusId,
  rememberSelectedCampusId,
  resolveLoginCampus,
} from "../utils/bootCampus";
import type { SessionUser } from "../types";
// #ifdef MP-WEIXIN
/** wx.login 取 code（小程序正式登录通道用） */
function wxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) =>
    uni.login({
      provider: "weixin",
      success: (res) =>
        res.code ? resolve(res.code) : reject(new Error("uni.login 未返回 code")),
      fail: reject,
    }),
  );
}
// #endif
/** 并发登录去重句柄（IKC7WB）：模块级变量，不进 Pinia state（Promise 不可序列化） */
let loginInFlight: Promise<void> | null = null;

export const useSessionStore = defineStore("session", {
  state: () => ({
    ready: false,
    user: null as SessionUser | null,
    /** 首次微信登录后端给的是"微信用户"，需要引导用户改昵称 */
    needsNickname: false,
    /** IKDETO 迎新礼包：当次登录即注册（isNewUser）——首页据此弹一次礼包弹窗 */
    justSignedUp: false,
    /** IKDETO 红点：存在未使用的新人（signup）券，「我的」tab 常亮 */
    hasUsableSignupCoupon: false,
    /** IKGZSU 跨校区分享：分享链接带来的校区 id，首登时采用（详情页/首页 onLoad 写入） */
    pendingCampus: "",
  }),
  getters: {
    nickname: (state) => state.user?.nickname || "",
    /** IKE3HT 强授权门：已登录但未绑定手机号 = 拦截（未登录时不拦，登录流程自己走） */
    needsPhone: (state) => !!state.user && !state.user.phone,
  },
  actions: {
    async ensureLogin() {
      if (this.ready) return;
      if (loginInFlight) return loginInFlight;
      const cached = uni.getStorageSync("token") as string;
      if (cached) {
        // 已有 token：静默换取用户信息即可，不再每次刷新都打登录接口（限流 10 次/分/IP）。
        // token 过期时 request 层会自动清 token 重登并重试本请求。
        this.applyUser(await api.profile());
        return;
      }
      // 正式通道（ADR-0004）：微信登录；test-login 已随后端下线，
      // H5 等非小程序环境无登录通道，明确报错（开发调试请在微信开发者工具进行）
      // #ifndef MP-WEIXIN
      throw new Error("请在微信小程序中打开");
      // #endif
      // IKC7WB：登录主体挂到 loginInFlight，并发调用复用同一请求
      loginInFlight = (async () => {
        // IKGZSU 跨校区分享：新用户首登优先落分享链接带来的校区（后端校验，
        // 非法值静默忽略）；仅无 token 的首登路径有意义，消费后即清
        const sharedCampus = this.pendingCampus;
        // IKSN19 校区门：单校区静默直落唯一校区；多校区先过阻断式确认页
        // （确认页内登录成功时 ready 已置真，复查直接返回不再二次登录）；
        // 列表拉取失败返回空串——分享校区仍按 IKGZSU 语义带上（即现状兜底）
        const campusId = await resolveLoginCampus({ sharedCampusId: sharedCampus });
        this.pendingCampus = "";
        if (this.ready) return;
        const result = await api.wechatLogin(
          await wxLoginCode(),
          // App onLaunch 抢先于落地页 onLoad 时 store 的 pendingCampus 为空，
          // 兜底再读 storage 中转键（IKSN19：request 层与校区门同一来源）
          campusId || sharedCampus || readSharedCampusId() || undefined,
        );
        uni.setStorageSync("token", result.token);
        this.applyUser(result.user);
        // IKDETO：注册当次置位（首页 onShow 消费后自清，只弹一次）
        this.justSignedUp = result.isNewUser === true;
      })();
      try {
        await loginInFlight;
      } finally {
        loginInFlight = null;
      }
    },
    /** 写入会话用户并完成初始化（登录 / token 换取资料两条路径共用） */
    applyUser(user: SessionUser) {
      useNightCartStore().setOwner(user.id, user.campusId);
      useCartStore().setOwner(user.id, user.campusId);
      this.user = user;
      this.needsNickname =
        (!user.nickname || user.nickname === "微信用户");
      this.ready = true;
    },
    /**
     * 切换校区（IKAJT2）：JWT 带 campusId claim，后端换发新 token，
     * 这里按登录同款落库（token 覆写 + user 刷新），页面 onShow 重拉即新校区口径。
     */
    async switchCampus(campusId: string) {
      const result = await api.selectCampus(campusId);
      // IKSN19-D：所选校区持久化，后续 token 过期静默重登显式落同校区
      rememberSelectedCampusId(campusId);
      uni.setStorageSync("token", result.token);
      this.applyUser(result.user);
    },
    /**
     * IKSN19 校区确认页专用首登：带所选 campusId 完成微信登录，成功才
     * finishBootConfirm 放行所有挂起的登录等待方（等待方见 ready=true 直接复用，
     * 不再二次打登录接口）。失败原样抛出（request 层已 toast），确认页捕获后
     * 停留本页供用户重试（E：登录失败重试兜底，不卡死）。
     */
    async confirmFirstLogin(campusId: string) {
      const result = await api.wechatLogin(await wxLoginCode(), campusId);
      rememberSelectedCampusId(campusId);
      uni.setStorageSync("token", result.token);
      this.applyUser(result.user);
      this.justSignedUp = result.isNewUser === true;
      this.pendingCampus = "";
      finishBootConfirm(campusId);
    },
    /** 改昵称（IK9ROG）：落库为准，成功后同步当前会话展示 */
    async setNickname(name: string) {
      const value = name.trim().slice(0, 12);
      if (!value) return;
      const result = await api.updateProfile({ nickname: value });
      if (this.user) this.user = { ...this.user, nickname: result.nickname };
      this.needsNickname = false;
    },
    /** 换头像（IK9ROG）：微信头像临时路径先传 COS，URL 落库后本地同步 */
    async setAvatar(avatarUrl: string) {
      const url = await uploadImage(avatarUrl);
      const result = await api.updateProfile({ avatar: url });
      if (this.user) this.user = { ...this.user, avatar: result.avatar };
    },
    /** 手输绑定（H5 / 微信授权码降级路径） */
    async bindPhone(phone: string) {
      await api.bindPhone({ phone });
      if (this.user) this.user = { ...this.user, phone };
    },
    /** 微信授权码绑定：后端用 code 换取真实手机号并回传，本地以回传值刷新展示 */
    async bindPhoneByCode(code: string) {
      const result = await api.bindPhone({ code });
      if (this.user) this.user = { ...this.user, phone: result.phone };
      return result.phone;
    },
  },
});
