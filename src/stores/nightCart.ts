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

function loadStorage(): Record<string, NightCartBucket> {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY) as string;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, NightCartBucket>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export const useNightCartStore = defineStore("nightCart", {
  state: () => ({
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
    persist() {
      try {
        uni.setStorageSync(STORAGE_KEY, JSON.stringify(this.carts));
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
      const qty = Math.max(0, Math.min(quantity, product.stock));
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
    clear(storeId: string) {
      delete this.carts[storeId];
      this.persist();
    },
  },
});
