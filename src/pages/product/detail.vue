<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { onShareAppMessage, onShareTimeline, onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import { isRetryable } from "../../api/request";
import PhoneGate from "../../components/PhoneGate.vue";
import { useCartStore } from "../../stores/cart";
import { useCampusStore } from "../../stores/campus";
import { useSessionStore } from "../../stores/session";
import { fenToYuan } from "../../utils/money";
import { countdownText, PROMO_TAG } from "../../utils/promotion";
import { SERVICE_PHONE } from "../../utils/service";
import type { Product } from "../../types";
const product = ref<Product>(),
  cart = useCartStore(),
  session = useSessionStore(),
  /** IKG1C 打烊停单：闭店态共享自 campus store（分享直达本页也会自刷新） */
  campusStore = useCampusStore(),
  productId = ref(""),
  loading = ref(true),
  error = ref(false);
/* 促销倒计时（IKAHFG/ADR-0006）：详情页秒级跳动，离开页面即清 */
const now = ref(Date.now());
const promoTicker = setInterval(() => (now.value = Date.now()), 1000);
onUnmounted(() => clearInterval(promoTicker));
onLoad(async (q) => {
  productId.value = String(q?.id || "");
  shareCampus.value = String(q?.campus || "");
  // IKGZSU 跨校区分享：新用户首登落分享校区（后端校验采用，老用户忽略）
  if (shareCampus.value) session.pendingCampus = shareCampus.value;
  await cart.load();
  // IKGZSU：老用户校区与分享校区不一致 → 二选一确认（2026-09-19 道哥定版：
  // 「当前商品尚未在您所选校区售卖，属于xx校区，是否切换？」）
  if (
    shareCampus.value &&
    session.user?.campusId &&
    shareCampus.value !== session.user.campusId
  ) {
    await offerSwitchCampus();
    return;
  }
  void campusStore.refresh(); // IKG1C：打烊态轻量刷新，不阻塞商品加载
  await load();
});
/** 商品分享（IKC7V6）：头图直传 + 价格标题钩子（「¥12.9 商品名 点击抢购>>」），
 *  落地本页带商品 id；price 为生效价（促销期即促销价，productView 单一事实）。
 *  商品未加载/缺头图时 imageUrl 缺省——微信自动截当前页兜底 */
onShareAppMessage(() => {
  const p = product.value;
  const c = session.user?.campusId;
  if (!p)
    return {
      title: "不出寝，零食送到寝室",
      path: c ? `/pages/index/index?campus=${c}` : "/pages/index/index",
    };
  return {
    title: `¥${fenToYuan(p.price)} ${p.name} 点击抢购>>`,
    // IKGZSU：带分享者校区——B 校区打开走同款/切换引导，新用户静默落本校区
    path: `/pages/product/detail?id=${p.id}${c ? `&campus=${c}` : ""}`,
    imageUrl: p.image || undefined,
  };
});
onShareTimeline(() => {
  const p = product.value;
  const c = session.user?.campusId;
  if (!p) return { title: "不出寝，零食送到寝室" };
  return {
    title: `¥${fenToYuan(p.price)} ${p.name} 点击抢购>>`,
    query: `id=${p.id}${c ? `&campus=${c}` : ""}`,
  };
});
/** IKGZSU 跨校区分享：外校区商品在本校区的落地处理 */
const shareCampus = ref("");
const crossBlock = ref(false);
const crossInfo = ref<Awaited<ReturnType<typeof api.localMatch>> | null>(null);
const crossFrom = computed(
  () => crossInfo.value?.sourceCampusName || "其他校区",
);
/** 弹窗商品信息行：源商品名（local-match 回传）；按钮文案用去引号校区名 */
const crossGoods = computed(
  () => crossInfo.value?.sourceName?.trim() || "该商品",
);
const crossShort = computed(() =>
  crossFrom.value.replace(/[「」]/g, "").slice(0, 8),
);
/** 二选一确认（道哥 2026-09-19 口径 + 品牌弹窗样式）：是否切换到分享校区 */
const showCrossDlg = ref(false);
const switching = ref(false);
async function offerSwitchCampus() {
  loading.value = false;
  // 取来源校区名（local-match 顺带回传；2026-09-19 道哥验收：找同款功能下线）
  try {
    crossInfo.value = await api.localMatch(productId.value);
  } catch {
    crossInfo.value = null;
  }
  showCrossDlg.value = true;
}
async function doSwitchCampus() {
  if (switching.value) return;
  switching.value = true;
  try {
    await session.switchCampus(shareCampus.value);
    showCrossDlg.value = false;
    uni.showToast({ title: "已切换校区", icon: "success" });
    await load();
    return;
  } catch {
    uni.showToast({ title: "切换失败，请稍后再试", icon: "none" });
  } finally {
    switching.value = false;
  }
}
function stayCross() {
  showCrossDlg.value = false;
  crossBlock.value = true; // 暂不 → 占位页
}
const goHome = () => uni.switchTab({ url: "/pages/index/index" });
const goCampusPick = () =>
  uni.navigateTo({ url: "/pages/campus/index" });
async function load() {
  if (!productId.value) {
    error.value = true;
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = false;
  try {
    product.value = await api.product(productId.value);
  } catch (e) {
    // ADR-0005(IKA00Q)：仅网络/服务故障进整页错误态，业务拒绝由 request 层 toast
    if (isRetryable(e)) error.value = true;
  } finally {
    loading.value = false;
  }
}
/** 库存行内引导（ADR-0005/IKA00Q）：售罄置灰禁买、低库存提示余量 */
const soldOut = computed(() => (product.value?.stock ?? 0) <= 0);
const stockHint = computed(() => {
  const rest = product.value?.stock ?? 0;
  return rest > 0 && rest <= 5 ? `仅剩 ${rest} 件` : "";
});
/** IKG8FF 秒杀限购：每人每活动 1 件——已抢购置灰禁买，未购提示限购规则 */
const seckilled = computed(
  () => product.value?.seckillLimit?.purchased ?? false,
);
/** IKGNMV 一单一秒杀：购物车里已有**其他**秒杀品时，本秒杀品禁买 */
const seckillLocked = computed(
  () =>
    !!product.value?.promotion?.type &&
    product.value.promotion.type === "seckill" &&
    !!cart.cart.seckillIdInCart &&
    cart.cart.seckillIdInCart !== product.value.id,
);
/** IKG1C 打烊停单：整店闭店时单品状态（售罄/限购）失去意义，闭店态优先展示 */
const closedNow = computed(() => campusStore.closedNow);
const add = async () => {
  if (!product.value) return;
  if (closedNow.value) {
    uni.showToast({ title: campusStore.closedToast, icon: "none" });
    return;
  }
  if (soldOut.value) {
    uni.showToast({ title: "已抢完，看看别的吧", icon: "none" });
    return;
  }
  if (seckilled.value) {
    uni.showToast({ title: "您已抢购过该商品，每人限购 1 件", icon: "none" });
    return;
  }
  if (seckillLocked.value) {
    // 2026-09-19 道哥：文案统一「秒杀商品只可选购一件」（按钮不再置灰，点击提示）
    uni.showToast({ title: "秒杀商品只可选购一件", icon: "none" });
    return;
  }
  // IKE3HT 加购收网（拍板A 不可跳过）：未绑手机号先授权，绑定成功补执行
  if (session.needsPhone) {
    pendingAdd = true;
    phoneGateOpen.value = true;
    return;
  }
  const ok = await cart.set(
    product.value,
    cart.quantity(product.value.id) + 1,
  );
  if (ok) uni.showToast({ title: "已放进购物车", icon: "success" });
};
/** 授权弹层开合 + 被拦加购的补执行标记（@bound 消费） */
const phoneGateOpen = ref(false);
let pendingAdd = false;
const onPhoneBound = () => {
  phoneGateOpen.value = false;
  if (!pendingAdd) return;
  pendingAdd = false;
  void add();
};
// 跨工位契约：购物车悬浮窗由工位 B 全局挂载，emit open-cart 唤起，不 import 组件
const openCart = () => uni.$emit("open-cart");
// H5 端无 contact 能力，直接拨客服电话（IK9AWJ）
const onService = () => uni.makePhoneCall({ phoneNumber: SERVICE_PHONE });
/** 详情多图（IK9SNR）：后台 images[] 优先，无则退单图；至少一张保证轮播结构 */
const gallery = computed(() => {
  const images = (product.value?.images ?? []).filter(Boolean);
  return images.length ? images : product.value?.image ? [product.value.image] : [];
});
</script>
<template>
  <!-- IKGZSU 跨校区占位页：暂不切换后的落地（三态链头） -->
  <view v-if="crossBlock" class="cross card"
    ><view class="cross__badge">校区</view
    ><text class="cross__title">当前商品尚未在您所选校区售卖</text
    ><text class="cross__sub">该商品属于「{{ crossFrom }}」</text
    ><button class="cross__btn" @tap="goHome">去逛本校区商品</button
    ><view class="cross__links"
      ><text @tap="goCampusPick">换个校区看看</text
      ></view
    ></view
  >
  <view v-else-if="error" class="detail-error card" @tap="load"
    ><text class="detail-error__title">商品加载失败</text
    ><text class="muted">网络异常或商品已下架，点击重试</text></view
  >
  <view v-else-if="loading || !product" class="detail"
    ><!-- 加载骨架（IK9AWK） -->
    <view class="visual detail-skeleton__visual" /><view class="content"
      ><view class="card detail-skeleton__block" /><view
        class="card detail-skeleton__block detail-skeleton__block--short"
      /></view
    ></view
  >
  <view v-else class="detail"
    ><view class="visual"
      ><!-- 详情多图（IK9SNR）：后台 images[] 轮播，多图时显示指示点 -->
      <swiper
        class="visual__swiper"
        :indicator-dots="gallery.length > 1"
        indicator-color="rgba(21, 75, 38, 0.25)"
        indicator-active-color="#159447"
        :circular="gallery.length > 1"
      >
        <swiper-item v-for="(img, i) in gallery" :key="i">
          <image :src="img" mode="aspectFit" :alt="product.name" />
        </swiper-item>
      </swiper>
      <text
        class="visual__tag"
        :class="{ 'visual__tag--promo': product.promotion }"
        >{{
          product.promotion ? PROMO_TAG[product.promotion.type] : product.tag
        }}</text
      ></view
    ><view class="content"
      ><view class="card info"
        ><text class="info__name">{{ product.name }}</text
        ><text class="info__sub">{{ product.subtitle }}</text
        ><view class="info__price"
          ><text class="price"
            ><text class="price__symbol">¥</text>{{ fenToYuan(product.price) }}</text
          ><text class="original">¥{{ fenToYuan(product.originalPrice) }}</text
          ><!-- 促销倒计时（IKAHFG/ADR-0006）：价格即促销价，划线为商品原价 --><text
            v-if="product.promotion"
            class="promo-count"
            >{{ PROMO_TAG[product.promotion.type] }} · 距结束
            {{ countdownText(product.promotion.endsAt, now) }}</text
          ><!-- 库存行内标注（ADR-0005/IKA00Q） --><text
            v-if="soldOut"
            class="stock-flag stock-flag--out"
            >已抢完</text
          ><text v-else-if="stockHint" class="stock-flag">{{ stockHint }}</text
          ><!-- IKG8FF 秒杀限购：生效秒杀活动商品常驻限购标注 --><text
            v-if="product.seckillLimit && !seckilled"
            class="stock-flag"
            >每人限购 1 件</text
          ></view
        ></view
      ><view class="card guarantee"
        ><view
          ><text class="guarantee__title">校园仓现货</text
          ><text class="muted">仓里常备，随点随有</text></view
        ><view
          ><text class="guarantee__title">最快 30 分钟</text
          ><text class="muted">楼长送到寝室</text></view
        ></view
      ><!-- 临期合规提示（IKAHFH/ADR-0006）：clearance 活动硬性展示项，常驻不可关 --><view
        v-if="product.promotion?.type === 'clearance'"
        class="card clearance"
        ><text class="clearance__title">临期特惠</text
        ><text class="clearance__text"
          >本商品临近保质期，请在保质期内尽快食用；介意慎拍，售出后不支持以此为由退换。</text
        ></view
      ><!-- 商品介绍（IKAHAU）：后台维护的纯文本，空不渲染，换行保留 -->
      <view v-if="product.description" class="card desc"
        ><text class="desc__title">商品介绍</text
        ><text class="desc__text">{{ product.description }}</text
        ></view
      ><!-- 假「商品演示」卡已摘除（IK9AWT）：占位图+生成文案冒充商品信息，仅保留真实流程说明（下方 story） -->
      <view class="story"
        ><text class="story__eyebrow">今晚的快乐很简单</text
        ><text class="story__title">不用换鞋，不用下楼。</text
        ><text class="muted"
          >下单后从你所在校区的校园仓出发，经配送员送到楼下，再由楼长送到你的寝室门口。</text
        ></view
      ></view
    ><view class="bottom safe-bottom"
      ><!-- 客服入口移至购物车左侧（IK9SNU）：小图标弱化，不抢「加入购物车」焦点 -->
      <!-- #ifdef MP-WEIXIN -->
      <button class="service-mini" open-type="contact" aria-label="客服">
        客服
      </button>
      <!-- 分享入口（IKC7V6）：open-type=share 唤起转发面板，走页面 onShareAppMessage -->
      <button class="service-mini" open-type="share" aria-label="分享">
        分享
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <button class="service-mini" @tap="onService" aria-label="客服">
        客服
      </button>
      <!-- #endif -->
      <button class="bag" @tap="uni.$emit('open-cart')">
        购物车 {{ cart.cart.totalQuantity || "" }}</button
      ><!-- 售罄置灰禁买（ADR-0005/IKA00Q）；IKG8FF 已抢购同样置灰；
           IKGNMV 购物车已有其他秒杀品同样置灰；
           IKG1C 闭店态优先展示（整店买不了，单品售罄/限购文案让位） --><button
        class="primary-btn"
        :disabled="soldOut || seckilled || closedNow"
        @tap="add"
      >
        {{
          closedNow
            ? campusStore.closedLabel
            : soldOut
              ? "已抢完"
              : seckilled
                ? "已抢购"
                : seckillLocked
                  ? "加入购物车"
                  : "加入购物车"
        }}
      </button></view
    ></view
  >
  <!-- IKGZSU 跨校区二选一品牌弹窗（行动弹窗规范：商品信息头 + 通栏主 CTA + 文字次按钮） -->
  <view v-if="showCrossDlg" class="tip-mask" @tap="stayCross"
    ><view class="tip-card" @tap.stop
      ><text class="tip-card__title">商品不在当前校区</text
      ><view class="tip-card__goods"
        ><text class="tip-card__goods-name">{{ crossGoods }}</text
        ><text class="tip-card__goods-from">来自「{{ crossFrom }}」</text
        ></view
      ><text class="tip-card__hint"
        >切换后购物车将清空，收货地址需重新选择</text
      ><button
        class="tip-card__cta"
        :disabled="switching"
        @tap="doSwitchCampus"
        >{{ switching ? "切换中…" : `切换到${crossShort}查看` }}</button
      ><view class="tip-card__alt" @tap="stayCross"
        >暂不，逛逛本校区</view
      ></view
    ></view
  >
  <!-- IKE3HT 加购收网：未绑手机号点「＋」弹授权（拍板A 不可跳过），绑定成功补执行 -->
  <PhoneGate v-if="phoneGateOpen && session.needsPhone" @bound="onPhoneBound" />
  <CartOverlay />
</template>
<style scoped lang="scss">
@import "../../styles/theme.scss";
.detail {
  min-height: 100vh;
  background: $paper;
  padding-bottom: 170rpx;
}
.visual {
  height: 600rpx;
  background: radial-gradient(
    circle at 50% 45%,
    #fff 0,
    $primary-soft 58%,
    #d9f4df 100%
  );
  position: relative;
}
.visual__swiper,
.visual__swiper swiper-item,
.visual image {
  width: 100%;
  height: 100%;
}
.visual__swiper {
  height: 100%;
}
.visual__tag {
  position: absolute;
  left: 32rpx;
  bottom: 30rpx;
  background: $primary;
  color: #fff;
  padding: 12rpx 22rpx;
  border-radius: 28rpx;
  font-weight: 800;
}
.content {
  padding: 0 28rpx;
  margin-top: -24rpx;
  position: relative;
}
.info {
  padding: 32rpx;
}
.info__name {
  display: block;
  font-size: 44rpx;
  font-weight: 900;
}
.info__sub {
  display: block;
  color: #667069;
  margin-top: 10rpx;
}
.info__price {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-top: 28rpx;
}
.info__price .price {
  font-size: 48rpx;
}
.original {
  text-decoration: line-through;
  color: #667069;
}
/* 促销倒计时（IKAHFG/ADR-0006）：橙字等宽数字，价格即促销价 */
.promo-count {
  align-self: center;
  padding: 4rpx 14rpx;
  border-radius: 18rpx;
  font-size: 20rpx;
  font-weight: 800;
  color: $orange;
  background: $cream;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.visual__tag--promo {
  background: $orange;
}
/* 库存行内标注（ADR-0005/IKA00Q）：低库存橙底浅 chip，售罄实底 */
.stock-flag {
  align-self: center;
  padding: 4rpx 14rpx;
  border-radius: 18rpx;
  font-size: 20rpx;
  font-weight: 800;
  color: $orange;
  background: $cream;
}
.stock-flag--out {
  color: #fff;
  background: $orange;
}
.primary-btn[disabled] {
  opacity: 0.55;
}
/* 底栏客服小按钮（IK9SNU）：弱化的次级入口，灰字细边，别抢主按钮视觉 */
.service-mini {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: $paper;
  color: #8a938d;
  border: 2rpx solid $line;
  font-size: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  flex-shrink: 0;
}
.guarantee {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 22rpx;
  padding: 26rpx;
  background: linear-gradient(135deg, #f3fff5, #fff);
}
/* 商品介绍（IKAHAU）：pre-line 保留后台录入的换行 */
/* 临期合规提示（IKAHFH）：暖黄底强调但不吓退，条目常驻 */
.clearance {
  margin-top: 22rpx;
  padding: 26rpx;
  background: linear-gradient(135deg, #fff8ec, #fff);
  border: 2rpx solid rgba(230, 162, 60, 0.35);
}
.clearance__title {
  display: block;
  font-size: 28rpx;
  font-weight: 900;
  color: #b1560f;
  margin-bottom: 12rpx;
}
.clearance__text {
  display: block;
  font-size: 25rpx;
  line-height: 1.8;
  color: $ink;
}
.desc {
  margin-top: 22rpx;
  padding: 26rpx;
}
.desc__title {
  display: block;
  font-size: 28rpx;
  font-weight: 900;
  margin-bottom: 12rpx;
}
.desc__text {
  display: block;
  font-size: 25rpx;
  line-height: 1.8;
  color: $ink;
  white-space: pre-line;
  word-break: break-all;
}
.guarantee > view + view {
  border-left: 2rpx solid $line;
  padding-left: 28rpx;
}
.guarantee__title {
  display: block;
  font-weight: 800;
  margin-bottom: 6rpx;
  color: $primary-dark;
}
.story {
  padding: 48rpx 10rpx;
}
.story__eyebrow {
  color: $primary-dark;
  font-weight: 800;
}
.story__title {
  display: block;
  font-size: 38rpx;
  font-weight: 900;
  margin: 14rpx 0;
  line-height: 1.4;
}
.bottom {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 18rpx 28rpx;
  display: flex;
  gap: 18rpx;
  box-shadow: 0 -10rpx 30rpx rgba(21, 75, 38, 0.09);
  z-index: 20;
}
.bottom button {
  margin: 0;
  min-height: 92rpx;
}
.bag {
  width: 220rpx;
  border-radius: 46rpx;
  background: $primary-soft;
  color: $primary-dark;
  border: 2rpx solid rgba(37, 185, 90, 0.18);
  font-weight: 800;
}
.bottom .primary-btn {
  flex: 1;
}
/* ---------- IKGZSU 跨校区二选一品牌弹窗（行动弹窗规范：信息头+通栏CTA+文字次按钮） ---------- */
.tip-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(18, 30, 24, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 72rpx;
}
.tip-card {
  width: 100%;
  max-width: 560rpx;
  background: $surface;
  border-radius: 32rpx;
  padding: 56rpx 44rpx 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.tip-card__title {
  font-size: 33rpx;
  font-weight: 800;
  color: $ink;
  text-align: center;
}
/* 商品信息头：浅绿底胶囊块——让弹窗有具体内容而非空壳图标 */
.tip-card__goods {
  margin-top: 26rpx;
  width: 100%;
  box-sizing: border-box;
  background: $primary-soft;
  border-radius: 20rpx;
  padding: 22rpx 28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.tip-card__goods-name {
  font-size: 28rpx;
  font-weight: 800;
  color: $primary-dark;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tip-card__goods-from {
  font-size: 24rpx;
  color: $muted;
}
.tip-card__hint {
  margin-top: 22rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: $muted;
  text-align: center;
}
.tip-card__cta {
  margin: 40rpx 0 0;
  width: 100%;
  min-height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  background: $primary;
  color: #fff;
  font-size: 30rpx;
  font-weight: 700;
  padding: 0;
}
.tip-card__cta[disabled] {
  opacity: 0.6;
  color: #fff;
}
.tip-card__alt {
  margin-top: 20rpx;
  padding: 8rpx 24rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: $muted;
}
/* ---------- IKGZSU 跨校区占位页 ---------- */
.cross {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 130rpx 48rpx 90rpx;
  text-align: center;
}
.cross__badge {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  background: $primary-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 64rpx;
  margin-bottom: 34rpx;
}
.cross__title {
  font-size: 32rpx;
  font-weight: 900;
  color: $ink;
}
.cross__sub {
  margin-top: 14rpx;
  font-size: 26rpx;
  color: $muted;
}
.cross__btn {
  margin: 44rpx 0 6rpx;
  background: $primary;
  color: #fff;
  border-radius: 44rpx;
  font-size: 29rpx;
  font-weight: 700;
  padding: 0 76rpx;
  line-height: 88rpx;
  min-height: 88rpx;
}
.cross__links {
  margin-top: 26rpx;
  display: flex;
  align-items: center;
  gap: 18rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: $primary-dark;
}
.cross__divider {
  color: $line;
}
.detail-error {
  margin: 28rpx;
  padding: 160rpx 30rpx;
  text-align: center;
}
.detail-error__title {
  display: block;
  font-weight: 900;
  color: $primary-dark;
  margin-bottom: 8rpx;
}
.detail-skeleton__visual {
  animation: detail-pulse 1.2s infinite;
}
.detail-skeleton__block {
  height: 260rpx;
  margin-top: 22rpx;
  animation: detail-pulse 1.2s infinite;
}
.detail-skeleton__block--short {
  height: 160rpx;
}
@keyframes detail-pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
