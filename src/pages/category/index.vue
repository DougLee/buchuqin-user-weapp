<script setup lang="ts">
import { computed, getCurrentInstance, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
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
 * 侧栏直接用 DB 分类字典（IK9VDJ）；active 初始 'all'，api.products('all') 后端已兼容。
 * 「全部」是 UI 概念（2026-08-21 数据清理）：原 id=all 的 DB 行随测试分类删除，
 * 接口列表无 all 时本地补齐，保证侧栏始终有「全部」入口可切回。
 */
const active = ref("all"),
  keyword = ref(""),
  draft = ref(""),
  categories = ref<Category[]>([]),
  products = ref<Product[]>([]),
  loading = ref(true),
  error = ref(false),
  cart = useCartStore(),
  /** IKG1C 打烊停单：闭店态共享自 campus store（首页已随 /home 注入，这里只轻刷） */
  campusStore = useCampusStore(),
  /** 闭店时全部分类商品的加购/＋一并置灰禁用（服务端结算拦截的前端前置） */
  closedNow = computed(() => campusStore.closedNow);
/** IKGNMV 一单一秒杀：购物车里已有**其他**秒杀品时，本秒杀品＋置灰 */
function seckillLocked(p: Product): boolean {
  return (
    p.promotion?.type === "seckill" &&
    !!cart.cart.seckillIdInCart &&
    cart.cart.seckillIdInCart !== p.id
  );
}
/** 商品列表三态（IK9AWK）：加载骨架 / 失败重试 / 列表。
 *  IKGQ6R 丝滑化：silent=切换场景旧内容保留（不清列表不闪骨架，顶部细条
 *  提示），数据到了再整体淡入；首屏/搜索仍走骨架态。 */
const switching = ref(false);
const listEntering = ref(false);
function fadeIn() {
  listEntering.value = false;
  // 下一 tick 重触发 CSS 动画
  setTimeout(() => (listEntering.value = true), 30);
  setTimeout(() => (listEntering.value = false), 480);
}
async function load(options?: { silent?: boolean }) {
  const silent = options?.silent && products.value.length > 0;
  if (silent) {
    switching.value = true;
  } else {
    loading.value = true;
  }
  error.value = false;
  try {
    // IKBW0K：限时秒杀伪分类走专区接口（进行中活动带促销价），搜索词不生效
    const rows =
      active.value === "seckill"
        ? await api.seckillProducts()
        : await api.products(active.value, keyword.value);
    products.value = rows;
    if (silent) fadeIn();
  } catch (e) {
    // ADR-0005(IKA00Q)：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
    if (isRetryable(e) && !silent) error.value = true;
  } finally {
    switching.value = false;
    loading.value = false;
  }
  void prefetchNeighbors();
}
/** IKG8PC 二轮（道哥 2026-09-16「不丝滑」反馈）：预取相邻分类——当前分类
 *  就绪后后台静默拉 idx±1（60s TTL），滚动续跳命中缓存即零等待直替换，
 *  不再闪骨架。预取失败静默，切换时回落正常 load。 */
const prefetchCache = new Map<string, { rows: Product[]; at: number }>();
const PREFETCH_TTL = 60_000;
const fetchCategoryProducts = (id: string): Promise<Product[]> =>
  id === "seckill" ? api.seckillProducts() : api.products(id, "");
function prefetchNeighbors() {
  // 搜索态预取无意义（续跳已停用，且结果与关键词耦合）
  if (keyword.value) return;
  const idx = categories.value.findIndex((c) => c.id === active.value);
  for (const n of [idx - 1, idx + 1]) {
    const c = categories.value[n];
    if (!c) continue;
    const hit = prefetchCache.get(c.id);
    if (hit && Date.now() - hit.at < PREFETCH_TTL) continue;
    fetchCategoryProducts(c.id)
      .then((rows) => prefetchCache.set(c.id, { rows, at: Date.now() }))
      .catch(() => {});
  }
}
/** 搜索即全品类（IKAHBJ）：任何搜索动作先把分类重置回「全部」再拉列表 */
async function search() {
  keyword.value = draft.value.trim();
  active.value = "all";
  await load();
}
onShow(async () => {
  // 首页搜索关键词传递（IK9AWP）：switchTab 不支持 query，走 storage 携带。
  // IKAHBJ：kw 非空 = 一次新的全品类搜索，无条件重置回「全部」——切分类
  // 保留关键词（2026-08-23 优化）后同词重搜也必须落回全品类，不能卡在单分类；
  // kw 空 = 普通往返切 Tab，保留关键词/分类现场
  const kw = (uni.getStorageSync("searchKeyword") as string) || "";
  if (kw) {
    keyword.value = kw;
    draft.value = kw;
    active.value = "all";
  }
  uni.removeStorageSync("searchKeyword");
  // 首页金刚区带分类 id 跳转（IK9SOB）：storage 传递，选中对应分类
  const pick = (uni.getStorageSync("categoryPick") as string) || "";
  uni.removeStorageSync("categoryPick");
  await cart.load();
  void campusStore.refresh(); // IKG1C：打烊态轻量刷新（静默，不阻塞列表）
  try {
    categories.value = await api.categories();
  } catch {
    // 分类接口失败先退 home 接口；再失败合成裸「全部」保底 tab，商品区由 load 三态兜底
    try {
      categories.value = (await api.home()).categories;
    } catch {
      categories.value = [{ id: "all", name: "全部" }];
    }
  }
  // IK9VD3：pick 校验存在性——类别被删/接口降级时回退「全部」，避免侧栏无高亮、标题与列表错位
  if (!categories.value.some((c) => c.id === "all"))
    categories.value = [{ id: "all", name: "全部" }, ...categories.value];
  // IKBW0K：「限时秒杀」特殊分类插在「全部」之后（伪分类，不落 DB，
  // 点入走 /promotions/seckill 专区数据）
  const allIdx = categories.value.findIndex((c) => c.id === "all");
  if (allIdx >= 0 && !categories.value.some((c) => c.id === "seckill"))
    categories.value.splice(allIdx + 1, 0, { id: "seckill", name: "限时秒杀" });
  if (pick) {
    active.value = categories.value.some((c) => c.id === pick) ? pick : "all";
    // 金刚区带分类跳（IK9SOB）是「干净浏览该分类」意图，清掉残留搜索词
    keyword.value = "";
    draft.value = "";
  }
  await load();
});
/** 切分类带着搜索条件（2026-08-23 道哥反馈，优化 IKAHBJ 决策）：关键词保留，
 *  在当前搜索结果内缩小到该分类；清空输入再点搜索 = 退出搜索回全品类。
 *  instant=滚动续跳快通道：预取命中零等待直替换（不闪骨架），侧栏点击走原体验 */
async function pick(id: string, instant = false) {
  active.value = id;
  // IKGQ6R：切分类平滑回顶（200ms 缓动，替代视口猛跳）
  smoothScrollTop();
  const idx = categories.value.findIndex((c) => c.id === id);
  const hit = prefetchCache.get(id);
  if (instant && hit && Date.now() - hit.at < PREFETCH_TTL) {
    prefetchCache.delete(id);
    products.value = hit.rows;
    error.value = false;
    loading.value = false;
    fadeIn();
    void prefetchNeighbors();
    return;
  }
  // IKGQ6R：切换未命中缓存也走旧内容保留（silent），不再闪整页骨架
  await load({ silent: instant });
}
/** IKG8PC 到底自动续跳（道哥 2026-09-16）：严格按侧栏顺序（含「全部」「限时
 *  秒杀」伪分类），搜索态（关键词非空）停用——搜索是目标明确的行为；二轮
 *  扩双向：到底=下一个，到顶=上一个（道哥要求）。jumpLocked 换列节流防惯性
 *  连跳；程序置顶后 800ms 内忽略 scrolltoupper——scroll-top 置 0 的回弹会
 *  误触发反向跳形成抖动死循环。 */
const mainTop = ref(0);
const jumpLocked = ref(false);
let topGuardUntil = 0;
/** IKGQ6R 平滑回顶：@scroll 记录实时位置，逐帧缓动 200ms 滚回顶部，
 *  替代 scroll-top 瞬置的视口猛跳。 */
let lastScrollTop = 0;
let scrollAnimTimer: ReturnType<typeof setTimeout> | null = null;
function onMainScroll(e: { detail: { scrollTop: number } }) {
  lastScrollTop = e.detail.scrollTop;
}
function smoothScrollTop(target = 0) {
  if (scrollAnimTimer) clearTimeout(scrollAnimTimer);
  const start = lastScrollTop;
  if (Math.abs(start - target) < 2) return;
  const t0 = Date.now();
  const dur = 200;
  const step = () => {
    const t = Math.min(1, (Date.now() - t0) / dur);
    const ease = 1 - Math.pow(1 - t, 3);
    mainTop.value = Math.round(start + (target - start) * ease);
    if (t < 1) scrollAnimTimer = setTimeout(step, 16);
  };
  step();
}
async function jump(step: 1 | -1) {
  if (jumpLocked.value || keyword.value || loading.value || error.value) return;
  const idx = categories.value.findIndex((c) => c.id === active.value);
  const target = categories.value[idx + step];
  if (!target) return;
  jumpLocked.value = true;
  setTimeout(() => (jumpLocked.value = false), 400);
  await pick(target.id, true);
  topGuardUntil = Date.now() + 800;
}
const onReachTop = () => {
  if (Date.now() < topGuardUntil) return;
  void jump(-1);
};
/* ---------- IKGQ6R 三轮（道哥拍板「无缝续滑」）：到底不再立即切换——
   列表尾部先追加「下一分类预览块」（分类横幅+预取商品卡），用户继续往
   下滑、预览块顶部越过视口顶时才真正切换且 scroll 归零——预览块内容=
   新列表开头，视觉零跳变，近似「同一份列表继续下滑」。左侧高亮同步。 */
const previewNext = ref(false);
const nextRows = ref<Product[]>([]);
const nextCategory = computed(
  () => categories.value[categories.value.findIndex((c) => c.id === active.value) + 1],
);
let nextIO: UniApp.IntersectionObserver | null = null;
function disarmAdvance() {
  nextIO?.disconnect();
  nextIO = null;
}
function advance() {
  disarmAdvance();
  previewNext.value = false;
  const target = nextCategory.value;
  if (!target || !nextRows.value.length) return;
  active.value = target.id;
  products.value = nextRows.value;
  nextRows.value = [];
  // 预览块顶部恰在视口顶 → 新列表开头=刚看过的商品，归零即视觉接续
  mainTop.value = 0;
  topGuardUntil = Date.now() + 800;
  jumpLocked.value = true;
  setTimeout(() => (jumpLocked.value = false), 300);
  fadeIn();
  void prefetchNeighbors();
}
function armAdvanceObserver() {
  disarmAdvance();
  const inst = getCurrentInstance();
  if (!inst) return;
  nextIO = uni.createIntersectionObserver(inst.proxy as never, {
    observeAll: false,
  });
  nextIO.relativeToViewport({ bottom: 0 }).observe(".pp-next", (res) => {
    if (res.boundingClientRect.top <= 0) advance();
  });
}
const onReachEnd = () => {
  if (jumpLocked.value || keyword.value || loading.value || error.value) return;
  if (!nextCategory.value || previewNext.value) return;
  // 进入预览态：尾部追加下一分类预览块（数据就绪后武装无缝切换观察器）
  previewNext.value = true;
  const target = nextCategory.value;
  const hit = prefetchCache.get(target.id);
  const ready = hit && Date.now() - hit.at < PREFETCH_TTL;
  const fill = async () => {
    nextRows.value =
      ready && hit ? hit.rows : await fetchCategoryProducts(target.id);
    if (ready && hit) prefetchCache.delete(target.id);
    armAdvanceObserver();
  };
  void fill().catch(() => {
    previewNext.value = false;
  });
};
/** IKG8PC 二轮：边界预告——尾部显示下一个分类名，让续跳从"意外"变"预告" */
const nextCategoryName = computed(() => {
  const idx = categories.value.findIndex((c) => c.id === active.value);
  return categories.value[idx + 1]?.name ?? "";
});
/** IKDBFT：快捷分类横滑条（原首页分类条同款）——仅真实 DB 分类，
 *  「全部」「限时秒杀」伪分类留给左侧栏；点击 pick() 页内联动 */
const quickCats = computed(() =>
  categories.value.filter((c) => c.id !== "all" && c.id !== "seckill"),
);
const open = (id: string) =>
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
/** 搜索态标题（IKAHBJ）：关键词 + 当前分类联动，让筛选范围始终可见 */
const currentName = () => {
  const base =
    active.value === "all"
      ? "全部分类"
      : categories.value.find((c) => c.id === active.value)?.name || "全部商品";
  return keyword.value ? `“${keyword.value}” · ${base}` : base;
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
    <!-- 2026-09-05 道哥决策暂时下线，此区域预留广告位（方案待定）；恢复 = 删除 v-if="false" --><scroll-view
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
      ></scroll-view
    ><view class="body"
      ><scroll-view scroll-y class="side"
        ><view
          v-for="c in categories"
          :key="c.id"
          class="side__item"
          :class="{ 'side__item--active': active === c.id }"
          @tap="pick(c.id)"
          ><!-- 纯文字侧栏（2026-08-22）：图标挤压文字导致 5 字分类换行、行高不齐；
          图标识别职责交给首页横滑条，侧栏回归单行导航（美团式分类页形态） -->
          <text class="side__name">{{ c.name }}</text></view
        ></scroll-view
      ><scroll-view
        scroll-y
        class="main"
        :scroll-top="mainTop"
        :upper-threshold="60"
        :lower-threshold="120"
        @scroll="onMainScroll"
        @scrolltolower="onReachEnd"
        @scrolltoupper="onReachTop"
        ><!-- IKGQ6R 丝滑化：切换期间顶部细加载条（旧内容保留不闪骨架） -->
        <view v-if="switching" class="switch-bar"></view>
        ><view class="main__title">{{ currentName() }}</view
        ><view v-if="error" class="cat-retry card" @tap="load"
          ><text class="cat-retry__title">商品加载失败</text
          ><text class="muted">网络异常，点击重试</text></view
        ><view v-else-if="loading" class="cat-skeleton"
          ><view v-for="n in 4" :key="n" class="cat-skeleton__block" /></view
        ><template v-else
          ><view
            :class="{ 'list-fade': listEntering }"
            class="list-wrap"
          ><view v-if="!products.length" class="main__empty muted"
            >这个分类暂时没货，去看看别的吧</view
          ><view
            v-for="p in products"
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
        ></template
        ><!-- IKGQ6R 三轮：下一分类预览块——滑过即无缝切到下一分类，左侧高亮同步 -->
        <view v-if="previewNext" class="pp-next">
          <view class="pp-next__banner"
            ><text class="pp-next__label">下一分类</text
            >{{ nextCategoryName }}</view
          >
          <view v-if="!nextRows.length" class="pp-next__loading muted"
            >正在准备下一分类…</view
          >
          <view
            v-for="p in nextRows"
            :key="p.id"
            class="item card pp-next__item"
            @tap="open(p.id)"
            ><image
              class="item__image"
              :src="p.image"
              mode="aspectFit"
              :alt="p.name"
            /><view class="item__main"
              ><text class="item__name">{{ p.name }}</text
              ><view class="item__pricegrp"
                ><text class="price"
                  ><text class="price__symbol">¥</text
                  >{{ fenToYuan(p.price) }}</text
                ></view
              ></view
            ></view
          >
        </view>
        <!-- IKG8PC 二轮：边界预告——到底/到顶续跳前给预期，从"意外跳走"变"按预告翻页" -->
        <view
          v-if="!loading && !error && !keyword && products.length && !previewNext"
          class="next-hint"
          ><text v-if="nextCategoryName"
            >继续滚动 · 下一分类「{{ nextCategoryName }}」</text
          ><text v-else>已经是最后一个分类啦</text></view
        ></scroll-view
      ></view
    ><TabBar :current="1" /><CartOverlay /></view
  >
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
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
  width: 196rpx;
  flex-shrink: 0;
  height: 100%;
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
  height: 100%;
  min-width: 0;
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
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 8rpx 16rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #07883b;
}
.pp-next__label {
  font-size: 20rpx;
  font-weight: 600;
  color: #fff;
  background: $primary;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
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
