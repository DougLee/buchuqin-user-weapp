import { defineStore } from "pinia";
import { api } from "../api";
import { track } from "../utils/track";
import type { Cart, Product } from "../types";
import { ensureAuthenticatedSession } from "../utils/authSession";
export const useCartStore = defineStore("cart", {
  state: () => ({
    cart: {
      items: [],
      productAmount: 0,
      totalQuantity: 0,
      /** 起送门槛初始占位：10 元 = 1000 分（真实值以 GET /cart 返回为准） */
      deliveryThreshold: 1000,
      seckillIdInCart: undefined,
    } as Cart,
    loaded: false,
    loading: false,
    ownerId: "",
    revision: 0,
    _intentVersion: 0,
    _loadPromise: null as Promise<void> | null,
    /**
     * 待落库数量（IK9AWM）：set() 调用即写入，quantity() 优先读这里，
     * 连点加号时后续调用不再读到同一个旧值，增量不丢。
     */
    pending: {} as Record<string, number>,
    _pendingVersions: {} as Record<string, number>,
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
    setOwner(userId: string, campusId?: string) {
      const owner = `${userId}:${campusId || ''}`;
      if (owner === this.ownerId) return;
      this.loaded = false;
      this.ownerId = owner; this.revision++; this._intentVersion++; this._loadPromise = null;
      this.cart = { items: [], totalQuantity: 0, productAmount: 0, deliveryThreshold: 1000 };
      this.pending = {}; this._pendingVersions = {}; this.clearedAt = 0; this.loading = false; this._chain = Promise.resolve();
    },
    async load() {
      await ensureAuthenticatedSession();
      if (this._loadPromise) return this._loadPromise;
      if (this.clearedAt && Date.now() - this.clearedAt < 60_000 && !this.cart.items.length) return;
      const revision = this.revision, token = uni.getStorageSync('token'), intent = this._intentVersion;
      this.loading = true;
      const pending = api.cart().then(cart => {
        if (revision !== this.revision || token !== uni.getStorageSync('token') || intent !== this._intentVersion) return;
        this.cart = cart; this.loaded = true;
        if (cart.items.length) this.clearedAt = 0;
      });
      this._loadPromise = pending;
      try { await pending; }
      finally { if (this._loadPromise === pending) { this.loading = false; this._loadPromise = null; } }
    },
    /**
     * 支付成功后本地清空（IKA08U）：服务端在查单落账时已清购物车行，
     * 这里同步抹掉缓存与 pending 意图，返回首页弹层不再显示已购商品
     */
    clearLocal() {
      this._intentVersion++; this.revision++;
      this._loadPromise = null; this.loading = false; this._pendingVersions = {};
      this.cart = {
        items: [],
        productAmount: 0,
        totalQuantity: 0,
        deliveryThreshold: this.cart.deliveryThreshold,
      };
      this.pending = {};
      this.clearedAt = 0; this.loaded = false;
      void this.load().catch(() => {});
    },
    /**
     * 设置某商品数量（绝对值），连点安全（IK9AWM）：
     * 意图先记 pending（UI 即时反馈）→ 请求挂串行链，构建时合并当前全部
     * pending（后写覆盖先写）→ 成功只清未被覆盖的意图，失败回滚并 toast。
     * 返回是否写入成功，调用方决定是否给成功提示。
     * IKHL6Y 秒杀双渠道：asSeckill 行身份——秒杀专区加购传 true（秒杀行，
     * 限购 1）；其余入口不传，已有行延续原身份、新行按原价（正常渠道）。
     */
    set(product: Product, quantity: number, asSeckill?: boolean): Promise<boolean> {
      const action = ++this._intentVersion;
      const revision = this.revision, token = uni.getStorageSync('token');
      const current = () => revision === this.revision && token === uni.getStorageSync('token');
      const requested = Math.max(0, quantity);
      this.pending[product.id] = requested; this._pendingVersions[product.id] = action;
      const run = this._chain.then(async () => {
        if (!current()) throw new Error('购物车上下文或清空状态已变化');
        if (!this.loaded) {
          const fresh = await api.cart();
          if (!current()) throw new Error('身份或校区已变化');
          this.cart = fresh; this.loaded = true;
        }
        const map = new Map(this.cart.items.map(item => [item.product.id, { quantity: item.quantity, asSeckill: !!item.asSeckill }]));
        map.set(product.id, { quantity: requested, asSeckill: asSeckill ?? map.get(product.id)?.asSeckill ?? false });
        try {
          const cart = await api.updateCart([...map.entries()].map(([productId, line]) => ({ productId, ...line })), this.cart.version);
          if (!current()) throw new Error('购物车上下文或清空状态已变化');
          this.cart = cart;
          if (cart.items.length) this.clearedAt = 0;
          if (this._pendingVersions[product.id] === action) { delete this.pending[product.id]; delete this._pendingVersions[product.id]; }
          if (requested > 0) track('add_cart', product.id, { quantity: requested });
        } catch (error) {
          if (current() && this._pendingVersions[product.id] === action) { delete this.pending[product.id]; delete this._pendingVersions[product.id]; }
          if (current()) this.loaded = false;
          throw error;
        }
      });
      this._chain = run.catch(() => {});
      return run.then(() => true, () => false);
    },
    /**
     * 整袋清空（IKDFZK）：PUT 空 items（后端全量替换语义一次清掉，含
     * 售罄/下架钉子户行），挂串行链防与在途 set 竞争；成功标记
     * clearedAt 让 load() 短路（同 clearLocal，防其他页 onShow 在
     * 重拉窗口期把商品复活回来）。
     */
    clearAll(): Promise<boolean> {
      this.loaded = false;
      this._intentVersion++; this.revision++;
      this.pending = {}; this._pendingVersions = {};
      const revision = this.revision, token = uni.getStorageSync('token');
      const current = () => revision === this.revision && token === uni.getStorageSync('token');
      const run = this._chain.then(async () => {
        if (!current()) throw new Error('身份或校区已变化');
        if (!this.loaded) {
          const fresh = await api.cart();
          if (!current()) throw new Error('身份或校区已变化');
          this.cart = fresh; this.loaded = true;
        }
        const cart = await api.updateCart([], this.cart.version);
        if (!current()) throw new Error('身份或校区已变化');
        this.cart = cart;
        this.clearedAt = Date.now();
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
