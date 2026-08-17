import { defineStore } from "pinia";
import { api } from "../api";
import type { SessionUser } from "../types";
/** 本地昵称覆盖（IK8W5Q：昵称编辑暂无后端接口，仅本地展示覆盖） */
const NICKNAME_KEY = "localNickname";
function readLocalNickname(): string {
  return (uni.getStorageSync(NICKNAME_KEY) as string) || "";
}
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
        // 已有 token：静默换取用户信息即可，不再每次刷新都打 test-login（限流 10 次/分/IP）。
        // token 过期时 request 层会自动清 token 重登并重试本请求。
        this.applyUser(await api.profile());
        return;
      }
      const result = await api.login();
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
    /** 改昵称：仅本地 storage 覆盖展示（后端暂无修改昵称接口） */
    setNickname(name: string) {
      const value = name.trim().slice(0, 12);
      if (!value) return;
      uni.setStorageSync(NICKNAME_KEY, value);
      if (this.user) this.user = { ...this.user, nickname: value };
      this.needsNickname = false;
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
