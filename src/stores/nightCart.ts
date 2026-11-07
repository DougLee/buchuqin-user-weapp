import { defineStore } from "pinia";
import type { NightProduct } from "../types/night";

/**
 * 夜宵独立购物车（一期客户端本地暂存，无服务端购物车接口）：
 * - 与白天 CartItem/Pinia cart store 完全隔离，互不读写；
 * - uni storage 持久化（key=nightCart），跨天保留；
 * - 按店铺（storeId）分桶——换楼栋互不串车；
 * - 提交订单时服务端全量重验（下架/停售/库存不足整单拒绝），
 *   结算页先按本店商品列表做本地标记（失效行标红可移除）。
 */

export interface NightCartLine {
  /** NightProduct 楼栋行 id */
  productId: string;
  asSeckill?: boolean;
  promotionId?: string;
  promotionEndsAt?: string;
  name: string;
  image: string;
  /** 夜宵售价，单位：分 */
  price: number;
  quantity: number;
}

interface NightCartBucket {
  storeId: string;
  buildingId: string;
  buildingName: string;
  items: NightCartLine[];
  /** 最后变动时间戳（跨天保留，不设 TTL；仅供诊断） */
  savedAt: number;
}

const STORAGE_KEY = "nightCart";
const OWNER_KEY = "nightCartOwner";

function ownerKey(owner: string) { return `${STORAGE_KEY}:${owner}`; }

function loadStorage(): Record<string, NightCartBucket> {
  try {
    const owner = String(uni.getStorageSync(OWNER_KEY) || "");
    if (!owner) return {};
    const raw = uni.getStorageSync(ownerKey(owner)) as string;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => {
      if (["__proto__", "constructor", "prototype"].includes(key) || !value || typeof value !== "object") return false;
      const b = value as NightCartBucket;
      return b.storeId === key && typeof b.buildingId === "string" && typeof b.buildingName === "string" && Array.isArray(b.items);
    }).map(([key, value]) => {
      const b = value as NightCartBucket;
      return [key, { ...b, items: b.items.filter(line => line && (line.asSeckill === undefined || typeof line.asSeckill === "boolean") && typeof line.productId === "string" && typeof line.name === "string" && typeof line.image === "string" && Number.isInteger(line.price) && line.price >= 0 && Number.isInteger(line.quantity) && line.quantity > 0) }];
    }));
  } catch {
    return {};
  }
}

export const useNightCartStore = defineStore("nightCart", {
  state: () => ({
    ownerId: String(uni.getStorageSync(OWNER_KEY) || ""),
    carts: loadStorage() as Record<string, NightCartBucket>,
  }),
  getters: {
    /** 某店铺的购物车行（无车返回空数组） */
    linesOf: (state) => (storeId: string) =>
      state.carts[storeId]?.items ?? [],
    /** 某店铺购物车商品件数（悬浮条徽标用） */
    countOf(state) {
      return (storeId: string) =>
        (state.carts[storeId]?.items ?? []).reduce(
          (sum, line) => sum + line.quantity,
          0,
        );
    },
    /** 某店铺购物车商品金额合计（分） */
    amountOf(state) {
      return (storeId: string) =>
        (state.carts[storeId]?.items ?? []).reduce(
          (sum, line) => sum + line.price * line.quantity,
          0,
        );
    },
  },
  actions: {
    setOwner(userId: string, campusId?: string) {
      const scope = campusId ? `${userId}:${campusId}` : userId;
      if (this.ownerId === scope) return;
      this.ownerId = scope;
      uni.setStorageSync(OWNER_KEY, scope);
      this.carts = loadStorage();
    },
    persist() {
      try {
        if (this.ownerId) uni.setStorageSync(ownerKey(this.ownerId), JSON.stringify(this.carts));
      } catch {
        /* storage 满等异常静默：内存态仍可用，本次进程内不丢 */
      }
    },
    /** 某商品当前数量（加购按钮展开态用） */
    quantityOf(storeId: string, productId: string, asSeckill?: boolean, promotionId?: string) {
      return (
        this.carts[storeId]?.items.find((l) => l.productId === productId && (asSeckill === undefined || Boolean(l.asSeckill) === asSeckill) && (promotionId === undefined || l.promotionId === promotionId))
          ?.quantity ?? 0
      );
    },
    /** 设置某商品数量（绝对值；0=移除行）。本地暂存无网络请求，同步生效 */
    setQuantity(
      store: { id: string; buildingId: string; buildingName: string },
      product: NightProduct,
      quantity: number,
    ) {
      const bucket =
        this.carts[store.id] ??
        (this.carts[store.id] = {
          storeId: store.id,
          buildingId: store.buildingId,
          buildingName: store.buildingName,
          items: [],
          savedAt: 0,
        });
      const requested = Number.isFinite(quantity) ? Math.floor(quantity) : 0;
      const index = bucket.items.findIndex(line => line.productId === product.id);
      const previous = bucket.items[index];
      const mode = product.asSeckill ?? previous?.asSeckill ?? false;
      const qty = Math.max(0, Math.min(requested, product.stock, mode ? 1 : 999, product.purchaseLimitMeta?.qty ?? 999));
      if (qty > 0 && previous && Boolean(previous.asSeckill) !== mode) return false;
      if (qty > 0 && mode && bucket.items.some(line => line.asSeckill && line.productId !== product.id)) return false;
      const seckill = product.seckill && new Date(product.seckill.endsAt).getTime() > Date.now() ? product.seckill : null;
      if (mode && !seckill && qty > (previous?.quantity || 0)) return false;
      if (mode && qty > 0 && previous && (previous.promotionId !== seckill?.id || !previous.promotionEndsAt || new Date(previous.promotionEndsAt).getTime() <= Date.now())) return false;
      const price = mode ? seckill?.price ?? previous?.price ?? product.price : product.price;
      if (qty <= 0) {
        if (index >= 0) bucket.items.splice(index, 1);
      } else if (index >= 0) {
        Object.assign(previous, { quantity: qty, price, name: product.name, image: product.image, asSeckill: mode, ...(mode ? { promotionId: previous.promotionId, promotionEndsAt: previous.promotionEndsAt } : {}) });
      } else {
        bucket.items.push({ productId: product.id, name: product.name, image: product.image, price, quantity: qty, asSeckill: mode, ...(mode && seckill ? { promotionId: seckill.id, promotionEndsAt: seckill.endsAt } : {}) });
      }
      bucket.savedAt = Date.now();
      this.persist();
      return true;
    },
    /** 重验结算快照，保留数量供用户核对缺货，不静默减少已选数量。 */
    refreshProducts(storeId: string, products: NightProduct[]) {
      const bucket = this.carts[storeId];
      if (!bucket) return false;
      let changed = false;
      for (const line of bucket.items) {
        const product = products.find(p => p.id === line.productId);
        if (!product) continue;
        const sameActivity = line.promotionId && line.promotionId === product.seckill?.id && line.promotionEndsAt && new Date(line.promotionEndsAt).getTime() > Date.now();
        const price = line.asSeckill ? sameActivity ? product.seckill!.price : line.price : product.price;
        if (line.price !== price) changed = true;
        Object.assign(line, { price, name: product.name, image: product.image });
      }
      this.persist();
      return changed;
    },
    /** 移除失效行（结算页「移除失效商品」一键清） */
    removeLines(storeId: string, productIds: string[]) {
      const bucket = this.carts[storeId];
      if (!bucket) return;
      bucket.items = bucket.items.filter(
        (l) => !productIds.includes(l.productId),
      );
      bucket.savedAt = Date.now();
      this.persist();
    },
    /** 清空某店铺购物车（下单成功后调） */
    consumeOrder(storeId: string, orderId: string, lines: Array<{ nightProductId: string; quantity: number; asSeckill?: boolean; promotionId?: string }>) {
      if (!this.ownerId) return;
      const key = `nightCartConsumed:${this.ownerId}`;
      let consumed: string[] = [];
      try { const value = JSON.parse(String(uni.getStorageSync(key) || '[]')); if (Array.isArray(value)) consumed = value.filter(id => typeof id === 'string'); } catch {}
      if (consumed.includes(orderId)) return;
      const bucket = this.carts[storeId];
      if (bucket) {
        for (const line of lines) {
          const selected = bucket.items.find(item => item.productId === line.nightProductId);
          if (selected && Boolean(selected.asSeckill) === Boolean(line.asSeckill) && (!line.asSeckill || selected.promotionId === line.promotionId)) selected.quantity = Math.max(0, selected.quantity - line.quantity);
        }
        bucket.items = bucket.items.filter(item => item.quantity > 0);
        bucket.savedAt = Date.now();
        this.persist();
      }
      uni.setStorageSync(key, JSON.stringify([...consumed.slice(-499), orderId]));
    },
    /** 用户主动清空某店购物车。 */
    clear(storeId: string) {
      delete this.carts[storeId];
      this.persist();
    },
  },
});
