<script setup lang="ts">
import { computed, ref } from "vue";
import { nextTick } from "vue";
import { onPageScroll, onReachBottom } from "@dcloudio/uni-app";
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
  loading = ref(true),
  error = ref(false),
  cart = useCartStore(),
  /** IKG1C 打烊停单：闭店态共享自 campus store（首页已随 /home 注入） */
  campusStore = useCampusStore(),
  closedNow = computed(() => campusStore.closedNow);
/** IKGQ6R 终版·页面级无限流：所有分类按侧栏顺序拼成页面长列表，
 *  滚到底自动 append 下一分类段（纯追加零跳变），左侧高亮随滚动位置联动。 */
interface CatSeg {
  catId: string;
  catName: string;
  items: Product[];
}
const sections = ref<CatSeg[]>([]);
const appending = ref(false);
/** 展平渲染数组：商品卡模板与秒杀/加购逻辑零改动 */
const products = computed<Product[]>(() => sections.value.flatMap((s2) => s2.items));
/** IKGNMV 一单一秒杀：购物车里已有**其他**秒杀品时，本秒杀品＋置灰 */
function seckillLocked(p: Product): boolean {
  return (
    p.promotion?.type === "seckill" &&
    !!cart.cart.seckillIdInCart &&
    cart.cart.seckillIdInCart !== p.id
  );
}
/** 商品列表三态（IK9AWK）：加载骨架 / 失败重试 / 列表 */
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
      {
        catId,
        catName: cat?.name ?? "全部",
        items: await fetchCategoryProducts(catId),
      },
    ];
  } catch (e) {
    // ADR-0005(IKA00Q)：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
    if (isRetryable(e)) error.value = true;
  } finally {
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
/** 侧栏点击（IKGQ6R 终版·页面级无限流）：已渲染的分类→原生平滑滚到段头；
 *  未渲染的分类→补渲染该段再滚过去。active 由滚动位置联动（见 onPageScroll）。 */
async function pick(id: string) {
  active.value = id;
  if (sections.value.some((s) => s.catId === id)) {
    uni.pageScrollTo({ selector: `#cat-${id}`, duration: 200 } as never);
    return;
  }
  const target = categories.value.find((c) => c.id === id);
  if (!target) return;
  loading.value = true;
  try {
    sections.value.push({
      catId: id,
      catName: target.name,
      items: await fetchCategoryProducts(id),
    });
    void nextTick(() =>
      uni.pageScrollTo({ selector: `#cat-${id}`, duration: 200 } as never),
    );
  } catch {
    /* request 层 toast，列表保留旧内容 */
  } finally {
    loading.value = false;
  }
}
/** 页面滚动联动（IKGQ6R）：节流量各段边界，落在视口上缘附近者为当前分类；
 *  页面接近底部时自动接续下一分类段（纯追加零跳变）。 */
let segSyncAt = 0;
onPageScroll((e) => {
  const now = Date.now();
  if (now - segSyncAt < 150) return;
  segSyncAt = now;
  if (loading.value || !sections.value.length) return;
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
});
/** 页面触底（IKGQ6R）：自动 append 下一分类段（纯追加零跳变） */
onReachBottom(() => {
  if (appending.value || loading.value) return;
  const last = sections.value[sections.value.length - 1];
  if (!last) return;
  const next = nextCatOf(last.catId);
  if (!next) return;
  appending.value = true;
  void (async () => {
    try {
      const hit = prefetchCache.get(next.id);
      const rows =
        hit && Date.now() - hit.at < PREFETCH_TTL
          ? (prefetchCache.delete(next.id), hit.rows)
          : await fetchCategoryProducts(next.id);
      // 仍为末段才追加（防快速滚动时重复接续）
      if (sections.value[sections.value.length - 1]?.catId === last.catId)
        sections.value.push({ catId: next.id, catName: next.name, items: rows });
    } catch {
      /* 拉取失败静默：下次触底重试 */
    } finally {
      appending.value = false;
    }
  })();
});
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
      ><!-- IKGQ6R 终版：侧栏固定吸附（页面级滚动，主区随页面流） -->
      <view class="side"
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
        ><view class="main__title">{{ currentName() }}</view
        ><view v-if="error" class="cat-retry card" @tap="load"
          ><text class="cat-retry__title">商品加载失败</text
          ><text class="muted">网络异常，点击重试</text></view
        ><view v-else-if="loading" class="cat-skeleton"
          ><view v-for="n in 4" :key="n" class="cat-skeleton__block" /></view
        ><template v-else>
          <view v-if="!products.length && !appending" class="main__empty muted">
            这个分类暂时没货，去看看别的吧
          </view>
          <view
            v-for="seg in sections"
            :key="seg.catId"
            :id="'cat-' + seg.catId"
            class="cat-seg"
          >
            <view v-if="sections.length > 1" class="cat-seg__head">
              {{ seg.catName }}
            </view>
            <view v-if="!seg.items.length" class="main__empty muted">
              这个分类暂时没货，去看看别的吧
            </view>
            <view
              v-for="p in seg.items"
              :key="p.id"
              class="item card"
              @tap="open(p.id)"
            >
              <image
                class="item__image"
                :src="p.image"
                mode="aspectFit"
                :alt="p.name"
              />
              <view class="item__main">
                <text class="item__name">{{ p.name }}</text>
                <text class="item__sub">{{ p.subtitle }}</text>
                <view class="item__bottom">
                  <view class="item__pricegrp">
                    <text class="price">
                      <text class="price__symbol">¥</text
                      >{{ fenToYuan(p.price) }}</text
                    >
                    <text v-if="p.originalPrice" class="item__strike"
                      >¥{{ fenToYuan(p.originalPrice) }}</text
                    >
                  </view>
                  <view v-if="cart.quantity(p.id)" class="counter" @tap.stop>
                    <button
                      class="counter__btn counter__btn--minus"
                      aria-label="减少一件"
                      @tap.stop="cart.set(p, cart.quantity(p.id) - 1)"
                    >
                      −
                    </button>
                    <text class="counter__num">{{ cart.quantity(p.id) }}</text>
                    <button
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
                    </button>
                  </view>
                  <button
                    v-else-if="closedNow"
                    class="add add--closed"
                    disabled
                    aria-label="已打烊"
                  >
                    ＋
                  </button>
                  <button
                    v-else-if="p.seckillLimit?.purchased"
                    class="add add--bought"
                    disabled
                    aria-label="已抢购"
                  >
                    已抢
                  </button>
                  <button
                    v-else-if="seckillLocked(p)"
                    class="add add--bought"
                    disabled
                    aria-label="一单限一个"
                  >
                    限一
                  </button>
                  <button
                    v-else
                    class="add"
                    aria-label="加入购物车"
                    @tap.stop="cart.set(p, cart.quantity(p.id) + 1)"
                  >
                    ＋
                  </button>
                </view>
              </view>
            </view>
          </view>
          <view v-if="appending" class="next-hint">正在接续下一分类…</view>
          <view v-else-if="!nextCategoryName" class="next-hint"
            >已经是最后一个分类啦</view
          >
          <view v-else class="next-hint"
            >继续下滑 · 下一分类「{{ nextCategoryName }}」</view
          >
        </template>
        </view
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
  /* IKGQ6R 终版：页面级滚动——侧栏 sticky 吸附，主区随页面流接续 */
  align-items: flex-start;
  /* 底部补偿（2026-08-23）：自绘 TabBar 高约 118rpx+安全区，滚动区不留
   * 余量时最后一张商品卡被条压住只露半截；140rpx 含 22rpx 呼吸 */
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}
.side {
  position: sticky;
  top: 20rpx;
  max-height: calc(100vh - 220rpx);
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
}
.cat-seg__head {
  margin: 20rpx 4rpx 14rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: #07883b;
  padding-left: 12rpx;
  border-left: 8rpx solid $primary;
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
/* IKG8FF：秒杀限购达到上限的 ＋ 与已抢购按钮——灰化禁用态 */
.counter__btn--cap,
.add--closed,
.add--bought {
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
