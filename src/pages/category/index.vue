<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { onPageScroll, onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { isRetryable } from "../../api/request";
import { useCartStore } from "../../stores/cart";
import { useCampusStore } from "../../stores/campus";
import { fenToYuan } from "../../utils/money";
import { categoryImage } from "../../utils/categoryImage";
import type { Category, Product } from "../../types";
import { setupDefaultShare } from "../../utils/share";
setupDefaultShare();
/**
 * 分类页（IKG8PC 终版·美团式完整流，2026-09-19 对齐定稿）：
 * - 一次拉全量商品 → 按分类分组 → 完整长列表一次性渲染（零接续/零等待/零闪骨架）
 * - 页面级原生滚动；标题吸顶实时显示当前分类名
 * - 左侧高亮随滚动联动（段头越过吸顶标题下沿即切换；顶部区域=「全部」）
 * - 点侧栏：已渲染分类平滑直达段头；「全部」回顶；「秒杀」独立视角不进流
 */
const MOCK = !!import.meta.env.VITE_CAT_MOCK;
const MOCK_CATS: Category[] = Array.from({ length: 6 }, (_, i) => ({
  id: `cat${i + 1}`,
  name: ["零食饮料", "方便速食", "甜品烘焙", "日用百货", "酒水专区", "水果生鲜"][i],
}));
const mockAll = (): Product[] =>
  MOCK_CATS.flatMap((c, ci) =>
    Array.from({ length: 14 }, (_, i) => ({
      id: `${c.id}-p${i + 1}`,
      name: `${c.name}·商品${i + 1}`,
      subtitle: "",
      price: 300 + ((i * 137) % 1500),
      originalPrice: 0,
      stock: 50,
      image: "",
      status: "on-sale",
      sales: 999 - ci * 10 - i,
      categoryId: c.id,
    })),
  );

const active = ref("all");
const keyword = ref("");
const draft = ref("");
const categories = ref<Category[]>([]);
const loading = ref(true);
const error = ref(false);
const cart = useCartStore();
const campusStore = useCampusStore();
const closedNow = computed(() => campusStore.closedNow);

/** 完整流：每分类一段（空分类段不渲染，点空分类走空态视图） */
interface CatSeg {
  catId: string;
  catName: string;
  items: Product[];
}
const sections = ref<CatSeg[]>([]);
/** 秒杀独立视角（IKG8PC 终版：跨分类促销集合不进流，避免商品重复） */
const seckillItems = ref<Product[] | null>(null);

/** 渐进渲染（2026-09-19 大目录实测）：数据仍一次拉全（丝滑本质=内容就位），
 *  但 setData 一次数千节点会卡死——渲染按配额渐进，滚近渲染尾本地扩批（零网络） */
const RENDER_BATCH = 240;
const renderUpto = ref(RENDER_BATCH * 2);
function extendRender() {
  renderUpto.value += RENDER_BATCH;
}

/** IKGNMV 一单一秒杀：购物车里已有**其他**秒杀品时，本秒杀品＋置灰 */
function seckillLocked(p: Product): boolean {
  return (
    p.promotion?.type === "seckill" &&
    !!cart.cart.seckillIdInCart &&
    cart.cart.seckillIdInCart !== p.id
  );
}

/** 渲染出口统一：完整流 / 搜索伪段 / 秒杀视角 / 空分类空态；
 *  完整流按 renderUpto 配额截断（渐进渲染，滚近扩批） */
const viewSecs = computed<CatSeg[]>(() => {
  if (active.value === "seckill")
    return [
      { catId: "seckill", catName: "限时秒杀", items: seckillItems.value ?? [] },
    ];
  if (
    active.value !== "all" &&
    active.value !== "seckill" &&
    !sections.value.some((s) => s.catId === active.value)
  ) {
    const cat = categories.value.find((c) => c.id === active.value);
    return [{ catId: active.value, catName: cat?.name ?? "", items: [] }];
  }
  let left = renderUpto.value;
  const out: CatSeg[] = [];
  for (const s of sections.value) {
    if (left <= 0) break;
    out.push(
      left >= s.items.length ? s : { ...s, items: s.items.slice(0, left) },
    );
    left -= s.items.length;
  }
  return out;
});
const totalProducts = computed(
  () => sections.value.reduce((n, s) => n + s.items.length, 0),
);
const products = computed<Product[]>(() =>
  viewSecs.value.flatMap((s) => s.items),
);

/** 首屏加载：一次拉全量 → 客户端按分类分组（IKGQ6R 数据核查：单校区 267 SKU 一次请求约 50KB） */
async function load() {
  loading.value = true;
  error.value = false;
  renderUpto.value = RENDER_BATCH * 2; // 渐进渲染配额随数据集重置
  try {
    const rows = MOCK
      ? mockAll()
      : await api.products("all", keyword.value);
    if (keyword.value) {
      // 搜索态（IKAHBJ）：全品类结果平铺单段，不参与滚动联动
      sections.value = [
        { catId: "search", catName: `“${keyword.value}”`, items: rows },
      ];
    } else {
      const order = categories.value.filter(
        (c) => c.id !== "all" && c.id !== "seckill",
      );
      const byCat = new Map<string, Product[]>();
      rows.forEach((p) => {
        const k = p.categoryId ?? "";
        if (!byCat.has(k)) byCat.set(k, []);
        byCat.get(k)!.push(p);
      });
      sections.value = order
        .filter((c) => byCat.get(c.id)?.length)
        .map((c) => ({ catId: c.id, catName: c.name, items: byCat.get(c.id)! }));
    }
  } catch (e) {
    // ADR-0005(IKA00Q)：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
    if (isRetryable(e)) error.value = true;
  } finally {
    loading.value = false;
  }
}

/** 搜索即全品类（IKAHBJ） */
async function search() {
  keyword.value = draft.value.trim();
  active.value = "all";
  scrollTopTo(0);
  await load();
}

onShow(async () => {
  // mock 联调短路：绕过微信登录墙，只渲染完整流
  if (MOCK) {
    categories.value = [
      ...MOCK_CATS,
      { id: "all", name: "全部" },
      { id: "seckill", name: "限时秒杀" },
    ];
    active.value = "all";
    await load();
    return;
  }
  const kw = (uni.getStorageSync("searchKeyword") as string) || "";
  if (kw) {
    keyword.value = kw;
    draft.value = kw;
    active.value = "all";
  }
  uni.removeStorageSync("searchKeyword");
  const pickCat = (uni.getStorageSync("categoryPick") as string) || "";
  uni.removeStorageSync("categoryPick");
  await cart.load();
  void campusStore.refresh();
  try {
    categories.value = await api.categories();
  } catch {
    try {
      categories.value = (await api.home()).categories;
    } catch {
      categories.value = [{ id: "all", name: "全部" }];
    }
  }
  if (!categories.value.some((c) => c.id === "all"))
    categories.value = [{ id: "all", name: "全部" }, ...categories.value];
  const allIdx = categories.value.findIndex((c) => c.id === "all");
  if (allIdx >= 0 && !categories.value.some((c) => c.id === "seckill"))
    categories.value.splice(allIdx + 1, 0, { id: "seckill", name: "限时秒杀" });
  if (pickCat) {
    active.value = categories.value.some((c) => c.id === pickCat)
      ? pickCat
      : "all";
    keyword.value = "";
    draft.value = "";
  }
  await load();
});

/** 侧栏点击：分类直达段头 / 「全部」回顶 / 「秒杀」独立视角（懒加载一次） */
async function pick(id: string) {
  active.value = id;
  if (id === "seckill") {
    if (seckillItems.value) return;
    loading.value = true;
    try {
      seckillItems.value = MOCK
        ? mockAll().slice(0, 3)
        : await api.seckillProducts();
    } catch (e) {
      if (isRetryable(e)) error.value = true;
    } finally {
      loading.value = false;
    }
    return;
  }
  if (id === "all") {
    scrollTopTo(0);
    return;
  }
  // 空分类：viewSecs 已切空态视图，无需滚动
  if (sections.value.some((s) => s.catId === id)) {
    // 渐进渲染：目标段可能在配额外未渲染——先扩配额覆盖该段再定位
    let acc = 0;
    for (const s of sections.value) {
      if (s.catId === id) {
        renderUpto.value = Math.max(renderUpto.value, acc + s.items.length);
        break;
      }
      acc += s.items.length;
    }
    await nextTick();
    await scrollToCat(id);
  }
}

/** 滚到目标位置（H5 滚动层实测会漂移：documentElement 或 body——写双兼容；MP 页面滚动） */
function scrollTopTo(target: number) {
  // #ifdef H5
  document.documentElement.scrollTop = target;
  if (Math.abs(h5ScrollTop() - target) > 2) document.body.scrollTop = target;
  // #endif
  // #ifndef H5
  uni.pageScrollTo({ scrollTop: Math.max(0, target), duration: 200 });
  // #endif
}

/** 联动锚线：吸顶标题高(42px)＋8px 呼吸；点击直达落点即停在此线 */
const ANCHOR = 50;

/** 点击直达锁：直达期间挂锁禁联动（滚动途中位置不代表意图），到位后按终点校准 */
let clickLock = false;

/** 平滑滚到分类段头：落点=段头顶停在锚线处。
 *  H5 直用原生 DOM 量取——uni SelectorQuery 的 boundingClientRect 在
 *  H5 页面滚动非 0 时返回值失真（实测混入滚动量，越滚越偏）。 */
async function scrollToCat(id: string) {
  await nextTick();
  clickLock = true;
  // #ifdef H5
  const el = document.querySelector(`#cat-${id}`);
  if (el) scrollTopTo(h5ScrollTop() + el.getBoundingClientRect().top - ANCHOR);
  // #endif
  // #ifndef H5
  const rect = await new Promise<UniApp.NodeInfo | null>((resolve) => {
    uni
      .createSelectorQuery()
      .select(`#cat-${id}`)
      .boundingClientRect((r) => resolve(r as UniApp.NodeInfo | null))
      .exec();
  });
  if (rect?.top != null)
    uni.pageScrollTo({
      scrollTop: Math.max(0, lastScrollTop + rect.top - ANCHOR),
      duration: 200,
    });
  // #endif
  // MP 滚动动画 200ms，动画结束再按终点位置校准高亮并解锁
  setTimeout(() => {
    measureAndApply();
    clickLock = false;
  }, 260);
}

/** 滚动联动高亮（IKG8PC 终版）：段头越过锚线即切换；
 *  顶部区域（第一段头尚未越过）=「全部」。搜索态/秒杀视角/骨架态停用。
 *  点击直达期间挂锁。H5 原生量取（SelectorQuery 失真坑见 scrollToCat）。 */
let segSyncAt = 0;
let lastScrollTop = 0;
function onFlowScroll(scrollTop: number) {
  lastScrollTop = scrollTop;
  const now = Date.now();
  if (now - segSyncAt < 150) return;
  segSyncAt = now;
  extendRenderIfNeeded();
  if (clickLock) return;
  measureAndApply();
}
/** 渐进渲染扩批：渲染尾（#render-tail）距视口底不足 2 屏 → 本地扩一批（零网络） */
function extendRenderIfNeeded() {
  if (renderUpto.value >= totalProducts.value) return;
  const viewport = uni.getSystemInfoSync().windowHeight;
  // #ifdef H5
  const tail = document.querySelector("#render-tail");
  if (tail && tail.getBoundingClientRect().top < viewport * 3) extendRender();
  // #endif
  // #ifndef H5
  uni
    .createSelectorQuery()
    .select("#render-tail")
    .boundingClientRect((r) => {
      if (r && (r as UniApp.NodeInfo).top != null && (r as UniApp.NodeInfo).top! < viewport * 3)
        extendRender();
    })
    .exec();
  // #endif
}
/** 按当前各段头位置设定高亮（滚动联动与点击直达终点校准共用）。
 *  仅在「完整流视图」下运行：搜索态/秒杀视角/空分类空态下 DOM 里
 *  没有完整流的段，量取无意义且会把刚选中的视角顶掉。 */
function measureAndApply() {
  if (loading.value || keyword.value || !sections.value.length) return;
  if (
    active.value !== "all" &&
    !sections.value.some((s) => s.catId === active.value)
  )
    return;
  // #ifdef H5
  let cur = -1;
  sections.value.forEach((s, i) => {
    const el = document.querySelector(`#cat-${s.catId}`);
    if (el && el.getBoundingClientRect().top <= ANCHOR + 24) cur = i;
  });
  applyActive(cur);
  // #endif
  // #ifndef H5
  const q = uni.createSelectorQuery();
  sections.value.forEach((s) =>
    q.select(`#cat-${s.catId}`).boundingClientRect(),
  );
  q.exec((rects) => {
    let cur = -1;
    rects.forEach((r, i) => {
      if (r && (r.top ?? 9e9) <= ANCHOR + 24) cur = i;
    });
    applyActive(cur);
  });
  // #endif
}
function applyActive(cur: number) {
  const hit = cur >= 0 ? sections.value[cur].catId : "all";
  if (hit !== active.value) active.value = hit;
}
onPageScroll((e) => onFlowScroll(e.scrollTop));
// #ifdef H5
// H5 滚动层随渲染状态漂移（documentElement 或 body），读侧双兼容
const h5ScrollTop = () =>
  document.documentElement.scrollTop || document.body.scrollTop || 0;
document.addEventListener("scroll", () => onFlowScroll(h5ScrollTop()), {
  passive: true,
});
document.body.addEventListener("scroll", () => onFlowScroll(h5ScrollTop()), {
  passive: true,
});
// uni-h5 页面结构下 scroll 事件传递不可靠——短轮询兜底驱动（开销微小）
setInterval(() => onFlowScroll(h5ScrollTop()), 300);
// #endif

/** 快捷分类 / 商品详情跳转 / 搜索态标题 */
const quickCats = computed(() =>
  categories.value.filter((c) => c.id !== "all" && c.id !== "seckill"),
);
const open = (id: string) =>
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
const currentName = () => {
  if (keyword.value) return `“${keyword.value}” · 搜索结果`;
  const base =
    active.value === "all"
      ? "全部分类"
      : categories.value.find((c) => c.id === active.value)?.name ||
        "全部商品";
  return base;
};
</script>
<template>
  <view class="page"
    ><view class="search card"
      ><input
        v-model="draft"
        placeholder="今天想吃什么？"
        confirm-type="search"
        @confirm="search"
      /><button @tap="search">搜索</button></view
    ><!-- IKDBFT：快捷分类横滑条（首页分类条同款下移），点击页内联动选中 -->
    <!-- 2026-09-05 道哥决策暂时下线，此区域预留广告位（方案待定）；恢复 = 删除 v-if="false" --><view
      v-if="false"
      scroll-x
      class="quick card"
      enhanced
      :show-scrollbar="false"
      ><view class="quick__row"
        ><view
          v-for="c in quickCats"
          :key="c.id"
          class="quick__item"
          :class="{ 'quick__item--active': active === c.id }"
          @tap="pick(c.id)"
          ><view class="quick__icon"
            ><image :src="categoryImage(c)" mode="aspectFit" /></view
          ><text class="quick__name">{{ c.name }}</text></view
        ></view
      ></view
    ><view class="body"
      ><view scroll-y class="side"
        ><view
          v-for="c in categories"
          :key="c.id"
          class="side__item"
          :class="{ 'side__item--active': active === c.id }"
          @tap="pick(c.id)"
          ><!-- 纯文字侧栏（2026-08-22）：图标挤压文字导致 5 字分类换行、行高不齐；
          图标识别职责交给首页横滑条，侧栏回归单行导航（美团式分类页形态） -->
          <text class="side__name">{{ c.name }}</text></view
        ></view
      ><view
        class="main"
        ><!-- IKG8PC 终版：吸顶标题——滚动时实时显示当前分类名（联动 active） -->
        <view id="main-title" class="main__title">{{ currentName() }}</view
        ><view v-if="error" class="cat-retry card" @tap="load"
          ><text class="cat-retry__title">商品加载失败</text
          ><text class="muted">网络异常，点击重试</text></view
        ><view v-else-if="loading" class="cat-skeleton"
          ><view v-for="n in 4" :key="n" class="cat-skeleton__block" /></view
        ><template v-else
          ><!-- 空态兜底：全校无货（viewSecs 恒至少一段，走不到这里属极端态）；
              单分类/搜索的空态由段内统一渲染，避免双重提示（2026-09-19 验收修复） --><view
            v-if="!viewSecs.length"
            class="main__empty muted"
            >这个分类暂时没货，去看看别的吧</view
          ><view
            v-for="seg in viewSecs"
            :key="seg.catId"
            :id="'cat-' + seg.catId"
            class="flow-seg"
            ><!-- 2026-09-19 道哥验收：去掉段间分类标签（当前区域由吸顶标题+左侧高亮指示） --><view
              v-if="!seg.items.length"
              class="main__empty muted"
              >{{
                keyword
                  ? "没有找到相关商品，换个词试试吧"
                  : "这个分类暂时没货，去看看别的吧"
              }}</view
            ><view
              v-for="p in seg.items"
              :key="p.id"
              class="item card"
              @tap="open(p.id)"
              ><image
                class="item__image"
                :src="p.image"
                mode="aspectFit"
                lazy-load
                :alt="p.name"
              /><view class="item__main"
                ><text class="item__name">{{ p.name }}</text
                ><text class="item__sub">{{ p.subtitle }}</text
                ><view class="item__bottom"
                  ><view class="item__pricegrp"
                    ><text class="price"
                      ><text class="price__symbol">¥</text
                      >{{ fenToYuan(p.price) }}</text
                    ><!-- IKBW0K：秒杀商品带划线原价（活动期 originalPrice=原价） -->
                    <text v-if="p.originalPrice" class="item__strike"
                      >¥{{ fenToYuan(p.originalPrice) }}</text
                    ></view
                  ><!-- 计数器（IK9AWL）：数量>0 时展开 − n ＋，数字不再是隐形加号；
                       IKG8FF 秒杀限购：达到 limit 上限后 ＋ 禁用 -->
                  <view v-if="cart.quantity(p.id)" class="counter" @tap.stop
                    ><button
                      class="counter__btn counter__btn--minus"
                      aria-label="减少一件"
                      @tap.stop="cart.set(p, cart.quantity(p.id) - 1)"
                    >
                      −
                    </button
                    ><text class="counter__num">{{ cart.quantity(p.id) }}</text
                    ><button
                      class="counter__btn"
                      :class="{
                        'counter__btn--cap':
                          p.seckillLimit &&
                          cart.quantity(p.id) >= p.seckillLimit.limit,
                        'add--closed': closedNow,
                      }"
                      :disabled="
                        closedNow ||
                        (!!p.seckillLimit &&
                          cart.quantity(p.id) >= p.seckillLimit.limit)
                      "
                      aria-label="增加一件"
                      @tap.stop="cart.set(p, cart.quantity(p.id) + 1)"
                    >
                      ＋
                    </button></view
                  ><!-- IKG1C：闭店时 ＋ 置灰禁买，优先于已抢购（整店都买不了） -->
                  <button
                    v-else-if="closedNow"
                    class="add add--closed"
                    disabled
                    aria-label="已打烊"
                  >
                    ＋
                  </button
                  ><!-- IKG8FF：已抢购的秒杀商品置灰文案，不再给加购热区 -->
                  <button
                    v-else-if="p.seckillLimit?.purchased"
                    class="add add--bought"
                    disabled
                    aria-label="已抢购"
                  >
                    已抢
                  </button
                  ><!-- IKGNMV：购物车已有其他秒杀品——一单一秒杀置灰 -->
                  <button
                    v-else-if="seckillLocked(p)"
                    class="add add--bought"
                    disabled
                    aria-label="一单限一个"
                  >
                    限一
                  </button><button
                    v-else
                    class="add"
                    aria-label="加入购物车"
                    @tap.stop="cart.set(p, cart.quantity(p.id) + 1)"
                  >
                    ＋
                  </button></view
                ></view
              ></view
            ></view
          ><!-- IKG8PC 终版：完整流滚到底是真到底；#render-tail 是渐进渲染扩批锚点
              （距视口 2 屏即本地扩批，用户无感；全渲染完才显示「没有更多了」） -->
          <view v-if="products.length" id="render-tail" class="next-hint"
            ><text v-if="renderUpto >= totalProducts">没有更多了</text></view
          ></template
        ></view
      ></view
    ><TabBar :current="1" /><CartOverlay /></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.page {
  display: flex;
  flex-direction: column;
  /* IKG8PC 终版：页面级滚动——min-height 让内容撑开页面，滚动归页面 */
  min-height: 100vh;
  padding-bottom: 0;
}
.search {
  height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 8rpx 0 26rpx;
  border: 3rpx solid $primary;
  flex-shrink: 0;
}
.search input {
  flex: 1;
  font-size: 28rpx;
}
.search button {
  min-height: 68rpx;
  margin: 0;
  background: $primary;
  color: #fff;
  border-radius: 34rpx;
  font-size: 24rpx;
  padding: 0 30rpx;
}
/* IKDBFT：快捷分类横滑条（首页同款视觉：圆图+名称，偶数项奶油底） */
.quick {
  margin-top: 16rpx;
  padding: 24rpx 0;
  flex-shrink: 0;
  overflow: hidden;
}
.quick__row {
  display: inline-flex;
  white-space: nowrap;
}
.quick__item {
  flex-shrink: 0;
  width: 136rpx;
  text-align: center;
  font-size: 24rpx;
  color: $ink;
  font-weight: 700;
}
.quick__icon {
  width: 112rpx;
  height: 112rpx;
  margin: 0 auto 12rpx;
  border-radius: 50%;
  background: $primary-soft;
  border: 4rpx solid transparent;
  overflow: hidden;
  transition: transform 0.12s ease;
  box-sizing: border-box;
}
.quick__item:nth-child(2n) .quick__icon {
  background: $cream;
}
.quick__item:active .quick__icon {
  transform: scale(0.92);
}
/* 选中态：描边圈住当前分类（与左栏高亮同步） */
.quick__item--active .quick__icon {
  border-color: $primary;
  background: #fff;
}
.quick__icon image {
  width: 100%;
  height: 100%;
}
.quick__name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick__item--active .quick__name {
  color: $primary-dark;
}
.body {
  flex: 1;
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
  min-height: 0;
  /* 底部补偿（2026-08-23）：自绘 TabBar 高约 118rpx+安全区，滚动区不留
   * 余量时最后一张商品卡被条压住只露半截；140rpx 含 22rpx 呼吸 */
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}
.side {
  position: sticky;
  top: 20rpx;
  max-height: calc(100vh - 240rpx);
  overflow-y: auto;
  width: 196rpx;
  flex-shrink: 0;
  background: $surface;
  border-radius: 28rpx;
  border: 2rpx solid rgba(32, 74, 45, 0.07);
}
.side__item {
  /* 触控目标 88rpx=44px 达标；纯文字单行（2026-08-22） */
  min-height: 88rpx;
  display: flex;
  align-items: center;
  padding: 12rpx 16rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: $ink;
  border-left: 8rpx solid transparent;
}
.side__name {
  /* 单行省略：根治 5 字以上分类换行导致的行高不齐 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side__item--active {
  background: $primary-soft;
  color: $primary-dark;
  border-left-color: $primary;
}
.main {
  flex: 1;
  min-width: 0;
  /* IKG8PC 终版：页面级滚动——内容随页面自然撑开 */
  height: auto;
}
.main__title {
  /* IKG8PC 终版：吸顶标题（美团式）——滚动时实时显示当前分类名，
     底色与页面底一致遮住下方滚过内容；联动锚线=标题下沿 */
  position: sticky;
  top: 0;
  z-index: 5;
  background: $paper;
  font-size: 34rpx;
  font-weight: 900;
  padding: 16rpx 4rpx;
  margin: 0 0 12rpx;
}
.main__empty {
  text-align: center;
  padding: 80rpx 0;
  font-size: 26rpx;
}
/* IKG8PC 终版：流尾提示（真到底） */
.next-hint {
  text-align: center;
  padding: 26rpx 0 34rpx;
  font-size: 22rpx;
  color: $muted;
}
.item {
  display: flex;
  padding: 18rpx;
  margin-bottom: 18rpx;
  border-radius: 24rpx;
}
.item__image {
  width: 150rpx;
  height: 150rpx;
  border-radius: 20rpx;
  background: $primary-soft;
  flex-shrink: 0;
}
.item__main {
  flex: 1;
  margin-left: 18rpx;
  min-width: 0;
}
.item__name {
  display: block;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.4;
}
.item__sub {
  display: block;
  color: $muted;
  font-size: 22rpx;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}
/* IKBW0K：促销价 + 划线原价左组（原价来自活动期 originalPrice） */
.item__pricegrp {
  display: flex;
  align-items: baseline;
  min-width: 0;
}
.item__strike {
  margin-left: 10rpx;
  font-size: 20rpx;
  color: $muted;
  text-decoration: line-through;
}
/* 触控热区（IK9AWL）：64rpx 视觉 + 透明外圈 ::after ≈ 88rpx 命中 */
.add,
.counter__btn {
  margin: 0;
  width: 64rpx;
  height: 64rpx;
  line-height: 60rpx;
  padding: 0;
  border-radius: 50%;
  background: $primary;
  color: #fff;
  font-weight: 900;
  font-size: 34rpx;
  box-shadow: none;
  position: relative;
}
.add::after,
.counter__btn::after {
  content: "";
  position: absolute;
  left: -12rpx;
  top: -12rpx;
  right: -12rpx;
  bottom: -12rpx;
}
.counter {
  display: flex;
  align-items: center;
  gap: 6rpx;
}
.counter__btn--minus {
  background: $primary-soft;
  color: $primary-dark;
}
/* IKG8FF：秒杀限购达到上限的 ＋ 与已抢购按钮——灰化禁用态；
   IKG1C：闭店态加购按钮同款灰化（.add--closed） */
.counter__btn--cap,
.add--bought,
.add--closed {
  background: #e5e7e5;
  color: $muted;
}
.add--bought {
  font-size: 20rpx;
  font-weight: 700;
}
.counter__num {
  min-width: 40rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 900;
}
.cat-retry {
  padding: 110rpx 30rpx;
  text-align: center;
}
.cat-retry__title {
  display: block;
  font-weight: 900;
  color: $primary-dark;
  margin-bottom: 8rpx;
}
.cat-skeleton__block {
  height: 190rpx;
  border-radius: 24rpx;
  margin-bottom: 18rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: cat-pulse 1.2s infinite;
}
@keyframes cat-pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
