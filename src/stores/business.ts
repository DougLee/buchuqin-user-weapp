import { defineStore } from "pinia";
import { api } from "../api";
import { nightApi } from "../api/night";
import type { NightEntry } from "../types/night";

type BusinessEntry = Pick<NightEntry, "inNightSession">;

/** 渠道缓存 60s；过期读取等待刷新，避免页面复制旧值后错过后台更新。
 * 换身份和 reset 会隔离并发请求；结算仍独立向服务端核验。 */
const ENTRY_TTL = 60_000;
/** 并发去重：首次进入多页面同时 ensureEntry 只发一次请求（Promise 无需响应式） */
let entryInflight: { identity: string; promise: Promise<BusinessEntry> } | null = null;
let revision = 0;

function currentIdentity() {
  return `${String(uni.getStorageSync("token") || "")} ${String(
    uni.getStorageSync("nightCartOwner") || "",
  )} ${String(uni.getStorageSync("selectedAddressId") || "")}`;
}

export const useBusinessStore = defineStore("business", {
  state: () => ({
    entry: null as BusinessEntry | null,
    fetchedAt: 0,
    identity: "",
  }),
  getters: {
    /** 当前收货楼栋夜宵店是否有效营业，由服务端判定。 */
    inNightSession: (s) => s.entry?.inNightSession === true,
    channel: (s): "day" | "night" => (s.entry?.inNightSession ? "night" : "day"),
  },
  actions: {
    /** 只复用当前身份且未过期的结果，刷新失败上抛。 */
    async ensureEntry(): Promise<BusinessEntry> {
      const identity = currentIdentity();
      if (this.identity !== identity) {
        this.entry = null;
        this.identity = identity;
      }
      if (this.entry && Date.now() - this.fetchedAt < ENTRY_TTL) return this.entry;
      return this.refresh();
    },
    async refresh(): Promise<BusinessEntry> {
      const identity = currentIdentity();
      if (entryInflight?.identity === identity) return entryInflight.promise;
      const requestRevision = revision;
      const assertCurrent = () => {
        if (currentIdentity() !== identity || revision !== requestRevision)
          throw new Error("身份或校区已变化，请重试");
      };
      const pending = (async () => {
        const campus = await api.currentCampus();
        assertCurrent();
        // A confirmed disabled campus never needs the night entry/address lookup.
        // Missing flags from older APIs still require the authoritative entry check.
        const data = campus.nightEnabled === false
          ? { inNightSession: false }
          : await nightApi.entry();
        assertCurrent();
        this.entry = data;
        this.fetchedAt = Date.now();
        this.identity = identity;
        return data;
      })().finally(() => {
        if (entryInflight?.promise === pending) entryInflight = null;
      });
      entryInflight = { identity, promise: pending };
      return pending;
    },
    /** 换账号/换校区时由 session 钩子调用（与 cart.setOwner 并列） */
    reset() {
      revision++;
      entryInflight = null;
      this.entry = null;
      this.fetchedAt = 0;
      this.identity = "";
    },
  },
});
