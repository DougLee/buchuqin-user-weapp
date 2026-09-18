<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { onPageScroll, onReachBottom, onShow } from "@dcloudio/uni-app";
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
 * 分类页（IKGQ6R 终版·页面级无限流）：
 * - 左侧分类固定吸附，右侧所有分类商品按侧栏顺序拼成页面长列表
 * - 滚到底自动 append 下一分类段（纯尾部插入，滚动零跳变）
 * - 左侧高亮随滚动位置联动（节流量段边界）
 * - 侧栏点击：已接续分类平滑滚到段头；未接续分类重建流
 */
const MOCK = !!import.meta.env.VITE_CAT_MOCK;
const MOCK_CATS: Category[] = Array.from({ length: 6 }, (_, i) => ({
  id: `cat${i + 1}`,
  name: ["零食饮料", "方便速食", "甜品烘焙", "日用百货", "酒水专区", "水果生鲜"][i],
}));
const mockRows = (catId: string): Product[] =>
  Array.from({ length: 14 }, (_, i) => ({
    id: `${catId}-p${i + 1}`,
    name: `${MOCK_CATS.find((c) => c.id === catId)?.name ?? catId}·商品${i + 1}`,
    subtitle: "",
    price: 300 + ((i * 137) % 1500),
    originalPrice: 0,
    stock: 50,
    image: "",
    status: "on-sale",
    sales: 0,
  }));

const active = ref("all");
const keyword = ref("");
const draft = ref("");
const categories = ref<Category[]>([]);
const loading = ref(true);
const error = ref(false);
const cart = useCartStore();
const campusStore = useCampusStore();
const closedNow = computed(() => campusStore.closedNow);

/** 分段流：有序段列表（每段一个分类）；products 为展平渲染数组 */
interface CatSeg {
  catId: string;
  catName: string;
  items: Product[];
}
const sections = ref<CatSeg[]>([]);
const appending = ref(false);
const products = computed<Product[]>(() => sections.value.flatMap((s) => s.items));

/** IKGNMV 一单一秒杀：购物车里已有**其他**秒杀品时，本秒杀品＋置灰 */
function seckillLocked(p: Product): boolean {
  return (
    p.promotion?.type === "seckill" &&
    !!cart.cart.seckillIdInCart &&
    cart.cart.seckillIdInCart !== p.id
  );
}

function nextCatOf(catId: string): Category | undefined {
  const idx = categories.value.findIndex((c) => c.id === catId);
  return categories.value[idx + 1];
}
function currentNameOf(catId: string): string {
  return categories.value.find((c) => c.id === catId)?.name ?? "全部";
}
async function fetchCategoryProducts(catId: string): Promise<Product[]> {
  return MOCK
    ? mockRows(catId)
    : catId === "seckill"
      ? await api.seckillProducts()
      : await api.products(catId, keyword.value);
}

/** 首段加载（骨架态）：首屏 / 搜索 / 侧栏跳转未接续场景 */
async function load() {
  loading.value = true;
  error.value = false;
  try {
    const catId = categories.value.some((c) => c.id === active.value)
      ? active.value
      : "all";
    const cat = categories.value.find((c) => c.id === catId);
    sections.value = [
      { catId, catName: cat?.name ?? "全部", items: await fetchCategoryProducts(catId) },
    ];
  } catch (e) {
    // ADR-0005(IKA00Q)：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
    if (isRetryable(e)) error.value = true;
  } finally {
    loading.value = false;
  }
  void prefetchNeighbors();
}

/** 预取相邻分类（IKG8PC 二轮）：接续时秒级呈现 */
const prefetchCache = new Map<string, { rows: Product[]; at: number }>();
const PREFETCH_TTL = 60_000;
function prefetchNeighbors() {
  if (keyword.value) return;
  const last = sections.value[sections.value.length - 1];
  if (!last) return;
  const next = nextCatOf(last.catId);
  if (!next) return;
  const hit = prefetchCache.get(next.id);
  if (hit && Date.now() - hit.at < PREFETCH_TTL) return;
  fetchCategoryProducts(next.id)
    .then((rows) => prefetchCache.set(next.id, { rows, at: Date.now() }))
    .catch(() => {});
}

/** 搜索即全品类（IKAHBJ） */
async function search() {
  keyword.value = draft.value.trim();
  active.value = "all";
  await load();
}

onShow(async () => {
  // mock 联调短路：绕过微信登录墙，只渲染分类流
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
    active.value = categories.value.some((c) => c.id === pickCat) ? pickCat : "all";
    keyword.value = "";
    draft.value = "";
  }
  await load();
});

/** 侧栏点击：已接续分类→平滑滚到段头；未接续→重建流为该分类单段 */
async function pick(id: string) {
  active.value = id;
  if (sections.value.some((s) => s.catId === id)) {
    await scrollToCat(id);
    return;
  }
  loading.value = true;
  try {
    const cat = categories.value.find((c) => c.id === id);
    sections.value = [
      { catId: id, catName: cat?.name ?? "全部", items: await fetchCategoryProducts(id) },
    ];
  } catch (e) {
    if (isRetryable(e)) error.value = true;
  } finally {
    loading.value = false;
  }
  await nextTick();
  await scrollToCat(id);
}

/** 平滑滚到分类段头：段顶相对视口偏移 + 当前滚动位 */
async function scrollToCat(id: string) {
  await nextTick();
  const rect = await new Promise<UniApp.NodeInfo>((resolve) => {
    uni
      .createSelectorQuery()
      .select(`#cat-${id}`)
      .boundingClientRect((r) => resolve(r as UniApp.NodeInfo))
      .exec();
  });
  const top = (rect as UniApp.NodeInfo | null)?.top;
  if (top == null) return;
  const target = lastScrollTop + top;
  // #ifdef H5
  document.body.scrollTop = target;
  // #endif
  // #ifndef H5
  uni.pageScrollTo({ scrollTop: target, duration: 200 });
  // #endif
}

/** 滚动联动 + 近底接续（IKGQ6R 终版）：节流量段边界联动左侧高亮；
 *  近底自动 append 下一分类段——段追加是「纯尾部插入」，滚动零跳变。 */
let segSyncAt = 0;
let lastScrollTop = 0;
function onFlowScroll(scrollTop: number) {
  lastScrollTop = scrollTop;
  const now = Date.now();
  if (now - segSyncAt < 150) return;
  segSyncAt = now;
  if (loading.value || !sections.value.length) return;
  const viewport = uni.getSystemInfoSync().windowHeight;
  if (scrollTop + viewport >= document.body.scrollHeight - 120) {
    void appendNextSeg();
  }
  const q = uni.createSelectorQuery();
  sections.value.forEach((s) => q.select(`#cat-${s.catId}`).boundingClientRect());
  q.exec((rects) => {
    let cur = -1;
    rects.forEach((r, i) => {
      if (r && (r.top ?? 9e9) <= 200) cur = i;
    });
    const hit = sections.value[cur >= 0 ? cur : 0];
    if (hit && hit.catId !== active.value) active.value = hit.catId;
  });
}
onPageScroll((e) => onFlowScroll(e.scrollTop));
onReachBottom(() => void appendNextSeg());
// #ifdef H5
document.body.addEventListener("scroll", () => onFlowScroll(document.body.scrollTop), {
  passive: true,
});
// #endif

/** 边界预告 / 快捷分类 / 商品详情跳转 / 搜索态标题 */
const nextCategoryName = computed(() => {
  const last = sections.value[sections.value.length - 1];
  return last ? (nextCatOf(last.catId)?.name ?? "") : "";
});
const quickCats = computed(() =>
  categories.value.filter((c) => c.id !== "all" && c.id !== "seckill"),
);
const open = (id: string) =>
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
const currentName = () => {
  const base =
    active.value === "all"
      ? "全部分类"
      : categories.value.find((c) => c.id === active.value)?.name || "全部商品";
  return keyword.value ? `“${keyword.value}” · ${base}` : base;
};
// IKGQ6R 联调诊断句柄（仅 MOCK 模式挂载）
if (MOCK) {
  (window as unknown as Record<string, unknown>).__cat = {
    get active() {
      return active.value;
    },
    get flow() {
      return sections.value.map((s) => s.catId);
    },
    get cats() {
      return categories.value.map((c) => c.id);
    },
    get loading() {
      return loading.value;
    },
    get appending() {
      return appending.value;
    },
    reach: () => void appendNextSeg(),
  };
}
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
        ><!-- IKGQ6R 终版：页面级滚动——滚到底自动接续下一分类段，纯追加零跳变 -->
        <view class="main__title">{{ currentName() }}</view
        ><view v-if="error" class="cat-retry card" @tap="load"
          ><text class="cat-retry__title">商品加载失败</text
          ><text class="muted">网络异常，点击重试</text></view
        ><view v-else-if="loading" class="cat-skeleton"
          ><view v-for="n in 4" :key="n" class="cat-skeleton__block" /></view
        ><template v-else
          ><view
            :class="{ 'list-fade': listEntering }"
            class="list-wrap"
          ><view v-if="!products.length && !appending" class="main__empty muted"
            >这个分类暂时没货，去看看别的吧</view
          ><view
            v-for="(seg, si) in flow"
            :key="seg.catId"
            :id="'flow-seg-' + seg.catId"
            class="flow-seg"
            ><view v-if="si > 0" class="flow-seg__head"
              ><text class="flow-seg__label">{{ seg.catName }}</text></view
            ><view
              v-if="!seg.items.length"
              class="main__empty muted"
              >正在接续下一分类…</view
            ><view
            v-for="p in seg.items"
            :key="p.id"
            class="item card"
            @tap="open(p.id)"
            ><image
              class="item__image"
              :src="p.image"
              mode="aspectFit"
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
        ></view
      ></template
        ><!-- IKGQ6R 联调按钮（仅 MOCK）：直触接续逻辑 -->
        <view v-if="MOCK" style="text-align:center;padding:20rpx">
          <button style="background:#07883b;color:#fff" @tap="onReachEnd">模拟滚到底</button>
        </view>
        <!-- IKG8PC 二轮：边界预告——到底/到顶续跳前给预期，从"意外跳走"变"按预告翻页" -->
        <view
          v-if="!loading && !error && !keyword && products.length"
          class="next-hint"
          ><text v-if="appending">正在接续下一分类…</text
          ><text v-else-if="!nextCategoryName">已经是最后一个分类啦</text
          ><text v-else>继续下滑 · 下一分类「{{ nextCategoryName }}」</text></view
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
  /* IKGQ6R 终版：页面级滚动——min-height 让内容撑开页面，滚动归页面 */
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
  /* IKGQ6R 终版：页面级滚动——内容随页面自然撑开 */
  height: auto;
}
.main__title {
  font-size: 34rpx;
  font-weight: 900;
  margin: 6rpx 4rpx 20rpx;
}
.main__empty {
  text-align: center;
  padding: 80rpx 0;
  font-size: 26rpx;
}
/* IKG8PC 二轮：边界预告条（克制弱化，不抢商品注意力） */
.next-hint {
  text-align: center;
  padding: 26rpx 0 34rpx;
  font-size: 22rpx;
  color: $muted;
}
.flow-seg__head {
  padding: 22rpx 8rpx 14rpx;
}
.flow-seg__label {
  font-size: 20rpx;
  font-weight: 600;
  color: #fff;
  background: $primary;
  border-radius: 6rpx;
  padding: 4rpx 14rpx;
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

/* ---------- IKGQ6R 丝滑化：切换加载条 + 列表淡入 ---------- */
.switch-bar {
  height: 4rpx;
  border-radius: 2rpx;
  overflow: hidden;
  background: $primary-soft;
  position: relative;
  &::after {
    content: "";
    position: absolute;
    left: -40%;
    width: 40%;
    height: 100%;
    border-radius: 2rpx;
    background: $primary;
    animation: switch-slide 0.9s ease-in-out infinite;
  }
}
@keyframes switch-slide {
  0% {
    left: -40%;
  }
  100% {
    left: 100%;
  }
}
.list-wrap.list-fade {
  animation: list-fade-in 0.22s ease-out;
}
@keyframes list-fade-in {
  from {
    opacity: 0;
    transform: translateY(10rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ---------- IKGQ6R 三轮：下一分类预览块（无缝续滑） ---------- */
.pp-next {
  margin-top: 4rpx;
}
.pp-next__banner {
  text-align: center;
  padding: 22rpx 0 18rpx;
  font-size: 22rpx;
  color: $muted;
}
.pp-next__loading {
  text-align: center;
  padding: 30rpx 0;
  font-size: 24rpx;
}
.pp-next__item {
  opacity: 0.85;
}
</style>
