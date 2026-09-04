<script setup lang="ts">
import { computed, getCurrentInstance, onUnmounted, ref } from "vue";
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import ProductCard from "../../components/ProductCard.vue";
import WheelPanel from "../../components/WheelPanel.vue";
import WelcomeGift from "../../components/WelcomeGift.vue";
import { useCartStore } from "../../stores/cart";
import { useSessionStore } from "../../stores/session";
import { categoryImage } from "../../utils/categoryImage";
import { fenToYuan } from "../../utils/money";
import { PROMO_TITLE } from "../../utils/promotion";
import type {
  Address,
  Banner,
  Category,
  HomePromotion,
  Product,
  UserCoupon,
} from "../../types";

const cart = useCartStore(),
  // IKAJT2：校区名接口下发（home().campus.name），空串时模板兜底「选择校区」
  campus = ref(""),
  defaultAddress = ref<Address | null>(null),
  categories = ref<Category[]>([]),
  products = ref<Product[]>([]),
  /** 首页轮播（IK9RX2）：DB 数据为准，本地渐变仅为兜底占位（后台无 Banner 时极简展示） */
  banners = ref<Banner[]>([]),
  /** 促销分组（IKAHFG/ADR-0006）：进行中活动，空 = 不渲染模块卡 */
  promotions = ref<HomePromotion[]>([]),
  loading = ref(true);
/** 分类图标：共享 categoryImage（IK9VD3），商品页侧栏同款回退，两边恒一致 */
/** 地址栏：默认地址的楼栋+寝室；无地址时引导去选择 */
const addressText = computed(() =>
  defaultAddress.value
    ? `${defaultAddress.value.buildingName} ${defaultAddress.value.room}`
    : "请选择地址",
);
onShow(async () => {
  await useSessionStore().ensureLogin();
  const [home, addresses] = await Promise.all([api.home(), api.addresses()]);
  campus.value = home.campus.name;
  defaultAddress.value =
    addresses.find((item) => item.isDefault) || addresses[0] || null;
  categories.value = home.categories;
  banners.value = home.banners;
  products.value = home.hotProducts;
  promotions.value = home.promotions ?? [];
  await cart.load();
  loading.value = false;
  // IKD6FA：双版块数据静默拉取；IKDETO 迎新礼包内容同批拉取后判定弹窗
  await loadHomeBlocks();
  maybeShowWelcomeGift();
  // IKCNRB：数据渲染后量宽判溢出（决定右缘指示是否显示）
  setTimeout(measureCategoryOverflow, 200);
});
/* ---------- 首页双版块（IKD6FA）：左「天天抽奖」入口 + 右「楼栋福利群」 ---------- */
/** 转盘配置：active=false（未配置/已下线）时不渲染左卡 */
const wheelActive = ref(false);
/** 群码（IKAJSZ 同源接口）：null = 未配置楼栋群与校级大群，右卡不渲染 */
const group = ref<Awaited<ReturnType<typeof api.wechatGroup>>>(null);
const groupOpen = ref(false);
async function loadHomeBlocks() {
  // 静默降级：任一失败只隐藏对应入口，不影响首页主流程
  try {
    wheelActive.value = (await api.wheel()).active;
  } catch {
    wheelActive.value = false;
  }
  try {
    group.value = await api.wechatGroup();
  } catch {
    group.value = null;
  }
  // IKDETO：signup 券一次拉取两用——迎新弹窗内容 +「我的」tab 红点
  try {
    const bundle = await api.coupons();
    const now = Date.now();
    signupCoupons.value = bundle.mine.filter(
      (item) =>
        item.coupon.trigger === "signup" &&
        (item.status === "claimed" || item.status === "released") &&
        (!item.coupon.expiresAt ||
          new Date(item.coupon.expiresAt).getTime() > now),
    );
    useSessionStore().hasUsableSignupCoupon = signupCoupons.value.length > 0;
  } catch {
    signupCoupons.value = [];
  }
}
/* ---------- IKDETO 迎新礼包：注册当次弹一次（storage 防重） ---------- */
const signupCoupons = ref<UserCoupon[]>([]),
  giftOpen = ref(false),
  GIFT_SHOWN_KEY = "welcomeGiftShown";
function maybeShowWelcomeGift() {
  const session = useSessionStore();
  if (!session.justSignedUp) return;
  session.justSignedUp = false; // 一次性：当次消费即清，重登不弹
  if (uni.getStorageSync(GIFT_SHOWN_KEY)) return;
  if (!signupCoupons.value.length) return;
  uni.setStorageSync(GIFT_SHOWN_KEY, true);
  giftOpen.value = true;
}
function onGiftUse() {
  giftOpen.value = false;
  uni.switchTab({ url: "/pages/category/index" });
}
/** IKDERY：右卡（福利群）恒渲染（未配置走筹备中态），左卡仍随转盘配置显隐 */
/** IKDERY：筹备中弹窗「先去逛逛」——关弹窗直达分类页 */
function goBrowseFromGroup() {
  groupOpen.value = false;
  uni.switchTab({ url: "/pages/category/index" });
}
/** IKDB7W：点击入口原地弹层抽奖（不跳转）；pages/wheel 薄壳仅作分享落地 */
const wheelOpen = ref(false);
function goWheel() {
  if (!wheelActive.value) return;
  wheelOpen.value = true;
}
/* ---------- 促销模块卡（IKAHFG/ADR-0006）：秒杀/临期各一块，倒计时走秒级跳动 ---------- */
/** 倒计时心跳：模块卡存在才渲染时间，秒级刷新；页面卸载即清 */
const now = ref(Date.now());
const promoTicker = setInterval(() => (now.value = Date.now()), 1000);
onUnmounted(() => clearInterval(promoTicker));
/** 按 type 分组渲染（同组共用标题），组倒计时取最早结束的活动。
 *  IKB3NR：条目/分组按剩余时间过滤——归零那一秒本地即回落，不等下次 onShow。 */
const promoGroups = computed(() => {
  const groups: Array<{
    type: string;
    title: string;
    endsAt: string;
    items: HomePromotion[];
  }> = [];
  for (const type of ["seckill", "clearance"]) {
    // 先剔除本地时钟已归零的活动（后端窗口判断的兜底）
    const alive = promotions.value.filter(
      (x) => x.type === type && new Date(x.endsAt).getTime() > now.value,
    );
    if (!alive.length) continue;
    groups.push({
      type,
      title: PROMO_TITLE[type],
      endsAt: alive.reduce(
        (min, x) => (x.endsAt < min ? x.endsAt : min),
        alive[0].endsAt,
      ),
      items: alive,
    });
  }
  return groups;
});
/** 秒杀版块固定窗口（IKC1A9 → PM 0831 细化 → IKCN5W → 0902 终稿：一行 4 个、
 *  无倒计时、3s 自动换批（换批时整组从下往上滑入，见模板 :key=offset）；
 *  整卡点击跳分类页专区 */
const SECKILL_PAGE_SIZE = 4;
const SECKILL_ROTATE_MS = 3000;
const seckillOffset = ref(0);
const seckillWindow = computed(() => {
  const g = promoGroups.value.find((x) => x.type === "seckill");
  if (!g) return [];
  const items = g.items;
  if (items.length <= SECKILL_PAGE_SIZE) return items;
  const out: HomePromotion[] = [];
  for (let i = 0; i < SECKILL_PAGE_SIZE; i++)
    out.push(items[(seckillOffset.value + i) % items.length]);
  return out;
});
function nextSeckillBatch() {
  seckillOffset.value += SECKILL_PAGE_SIZE;
}
const seckillTicker = setInterval(nextSeckillBatch, SECKILL_ROTATE_MS);
onUnmounted(() => clearInterval(seckillTicker));
/** Banner 主题：预置键映射渐变，自定义 hex 走内联底色。 */
const BANNER_THEMES: Record<string, string> = {
  green: "linear-gradient(120deg, #07883b 0%, #25b95a 60%, #41ce69 100%)",
  orange: "linear-gradient(120deg, #e25c05 0%, #ff7a21 60%, #ffa24d 100%)",
  dark: "linear-gradient(120deg, #1e2520 0%, #2f4436 60%, #159447 100%)",
};
/** 配送栏双入口（IKAJT2）：校区切换页 / 寝室地址页 */
function goCampus() {
  uni.navigateTo({ url: "/pages/campus/index" });
}
function goAddress() {
  uni.navigateTo({ url: "/pages/address/index" });
}
function bannerStyle(banner: Banner) {
  const theme = BANNER_THEMES[banner.color];
  if (theme) return { background: theme };
  // 自定义 hex：纯色底，文字白字可读
  return { background: banner.color || "#07883b" };
}
/**
 * Banner 点击跳图文详情（IK9SNN）：后台配了详情内容才可点，
 * 数据经 storage 传给图文页（/home 已拉全量，不建详情端点）。
 * IKC1AD：详情主口径改为「长图」（detailImage），旧文字 content 保留兼容。
 */
function openBanner(banner: Banner) {
  if (!banner.detailImage?.trim() && !banner.content?.trim()) return;
  uni.setStorageSync(
    "bannerContent",
    JSON.stringify({
      title: banner.title,
      subtitle: banner.subtitle,
      badge: banner.badge,
      image: banner.image,
      detailImage: banner.detailImage ?? "",
      content: banner.content ?? "",
    }),
  );
  uni.navigateTo({ url: "/pages/content/detail" });
}
/** Banner 可点性（IKC1AD）：配了长图或旧文字详情才算可点（驱动按压反馈样式） */
const hasBannerDetail = (banner: Banner) =>
  Boolean(banner.detailImage?.trim() || banner.content?.trim());
const add = (p: Product) => cart.set(p, cart.quantity(p.id) + 1);
/** 分享（IKC7V6）：默认分享——微信自动截当前页为分享图，落地首页 */
onShareAppMessage(() => ({
  title: "不出寝，零食送到寝室",
  path: "/pages/index/index",
}));
onShareTimeline(() => ({ title: "不出寝，零食送到寝室" }));
/** 首页分类横滑条：与商品页侧栏同源同序，含「全部」（DB 配图）；
 *  横滑一行浏览全部分类（2026-08-22 需求），不再按 6 列折行，仅留防御上限 */
const rowCategories = computed(() => categories.value.slice(0, 24));
/* ---------- IKCNRB：分类横滑可滑动感知——右缘「›」指示（滑到最右淡出） ---------- */
const categoryOverflow = ref(false);
const categoryCanScrollRight = ref(false);
let categoryViewportW = 0;
/** 量宽判定内容是否溢出（溢出才显示右缘指示） */
function measureCategoryOverflow() {
  const instance = getCurrentInstance()?.proxy;
  if (!instance) return;
  uni
    .createSelectorQuery()
    .in(instance)
    .select(".categories__scroll")
    .boundingClientRect()
    .select(".categories__row")
    .boundingClientRect()
    .exec((res) => {
      if (!res?.[0] || !res?.[1]) return;
      categoryViewportW = res[0].width ?? 0;
      categoryOverflow.value = (res[1].width ?? 0) > categoryViewportW + 8;
      if (categoryOverflow.value) categoryCanScrollRight.value = true;
    });
}
function onCategoryScroll(event: {
  detail: { scrollLeft: number; scrollWidth: number };
}) {
  const { scrollLeft, scrollWidth } = event.detail;
  const max = scrollWidth - categoryViewportW;
  categoryCanScrollRight.value = scrollLeft < max - 8;
}
/** 计数器减件（IK9AWL）：ProductCard 数量>0 时展开 − n ＋ */
const remove = (p: Product) => cart.set(p, cart.quantity(p.id) - 1);
const open = (id: string) =>
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
const goCategory = () => uni.switchTab({ url: "/pages/category/index" });
/** 促销版块入口（IKBW0K）：整卡跳分类页「限时秒杀」特殊分类——点击秒杀商品
 *  /版块都进专区列表（switchTab 不支持 query，走 storage 传递）；
 *  临期版块暂无专区，直接进分类页。 */
function goPromoCategory(type: string) {
  if (type === "seckill") uni.setStorageSync("categoryPick", "seckill");
  goCategory();
}
/**
 * 金刚区点击带分类 id 跳商品页（IK9SOB）：switchTab 不支持 query，
 * 与搜索词同走 storage 传递；商品页 onShow 消费后选中对应分类。
 */
function pickCategory(item: Category) {
  uni.setStorageSync("categoryPick", item.id);
  goCategory();
}
/** 首页真搜索（IK9AWP）：确认后带关键词去分类页（switchTab 不支持参数，走 storage 传递） */
const keyword = ref("");
function search() {
  uni.setStorageSync("searchKeyword", keyword.value.trim());
  goCategory();
}
</script>

<template>
  <view class="page home">
    <view class="brand-row"
      ><text class="brand">不出寝食社</text><view class="brand-dot"
    /></view>
    <view class="location"
      ><!-- IKAJT2：校区/地址双入口——点校区名换校区（商品价格随之刷新），点地址去选寝室 -->
      <text class="pin">●</text
      ><text class="loc-campus" @tap.stop="goCampus">{{
        campus || "选择校区"
      }}</text
      ><text class="loc-sep"> · </text
      ><text class="loc-addr" @tap.stop="goAddress">{{ addressText }}</text
      ><text class="down" @tap.stop="goCampus">⌄</text></view
    >
    <view class="search"
      ><text class="search__glass">⌕</text
      ><input
        v-model="keyword"
        class="search__input"
        placeholder="今天想吃什么？"
        placeholder-class="search__placeholder"
        confirm-type="search"
        @confirm="search"
      /><text class="search__button" @tap="search">搜索</text></view
    >
    <swiper
      v-if="!loading && banners.length"
      class="hero"
      autoplay
      circular
      :interval="4000"
      :duration="400"
      indicator-dots
      indicator-color="rgba(255, 255, 255, 0.45)"
      indicator-active-color="#ffffff"
      ><swiper-item v-for="banner in banners" :key="banner.id"
        ><view
          class="hero__slide"
          :class="{ 'hero__slide--link': hasBannerDetail(banner) }"
          :style="bannerStyle(banner)"
          @tap="openBanner(banner)"
          ><image
            v-if="banner.image"
            class="hero__bg"
            :src="banner.image"
            mode="scaleToFill"
          /><!-- IKDEUR 三修（道哥方案）：scaleToFill 严格铺满——图边缘完整展示、
               零裁切零留白，展示对称性完全由设计图决定；防变形由 admin 上传口
               自动裁切到 2.55:1 兜底 --><!-- IKC1AD：用户端 Banner 只显示图片，标题/副标题/角标退为内部字段；
               文字仅在无图兜底帧（渐变底）保留，纯色块无字不可读 --><view
            class="hero__mask"
            v-if="!banner.image && banner.badge"
          ></view
          ><template v-if="!banner.image"
            ><text v-if="banner.badge" class="hero__tag">{{
              banner.badge
            }}</text
            ><text v-if="banner.title" class="hero__title">{{
              banner.title
            }}</text
            ><text v-if="banner.subtitle" class="hero__sub">{{
              banner.subtitle
            }}</text></template
          ></view
        ></swiper-item
      ></swiper
    >
    <!-- 空 Banner 降级（IK9RX2）：后台未配置时给一个品牌占位帧，不让轮播区塌掉；
         2026-09-05 骨架屏：loading 期间不闪空占位帧，改渲染同构 shimmer -->
    <view v-else-if="!loading" class="hero hero--empty"
      ><view class="hero__slide hero__slide--green"
        ><text class="hero__title">今天不出寝</text
        ><text class="hero__sub">想吃的照样有</text></view
      ></view
    >
    <view v-else class="hero hero--skeleton" />
    <!-- 首页双版块（IKD6FA）：左天天抽奖（进转盘页）+ 右楼栋福利群（弹二维码）。
         左卡转盘未配置/已下线时隐藏，右卡群码未配置时隐藏，都无则整块不渲染；
         卡片背景图走 COS（static.buchuqin.com，图自带右侧装饰，不再叠加 CSS 装饰） -->
    <!-- 2026-09-05 骨架屏：双卡区 loading 期间同构 shimmer 占位（与最终
         版块同栅格），数据到达零跳变；真卡见下方 v-if -->
    <view v-if="loading" class="homeblocks"
      ><view
        v-for="n in 2"
        :key="n"
        class="homeblocks__card homeblocks__card--skeleton"
      ></view
    ></view>
    <view v-else class="homeblocks"
      ><view
        v-if="wheelActive"
        class="homeblocks__card homeblocks__card--wheel"
        @tap="goWheel"
        ><text class="homeblocks__title">天天抽奖</text
        ><text class="homeblocks__sub">每日 1 次 · 优惠券等你拿</text
        ><view class="homeblocks__cta">去试试手气 ›</view></view
      ><!-- IKDERY：右卡未配群码也显示——红点/文案切筹备中态，点击弹窗占位 -->
      <view
        class="homeblocks__card homeblocks__card--group"
        @tap="groupOpen = true"
        ><view v-if="group" class="homeblocks__dot" /><text
          class="homeblocks__title"
          >楼栋福利群</text
        ><text class="homeblocks__sub">{{
          group ? "进群领福利 · 优惠早知道" : "福利群筹备中 · 敬请期待"
        }}</text
        ><view class="homeblocks__cta">{{
          group ? "一键加入 ›" : "先逛逛福利 ›"
        }}</view></view
    ></view>
    <!-- 分类横滑条（2026-08-22）：单行展示，左右滑动看更多。
         IKCNRB：可滑动感知——右缘渐隐+「›」指示，滑到最右淡出
         IKDBFT（2026-09-04）：首页分类条下线（道哥），同款移至商品页搜索框下方；
         整块保留，恢复 = 删除 v-if="false" -->
    <view v-if="false" class="categories card"
      ><scroll-view
        scroll-x
        class="categories__scroll"
        enhanced
        :show-scrollbar="false"
        @scroll="onCategoryScroll"
        ><view class="categories__row"
          ><!-- 加载占位（2026-08-24）：骨架圆+名条与真条同构，数据到达零跳变 --><template
            v-if="loading"
            ><view v-for="n in 8" :key="n" class="category category--skeleton"
              ><view class="category__image" /><text class="category__name"
                >　</text
              ></view
            ></template
          ><template v-else
            ><view
              v-for="item in rowCategories"
              :key="item.id"
              class="category"
              @tap="pickCategory(item)"
              ><view class="category__image"
                ><image :src="categoryImage(item)" mode="aspectFit" /></view
              ><text class="category__name">{{ item.name }}</text></view
            ></template
          ></view
        ></scroll-view
      ><!-- 右缘滑动指示：纯视觉不拦截手势（pointer-events:none） --><view
        v-if="categoryOverflow"
        class="categories__hint"
        :class="{ 'categories__hint--end': !categoryCanScrollRight }"
        ><text class="categories__hint-arrow">›</text></view
      ></view
    >
    <!-- 促销模块卡（IKAHFG/ADR-0006）：秒杀/临期分组，横滑，无活动不占位。
         IKBW0K：倒计时移除（多活动结束时间不一，单一倒计时失真）；整卡改为
         分类页「限时秒杀」入口——点击秒杀商品/版块均跳分类页特殊分类 -->
    <view
      v-for="g in promoGroups"
      :key="g.type"
      class="promo card"
      role="button"
      @tap="goPromoCategory(g.type)"
      ><view class="promo__head"
        ><!-- IKCN5W 终稿：倒计时移除（道哥 0902），头部只留标题 --><text
          class="promo__title"
          :class="{ 'promo__title--hot': g.type === 'seckill' }"
          >{{ g.title }}</text
        ></view
      ><!-- IKCN5W：一行 4 个（去商品名，图即锚点）；:key=offset 换批时整组
           重建触发从下往上入场动画（四项同步，无错峰） -->
      <view v-if="g.type === 'seckill'" class="promo__grid" :key="seckillOffset"
        ><view
          v-for="item in seckillWindow"
          :key="seckillOffset + '-' + item.id"
          class="promo__item promo__item--grid"
          ><image
            class="promo__image promo__image--grid"
            :src="item.product.image"
            mode="aspectFit"
            :alt="item.product.name"
          /><view class="promo__bottom promo__bottom--grid"
            ><text class="price"
              ><text class="price__symbol">¥</text
              >{{ fenToYuan(item.product.price) }}</text
            ><text class="promo__strike"
              >¥{{ fenToYuan(item.product.originalPrice) }}</text
            ></view
          ></view
        ></view
      ><scroll-view
        v-else
        scroll-x
        class="promo__scroll"
        enhanced
        :show-scrollbar="false"
        ><view class="promo__row"
          ><view v-for="item in g.items" :key="item.id" class="promo__item"
            ><image
              class="promo__image"
              :src="item.product.image"
              mode="aspectFit"
              :alt="item.product.name"
            /><text class="promo__name">{{ item.product.name }}</text
            ><view class="promo__bottom"
              ><text class="price"
                ><text class="price__symbol">¥</text
                >{{ fenToYuan(item.product.price) }}</text
              ><text class="promo__strike"
                >¥{{ fenToYuan(item.product.originalPrice) }}</text
              ></view
            ></view
          ></view
        ></scroll-view
      ></view
    >
    <view class="section-title"
      ><text class="section-title__main">为你推荐</text
      ><text class="section-title__sub" @tap="goCategory"
        ><!-- IK9VQ3：chevron 形状即 >，改 chip 暗示可点 -->
        <text class="link-chip">更多</text></text
      ></view
    >
    <view v-if="loading" class="grid"
      ><view v-for="n in 4" :key="n" class="skeleton" /></view
    ><view v-else-if="!products.length" class="grid-empty"
      ><text class="muted">货架暂时空着，去「商品」页逛逛</text></view
    ><view v-else class="grid"
      ><ProductCard
        v-for="p in products"
        :key="p.id"
        :product="p"
        :quantity="cart.quantity(p.id)"
        @add="add"
        @remove="remove"
        @open="open"
    /></view>
  </view>

  <!-- 进群弹窗（IKD6FA 复用 IKAJSZ）：show-menu-by-longpress 长按识别；
       IKDERY 未配置态：气泡占位 + 筹备中文案 + 去逛逛引导 -->
  <view v-if="groupOpen" class="group-mask" @tap="groupOpen = false"
    ><view class="group-pop" @tap.stop
      ><!-- 已配置态：二维码 + 长按识别 -->
      <template v-if="group"
        ><text class="group-pop__title">{{
          group.scope === "building" ? "本楼栋群" : "校园大群"
        }}</text
        ><image
          class="group-pop__qr"
          :src="group.image"
          mode="widthFix"
          show-menu-by-longpress
        ></image
        ><text class="group-pop__tip">长按识别二维码，加入群聊</text
        ><button class="group-pop__close" @tap="groupOpen = false">
          我知道了
        </button></template
      ><!-- 未配置态（IKDERY）：CSS 对话气泡占位 -->
      <template v-else
        ><text class="group-pop__title">楼栋福利群</text
        ><view class="group-pop__placeholder"
          ><view class="group-pop__bubble"
            ><view class="group-pop__bubble-dots"
              ><view /><view /><view /></view
            ></view
          ></view
        ><text class="group-pop__empty-title">福利群筹备中</text
        ><text class="group-pop__tip"
          >楼栋专属福利与优惠早知道，群码上线后第一时间开放</text
        ><view class="group-pop__btns"
          ><button class="group-pop__close" @tap="groupOpen = false">
            我知道了
          </button>
          <button
            class="group-pop__primary"
            @tap="goBrowseFromGroup"
          >
            先去逛逛
          </button></view
        ></template
      ></view
    ></view
  >
  <!-- IKDETO 迎新礼包：注册当次弹一次 -->
  <WelcomeGift
    v-if="giftOpen"
    :coupons="signupCoupons"
    @use="onGiftUse"
    @close="giftOpen = false"
  />
  <!-- IKDB7W：天天抽奖原地弹层（WheelPanel 公共组件，pages/wheel 仅作分享落地） -->
  <view v-if="wheelOpen" class="wheel-sheet-mask" @tap="wheelOpen = false">
    <view class="wheel-sheet" @tap.stop>
      <view class="wheel-sheet__close" @tap="wheelOpen = false">✕</view>
      <view class="wheel-sheet__inner">
        <view class="wheel-sheet__head"></view>
        <view class="wheel-sheet__panel"><WheelPanel /></view>
      </view>
    </view>
  </view>
  <TabBar :current="0" />
  <CartOverlay />
</template>

<style scoped lang="scss">
@import "../../styles/theme.scss";
.home {
  padding-top: calc(30rpx + env(safe-area-inset-top));
  /* 底部补偿（2026-08-23）：推荐网格末行不压在自绘 TabBar 下 */
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}
.brand-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.brand {
  font-size: 40rpx;
  font-weight: 900;
  color: $primary-dark;
  letter-spacing: 1rpx;
}
.brand-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: $primary;
}
.location {
  min-height: 82rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-weight: 700;
}
.pin {
  color: $primary;
  font-size: 30rpx;
}
.down {
  color: $primary-dark;
}
/* IKAJT2：双入口命中区放大（IK9AWL 同款 ≥88rpx 热区规范） */
.loc-campus,
.loc-addr {
  min-height: 88rpx;
  display: inline-flex;
  align-items: center;
}
.loc-sep {
  color: $muted;
}
.search {
  height: 84rpx;
  background: #fff;
  border: 3rpx solid $primary;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  padding-left: 24rpx;
  overflow: hidden;
}
.search__glass {
  font-size: 40rpx;
  color: $muted;
}
.search__input {
  flex: 1;
  color: $ink;
  margin-left: 12rpx;
  font-size: 25rpx;
  height: 100%;
}
.search__placeholder {
  color: #707973;
}
.search__button {
  align-self: stretch;
  min-width: 126rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #41ce69, $primary);
  color: #fff;
  font-weight: 800;
  font-size: 28rpx;
}
.hero {
  aspect-ratio: 2.55/1;
  /* IKDEUR 五修（真凶落网）：实测 banner 渲染宽 = 视口 − 仅左 padding
     （右 padding 不参与 swiper 宽度计算，右侧贴边 25px）——工具端老内核
     对 swiper 组件 width:100% 的计算怪癖。视口锚定显式宽绕开百分比链，
     左右各 28rpx 数学必然对称 */
  width: calc(100vw - 56rpx);
  max-width: calc(100vw - 56rpx);
  border-radius: 28rpx;
  overflow: hidden;
  margin-top: 24rpx;
  background: $primary-soft;
  box-shadow: 0 12rpx 32rpx rgba(21, 117, 54, 0.1);
}
.hero__slide {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 44rpx 40rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}
/* 真图 Banner：背景图铺满 + 底部深色渐变遮罩，文字置顶保证可读。
 * IKDEUK 二修：image 是微信原生组件（有内在尺寸），inset 定界对它不
 * 生效——上轮删掉显式宽高后图回落默认尺寸直接摆烂。稳妥写法 =
 * left/top 锚定 + 显式 width/height:100%（image 必须显式宽高），不写
 * right/bottom 避免过约束；swiper-item 已 overflow:hidden 兜底裁切 */
.hero__bg {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}
.hero__mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(7, 40, 20, 0.05) 0%,
    rgba(7, 40, 20, 0.35) 55%,
    rgba(7, 40, 20, 0.72) 100%
  );
}
.hero__slide > text {
  position: relative;
  z-index: 1;
}
/* 可点击 Banner（IK9SNN）：轻按压反馈 */
.hero__slide--link:active {
  opacity: 0.92;
}
.hero__slide--green {
  background: linear-gradient(120deg, #07883b 0%, #25b95a 60%, #41ce69 100%);
}
.hero__slide--orange {
  background: linear-gradient(120deg, #e25c05 0%, #ff7a21 60%, #ffa24d 100%);
}
.hero__slide--dark {
  background: linear-gradient(120deg, #1e2520 0%, #2f4436 60%, #159447 100%);
}
/* 空 Banner 占位（IK9RX2）：与轮播同高圆角，承载单帧品牌文案；
   IKDEUR 五修：宽度同 .hero 视口锚定 */
.hero--empty {
  aspect-ratio: 2.55/1;
  width: calc(100vw - 56rpx);
  max-width: calc(100vw - 56rpx);
  border-radius: 28rpx;
  overflow: hidden;
  margin-top: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(21, 117, 54, 0.1);
}
.hero__tag {
  align-self: flex-start;
  font-size: 20rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(255, 255, 255, 0.55);
  border-radius: 999rpx;
  padding: 6rpx 20rpx;
}
.hero__title {
  margin-top: 20rpx;
  font-size: 44rpx;
  font-weight: 900;
  color: #fff;
  letter-spacing: 2rpx;
}
.hero__sub {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}
/* 分类横滑条（2026-08-22）：单行 scroll-x，项不压缩；右缘白色渐隐提示可滑 */
/* IKAHBA 方案A：整条放大一档（图标 88→112 / 文字 20→24 加粗 / 项宽 112→136 /
   间距 24→28），触控目标≥44px、间距≥8px；横滑与渐隐逻辑不动 */
.categories {
  position: relative;
  margin-top: 22rpx;
  padding: 28rpx 0;
  overflow: hidden;
}
.categories__scroll {
  width: 100%;
  white-space: nowrap;
}
/* H5 端隐藏滚动条（微信端靠 enhanced show-scrollbar） */
.categories__scroll ::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.categories__row {
  display: inline-flex;
  gap: 28rpx;
  /* IKBW0J：右侧不留 padding——末位分类被卡片边缘硬切「只露一半」，暗示可滑动 */
  padding: 0 0 0 28rpx;
}
.category {
  flex-shrink: 0;
  width: 136rpx;
  text-align: center;
  font-size: 24rpx;
  color: $ink;
  font-weight: 700;
}
.category__name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* IKBW0J：原右缘 48rpx 白色渐隐已移除——渐隐会把「露一半」的末位图标罩白，
   改由 overflow:hidden 硬裁切出半个图标（更明确的可滑动暗示） */
.category__image {
  width: 112rpx;
  height: 112rpx;
  margin: 0 auto 12rpx;
  border-radius: 50%;
  background: $primary-soft;
  overflow: hidden;
  transition: transform 0.12s ease;
}
/* IKAHBA：按压反馈，图标缩到 0.92 不移位 */
.category:active .category__image {
  transform: scale(0.92);
}
.category:nth-child(2n) .category__image {
  background: $cream;
}
.category__image image {
  width: 100%;
  height: 100%;
}
/* 加载占位（2026-08-24）：圆图+名条与真条同宽高，shimmer 与全端同款 */
.category--skeleton .category__image {
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: categories-pulse 1.2s infinite;
}
.category--skeleton .category__name {
  height: 24rpx;
  margin: 12rpx auto 0;
  border-radius: 12rpx;
  overflow: hidden;
  color: transparent;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: categories-pulse 1.2s infinite;
}
@keyframes categories-pulse {
  50% {
    opacity: 0.55;
  }
}
/* IKCNRB：右缘滑动指示——白色渐隐 + 浮动「›」圆钮（纯视觉，不拦截手势）；
   滑到最右整体淡出；首次进入另有 scroll-left 引导动画（见脚本） */
.categories__hint {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 88rpx;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  transition: opacity 0.2s ease;
}
.categories__hint::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), #fff 78%);
}
.categories__hint-arrow {
  position: relative;
  width: 40rpx;
  height: 40rpx;
  margin-right: 12rpx;
  border-radius: 50%;
  background: #fff;
  border: 2rpx solid rgba(21, 117, 54, 0.16);
  box-shadow: 0 4rpx 12rpx rgba(21, 117, 54, 0.14);
  font-size: 26rpx;
  font-weight: 900;
  color: $primary;
  line-height: 36rpx;
  text-align: center;
  animation: hint-nudge 1.6s ease-in-out infinite;
}
@keyframes hint-nudge {
  50% {
    transform: translateX(5rpx);
  }
}
@media (prefers-reduced-motion: reduce) {
  .categories__hint-arrow {
    animation: none;
  }
}
.categories__hint--end {
  opacity: 0;
}
/* ---------- 促销模块卡（IKAHFG/ADR-0006）：形态对齐分类横滑条 ---------- */
.promo {
  position: relative;
  margin-top: 22rpx;
  overflow: hidden;
}
.promo::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 48rpx;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), #fff);
  pointer-events: none;
}
.promo__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 28rpx 8rpx;
}
.promo__title {
  font-size: 30rpx;
  font-weight: 900;
}
/* 秒杀标题红色强调（截图促销调，与价格色呼应） */
.promo__title--hot {
  color: #ff4d18;
}
/* 倒计时/「超值购 ›」均已随 IKCN5W 终稿移除（道哥 0902） */
.promo__scroll {
  width: 100%;
  white-space: nowrap;
}
.promo__scroll ::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.promo__row {
  display: inline-flex;
  gap: 20rpx;
  padding: 16rpx 28rpx 24rpx;
}
.promo__item {
  flex-shrink: 0;
  width: 176rpx;
}
/* IKCN5W 0902 定稿：3 列风格（干净图+价无卡底）+ 一行 4 个——图缩小到
   132rpx、margin 20rpx（flex 等分，不用 grid gap：部分微信内核不认） */
.promo__grid {
  display: flex;
  padding: 24rpx 28rpx 28rpx;
}
.promo__item--grid {
  flex: 1;
  width: auto;
  min-width: 0;
  margin-left: 30rpx;
  animation: seckill-rise 0.32s ease both;
  transition: opacity 0.15s ease;
}
.promo__item--grid:first-child {
  margin-left: 0;
}
.promo__item--grid:active {
  opacity: 0.88;
}
@keyframes seckill-rise {
  from {
    transform: translateY(48rpx);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .promo__item--grid {
    animation: none;
  }
}
.promo__image--grid {
  display: block;
  width: 100%;
  /* 126rpx：道哥手调 100 偏小（aspectFit 扁框两侧灰边吃图）与不挤的平衡点 */
  height: 126rpx;
  border-radius: 12rpx;
  background: #f7f8f7;
}
.promo__bottom--grid {
  display: block;
  margin-top: 8rpx;
}
.promo__bottom--grid .price {
  display: block;
  font-size: 26rpx;
  font-weight: 900;
}
.promo__bottom--grid .price__symbol {
  font-size: 16rpx;
}
.promo__bottom--grid .promo__strike {
  display: block;
  margin-top: 2rpx;
  font-size: 16rpx;
}
/* 右上角「换一组」icon 已随 IKCN5W 移除（自动轮换 + 上滑过渡承担“换”的感知） */
.promo__image {
  width: 130rpx;
  height: 130rpx;
  border-radius: 20rpx;
  background: $primary-soft;
  display: block;
}
.promo__name {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  margin-top: 10rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.promo__bottom {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-top: 4rpx;
}
.promo__bottom .price {
  color: #ff4d18;
}
.promo__strike {
  text-decoration: line-through;
  color: $muted;
  font-size: 20rpx;
}
.grid-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 390rpx;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
}
.skeleton {
  height: 390rpx;
  border-radius: 26rpx;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: pulse 1.2s infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.55;
  }
}
/* ---------- 首页双版块（IKD6FA）：左天天抽奖 + 右楼栋福利群 ---------- */
.homeblocks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-top: 20rpx;
}
.homeblocks__card {
  position: relative;
  /* 加高（道哥 25.png 反馈）：164→200rpx */
  min-height: 200rpx;
  border-radius: 28rpx;
  padding: 24rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  overflow: hidden;
  border: 2rpx solid rgba(21, 148, 71, 0.06);
}
/* 卡片背景图 v3（COS static.buchuqin.com）：v1 源图自带白边 → v2 裁边后右缘仍带
   一圈柔光渐变（贴边像描边）→ v3 在包围盒基础上四边再内缩 24px 切进纯填充区；
   图自带右侧装饰，right center/cover 保住装饰区，文字压左侧留白区，同色兜底 */
.homeblocks__card--wheel {
  background:
    url("https://static.buchuqin.com/app/public/home-card-wheel-v4.webp") right
      center / cover no-repeat,
    #e2f7e4;
  border-color: rgba(37, 185, 90, 0.28);
  box-shadow: 0 8rpx 24rpx rgba(7, 136, 59, 0.08);
}
.homeblocks__card--wheel .homeblocks__title,
.homeblocks__card--wheel .homeblocks__cta {
  color: $primary-dark;
}
.homeblocks__card--wheel .homeblocks__sub {
  color: #2f8a52;
}
.homeblocks__card--group {
  background:
    url("https://static.buchuqin.com/app/public/home-card-group-v4.webp") right
      center / cover no-repeat,
    #fff1e2;
  border-color: rgba(255, 122, 33, 0.24);
  box-shadow: 0 8rpx 24rpx rgba(217, 95, 16, 0.08);
}
.homeblocks__card--group .homeblocks__title,
.homeblocks__card--group .homeblocks__cta {
  color: #c2570f;
}
.homeblocks__card--group .homeblocks__sub {
  color: #b96f33;
}
.homeblocks__title {
  font-size: 30rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}
.homeblocks__sub {
  font-size: 20rpx;
  margin-top: 6rpx;
}
.homeblocks__cta {
  font-size: 18rpx;
  font-weight: 800;
  margin-top: 12rpx;
}
/* 右上红点：群卡暗示新福利 */
.homeblocks__dot {
  position: absolute;
  top: 18rpx;
  right: 22rpx;
  width: 16rpx;
  height: 16rpx;
  background: #ff4d2e;
  border-radius: 50%;
  border: 3rpx solid #fdf8ef;
}
/* 按压反馈：轻缩放不位移 */
.homeblocks__card:active {
  transform: scale(0.97);
  opacity: 0.92;
}
/* ---------- 2026-09-05 首页骨架屏：banner/双卡与真模块同构占位，
   shimmer 与购物车/分类条/网格全端同款（pulse 复用 .skeleton 的 keyframes） */
.hero--skeleton {
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: pulse 1.2s infinite;
  box-shadow: none;
}
.homeblocks__card--skeleton {
  border: none;
  box-shadow: none;
  background: linear-gradient(90deg, #edf2ed, #fff, #edf2ed);
  animation: pulse 1.2s infinite;
}
/* ---------- 进群弹窗（IKD6FA 复用 IKAJSZ 同款交互） ---------- */
.group-mask {
  position: fixed;
  inset: 0;
  background: rgba(10, 30, 18, 0.55);
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
}
.group-pop {
  width: 560rpx;
  background: #fff;
  border-radius: 28rpx;
  padding: 40rpx 36rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.group-pop__title {
  font-size: 32rpx;
  font-weight: 900;
  color: $primary-dark;
}
.group-pop__qr {
  width: 440rpx;
  margin: 28rpx 0 8rpx;
  border-radius: 12rpx;
}
.group-pop__tip {
  font-size: 24rpx;
  color: $muted;
  margin-bottom: 26rpx;
}
.group-pop__close {
  width: 100%;
  min-height: 84rpx;
  background: $primary-soft;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: $primary-dark;
}
/* IKDERY：未配置态——CSS 对话气泡占位 + 双按钮（次级知道了/主级先去逛逛） */
.group-pop__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.group-pop__bubble {
  width: 160rpx;
  height: 120rpx;
  margin: 30rpx 0 26rpx;
  background: linear-gradient(135deg, #ff9a5c, #ff7a21);
  border-radius: 36rpx 36rpx 36rpx 8rpx;
  box-shadow: 0 10rpx 24rpx rgba(217, 95, 16, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}
.group-pop__bubble-dots {
  display: flex;
  gap: 14rpx;
}
.group-pop__bubble-dots view {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #fff;
  opacity: 0.92;
}
.group-pop__empty-title {
  font-size: 34rpx;
  font-weight: 900;
  color: #c2570f;
  margin-bottom: 10rpx;
}
.group-pop__btns {
  display: flex;
  gap: 20rpx;
  margin-top: 34rpx;
}
.group-pop__btns .group-pop__close {
  flex: 1;
  min-width: 0;
}
.group-pop__primary {
  flex: 1;
  min-height: 84rpx;
  background: linear-gradient(120deg, #ff7a21, #e25c05);
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #fff;
}
.group-pop__primary::after {
  border: none;
}
.group-pop__close::after {
  border: none;
}
/* ---------- IKDB7W：天天抽奖弹层（压过 group-mask z-30，结果弹窗在组件内 z-100） ---------- */
.wheel-sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(8, 30, 18, 0.6);
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wheel-sheet {
  position: relative;
  width: 620rpx;
  animation: wheel-sheet-in 0.26s cubic-bezier(0.34, 1.3, 0.64, 1);
}
@keyframes wheel-sheet-in {
  from {
    transform: scale(0.88);
    opacity: 0;
  }
}
.wheel-sheet__close {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: rgba(150, 20, 8, 0.55);
  border: 3rpx solid #f2cf6e;
  color: #ffedbe;
  font-size: 26rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}
/* IKDDHF：节庆红底背景图 v2（COS：static.buchuqin.com/app/public/wheel-bg-festive-v2.webp，
   图自带「天天抽奖」金色立体标题 + 「不出寝食社·每日抽奖领福利」金胶囊副标题），
   底部朱红淡入防截断感；高度上限 80vh（IKDDHF 二轮：弹层过高被屏幕底边遮挡） */
.wheel-sheet__inner {
  max-height: 80vh;
  overflow-y: auto;
  /* 灯串灯泡沿转盘环外圈分布，弹层边缘会透出 1-2px 横向溢出 → 横向裁掉 */
  overflow-x: hidden;
  border-radius: 32rpx;
  background:
    linear-gradient(
      180deg,
      rgba(230, 58, 23, 0) 0%,
      rgba(230, 58, 23, 0) 82%,
      rgba(230, 58, 23, 0.85) 100%
    ),
    url("https://static.buchuqin.com/app/public/wheel-bg-festive-v2.webp") center
      top / 100% auto no-repeat,
    #e63a17;
  padding-bottom: 28rpx;
}
/* 弹层头（IKDDHF 四轮）：v2 背景图自带标题+副标题胶囊，页头纯留白避让。
   背景 100% auto 宽度锁定（cover 在 tall 屏按高度放大会把胶囊压低导致指针叠压），
   图 750×1333 在 620rpx 宽弹层内恒显示 1102rpx 高，图中胶囊下沿恒在 24.8% ≈ 273rpx；
   留白 326rpx → 转盘整体下移，指针与图中胶囊留约 39rpx 间距 */
.wheel-sheet__head {
  padding-top: 326rpx;
}
.wheel-sheet__panel {
  padding: 0 24rpx;
}
</style>
