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
      return [key, { ...b, items: b.items.filter(line => line && typeof line.productId === "string" && typeof line.name === "string" && typeof line.image === "string" && Number.isInteger(line.price) && line.price >= 0 && Number.isInteger(line.quantity) && line.quantity > 0) }];
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
    setOwner(userId: string) {
      if (this.ownerId === userId) return;
      this.ownerId = userId;
      uni.setStorageSync(OWNER_KEY, userId);
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
    quantityOf(storeId: string, productId: string) {
      return (
        this.carts[storeId]?.items.find((l) => l.productId === productId)
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
      const qty = Math.max(0, Math.min(requested, product.stock, 999));
      const index = bucket.items.findIndex(
        (l) => l.productId === product.id,
      );
      if (qty <= 0) {
        if (index >= 0) bucket.items.splice(index, 1);
      } else if (index >= 0) {
        bucket.items[index].quantity = qty;
        // 价格以最新快照为准（后台调价后旧行跟随）
        bucket.items[index].price = product.price;
        bucket.items[index].name = product.name;
        bucket.items[index].image = product.image;
      } else {
        bucket.items.push({
          productId: product.id,
          name: product.name,
          image: product.image,
          price: product.price,
          quantity: qty,
        });
      }
      bucket.savedAt = Date.now();
      this.persist();
    },
    /** 重验结算快照，保留数量供用户核对缺货，不静默减少已选数量。 */
    refreshProducts(storeId: string, products: NightProduct[]) {
      const bucket = this.carts[storeId];
      if (!bucket) return false;
      let changed = false;
      for (const line of bucket.items) {
        const product = products.find(p => p.id === line.productId);
        if (!product) continue;
        if (line.price !== product.price) changed = true;
        Object.assign(line, { price: product.price, name: product.name, image: product.image });
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
    consumeOrder(storeId: string, orderId: string, lines: Array<{ nightProductId: string; quantity: number }>) {
      if (!this.ownerId) return;
      const key = `nightCartConsumed:${this.ownerId}`;
      let consumed: string[] = [];
      try { const value = JSON.parse(String(uni.getStorageSync(key) || '[]')); if (Array.isArray(value)) consumed = value.filter(id => typeof id === 'string'); } catch {}
      if (consumed.includes(orderId)) return;
      const bucket = this.carts[storeId];
      if (bucket) {
        for (const line of lines) {
          const selected = bucket.items.find(item => item.productId === line.nightProductId);
          if (selected) selected.quantity = Math.max(0, selected.quantity - line.quantity);
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
