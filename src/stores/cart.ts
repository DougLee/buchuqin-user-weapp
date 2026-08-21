import { defineStore } from "pinia";
import { api } from "../api";
import type { Cart, Product } from "../types";
import { useSessionStore } from "./session";
export const useCartStore = defineStore("cart", {
  state: () => ({
    cart: {
      items: [],
      productAmount: 0,
      totalQuantity: 0,
      /** 起送门槛初始占位：10 元 = 1000 分（真实值以 GET /cart 返回为准） */
      deliveryThreshold: 1000,
    } as Cart,
    loading: false,
    /**
     * 待落库数量（IK9AWM）：set() 调用即写入，quantity() 优先读这里，
     * 连点加号时后续调用不再读到同一个旧值，增量不丢。
     */
    pending: {} as Record<string, number>,
    /** set() 串行链（IK9AWM）：PUT 全量购物车，并发请求互相覆盖，必须按序 */
    _chain: Promise.resolve() as Promise<unknown>,
    /**
     * 本地清车时间戳（IKA08U 重开）：查单落账是异步的，服务端清车可能
     * 滞后支付弹窗成功几秒；首页 onShow / 弹层唤起的重拉会在窗口期内
     * 把已购商品"复活"回悬浮条，load() 据此短路
     */
    clearedAt: 0,
  }),
  actions: {
    async load() {
      await useSessionStore().ensureLogin();
      // IKA08U 重开：清车后 60s 内且本地为空 → 跳过重拉；一旦有新加购
      // （set() 会更新 items 并清零 clearedAt）恢复与服务端同步
      if (
        this.clearedAt &&
        Date.now() - this.clearedAt < 60_000 &&
        !this.cart.items.length
      )
        return;
      this.loading = true;
      try {
        this.cart = await api.cart();
        if (this.cart.items.length) this.clearedAt = 0;
      } finally {
        this.loading = false;
      }
    },
    /**
     * 支付成功后本地清空（IKA08U）：服务端在查单落账时已清购物车行，
     * 这里同步抹掉缓存与 pending 意图，返回首页弹层不再显示已购商品
     */
    clearLocal() {
      this.cart = {
        items: [],
        productAmount: 0,
        totalQuantity: 0,
        deliveryThreshold: this.cart.deliveryThreshold,
      };
      this.pending = {};
      this.clearedAt = Date.now();
    },
    /**
     * 设置某商品数量（绝对值），连点安全（IK9AWM）：
     * 意图先记 pending（UI 即时反馈）→ 请求挂串行链，构建时合并当前全部
     * pending（后写覆盖先写）→ 成功只清未被覆盖的意图，失败回滚并 toast。
     * 返回是否写入成功，调用方决定是否给成功提示。
     */
    set(product: Product, quantity: number): Promise<boolean> {
      this.pending[product.id] = Math.max(0, quantity);
      const run = this._chain.then(async () => {
        if (!Object.keys(this.pending).length) return;
        const snapshot = { ...this.pending };
        const map = new Map(
          this.cart.items.map((i) => [i.product.id, i.quantity]),
        );
        for (const [id, q] of Object.entries(snapshot)) map.set(id, q);
        try {
          this.cart = await api.updateCart(
            [...map].map(([productId, q]) => ({ productId, quantity: q })),
          );
          // IKA08U 重开：加购成功即脱离"刚清空"状态，load() 恢复与服务端同步
          if (this.cart.items.length) this.clearedAt = 0;
          for (const [id, q] of Object.entries(snapshot))
            if (this.pending[id] === q) delete this.pending[id];
        } catch (error) {
          // 回滚未被后续连点覆盖的意图（已被覆盖的留给下一个排队请求重试）
          for (const [id, q] of Object.entries(snapshot))
            if (this.pending[id] === q) delete this.pending[id];
          // 提醒由 request 层统一 toast（ADR-0005 IKA00Q：库存不足等业务原因
          // 直接透出，不再用"同步失败"笼统文案二次弹）
          throw error;
        }
      });
      this._chain = run.catch(() => {});
      return run.then(
        () => true,
        () => false,
      );
    },
    quantity(id: string) {
      if (id in this.pending) return this.pending[id];
      return this.cart.items.find((i) => i.product.id === id)?.quantity ?? 0;
    },
  },
});
