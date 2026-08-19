import { defineStore } from "pinia";
import { api } from "../api";
import { uploadImage } from "../api/request";
import type { SessionUser } from "../types";
/** 本地昵称覆盖（IK8W5Q：昵称编辑暂无后端接口，仅本地展示覆盖） */
const NICKNAME_KEY = "localNickname";
function readLocalNickname(): string {
  return (uni.getStorageSync(NICKNAME_KEY) as string) || "";
}
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
export const useSessionStore = defineStore("session", {
  state: () => ({
    ready: false,
    user: null as SessionUser | null,
    /** 首次微信登录后端给的是"微信用户"，需要引导用户改昵称 */
    needsNickname: false,
  }),
  getters: {
    nickname: (state) => readLocalNickname() || state.user?.nickname || "",
  },
  actions: {
    async ensureLogin() {
      if (this.ready) return;
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
      const result = await api.wechatLogin(await wxLoginCode());
      uni.setStorageSync("token", result.token);
      this.applyUser(result.user);
    },
    /** 写入会话用户并完成初始化（登录 / token 换取资料两条路径共用） */
    applyUser(user: SessionUser) {
      this.user = user;
      this.needsNickname =
        !readLocalNickname() &&
        (!user.nickname || user.nickname === "微信用户");
      this.ready = true;
    },
    /** 改昵称（IK9ROG）：落库为准，成功后本地 storage 双写做展示加速 */
    async setNickname(name: string) {
      const value = name.trim().slice(0, 12);
      if (!value) return;
      const result = await api.updateProfile({ nickname: value });
      uni.setStorageSync(NICKNAME_KEY, result.nickname);
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
