import { defineStore } from "pinia";
import { api } from "../api";
import { SERVICE_PHONE } from "../utils/service";
import type { CampusCloseState } from "../types";

/**
 * 校区打烊状态（IKGI1C）：闭店五字段随校区视图下发——首页走 /home 的 campus
 * （不加请求），分类页/详情页 onShow/onLoad 走 /campus/current 轻量自刷新。
 * closedNow 由服务端实时判定（客户端时钟不可信），前端只消费不自算。
 * IKHMF1 客服电话：servicePhone 随校区视图同批落库，未下发回落本地常量
 * （冷启动首屏不闪空号）。
 */
export const useCampusStore = defineStore("campus", {
  state: () => ({
    close: { closedNow: false } as CampusCloseState,
    servicePhone: "",
  }),
  getters: {
    closedNow: (state) => !!state.close.closedNow,
    closedReason: (state) => state.close.closedReason ?? null,
    /** 客服电话（IKHMF1）：校区自定义，无值回落本地默认常量 */
    phone: (state) => state.servicePhone || SERVICE_PHONE,
    /** 置灰主按钮短文案（详情页 disabled 态用） */
    closedLabel(): string {
      return this.closedReason === "manual" ? "商家已休息" : "已打烊";
    },
    /** 点按置灰按钮的 toast：给明确的恢复时点（与服务端拦截文案同口径） */
    closedToast(): string {
      if (this.closedReason === "manual") return "商家已休息，暂停接单";
      return this.close.closeEnd
        ? `已打烊，${this.close.closeEnd} 恢复接单`
        : "已打烊，暂停接单";
    },
    /** 首页横幅长文案：让人知道现在买不了、几点恢复 */
    closedBanner(): string {
      if (this.closedReason === "manual") return "商家已休息，暂停接单";
      const { closeStart, closeEnd } = this.close;
      if (!closeStart || !closeEnd) return "已打烊，恢复接单时间以店铺通知为准";
      // 跨零点窗（start > end，如 22:00–08:00）标注「次日」，同日窗直接给区间
      return closeStart > closeEnd
        ? `今日 ${closeStart} 起打烊，次日 ${closeEnd} 恢复接单`
        : `每日 ${closeStart}–${closeEnd} 打烊，${closeEnd} 恢复接单`;
    },
  },
  actions: {
    /** 并入校区视图下发的闭店字段（/home 或 /campus/current 任一来源） */
    apply(campus?: CampusCloseState | null) {
      if (!campus) return;
      this.close = { ...campus };
      // IKHMF1：客服电话同批落（campus 行字段，两来源都有）
      const phone = (campus as { servicePhone?: string }).servicePhone;
      if (phone) this.servicePhone = phone;
    },
    /** 轻量自刷新：失败静默沿用旧态，不拦页面主流程 */
    async refresh() {
      try {
        this.apply(await api.currentCampus());
      } catch {
        /* 打烊态拉取失败保持现状（下次 onShow 再试） */
      }
    },
  },
});
