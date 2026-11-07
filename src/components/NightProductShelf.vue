<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useNightCartStore } from '../stores/nightCart';
import { useSessionStore } from '../stores/session';
import { fenToYuan } from '../utils/money';
import type { NightProduct } from '../types/night';
import PhoneGate from './PhoneGate.vue';

const props = defineProps<{ products: NightProduct[]; storeId: string; buildingId: string; buildingName: string; open: boolean; initialCatalogProductId?: string }>();
const emit = defineEmits<{ (event: 'detail-change', catalogProductId: string): void }>();
const cart = useNightCartStore(), session = useSessionStore();
const query = ref(''), category = ref(''), detailId = ref(''), phoneGate = ref(false);
let pendingId = '', pendingSeckill = false, pendingPromotionId = '';
const categoryKey = (p: NightProduct) => p.categoryId || p.categoryName || 'uncategorized';
const categories = computed(() => [...new Map(props.products.map(p => [categoryKey(p), { id: categoryKey(p), name: p.categoryName || '其他好物' }])).values()]);
const detailMode = ref(false);
function pricedProduct(product: NightProduct, seckill: boolean): NightProduct | undefined {
  if (seckill && !product.seckill) return;
  return seckill ? { ...product, asSeckill: true, price: product.seckill!.price, originalPrice: product.price, promotion: { ...product.seckill!, type: 'seckill' } } : { ...product, asSeckill: false };
}
const visible = computed(() => props.products.filter(product => (!category.value || (category.value === 'featured' ? product.featured : category.value === 'seckill' ? product.seckill : categoryKey(product) === category.value)) && (!query.value.trim() || `${product.name} ${product.subtitle} ${product.barcode || ''}`.toLowerCase().includes(query.value.trim().toLowerCase()))).flatMap(product => { const priced = pricedProduct(product, category.value === 'seckill'); return priced ? [priced] : []; }));
const detail = computed(() => { const product = props.products.find(product => product.id === detailId.value); return product ? pricedProduct(product, detailMode.value) : undefined; });
const consumedLandingId = ref('');
watch(() => [props.initialCatalogProductId, props.products] as const, ([id, products]) => {
  if (!id || consumedLandingId.value === id) return;
  const product = products.find(product => product.catalogProductId === id);
  if (product) { consumedLandingId.value = id; detailId.value = product.id; detailMode.value = false; }
}, { immediate: true });
watch(detail, value => emit('detail-change', value?.catalogProductId || ''), { immediate: true });
function openDetail(product: NightProduct) { detailMode.value = !!product.asSeckill; detailId.value = product.id; }
const detailImages = computed(() => {
  const product = detail.value;
  const images = product && Array.isArray(product.images) ? product.images.filter((url): url is string => typeof url === 'string' && !!url) : [];
  return images.length ? images : product && product.image ? [product.image] : [];
});
function previewImage(current: string) { uni.previewImage({ current, urls: detailImages.value }); }
const qty = (p: NightProduct) => cart.quantityOf(props.storeId, p.id, !!p.asSeckill, p.asSeckill ? p.seckill?.id : undefined);
function change(p: NightProduct, delta: number) {
  if (delta > 0 && p.asSeckill && (!p.seckill || new Date(p.seckill.endsAt).getTime() <= Date.now())) { uni.showToast({ title: '秒杀活动已结束，请刷新店铺', icon: 'none' }); return; }
  if (delta > 0 && !props.open) { uni.showToast({ title: '店铺休息中，开门后再来选购', icon: 'none' }); return; }
  if (delta > 0 && (p.soldOut || qty(p) >= Math.min(p.stock, p.asSeckill ? 1 : 999, p.purchaseLimitMeta?.qty ?? 999))) { uni.showToast({ title: p.stock ? '已达到可购数量' : '这件商品暂时售罄', icon: 'none' }); return; }
  if (delta > 0 && session.needsPhone) { pendingId = p.id; pendingSeckill = !!p.asSeckill; pendingPromotionId = p.seckill?.id || ''; phoneGate.value = true; return; }
  const result = cart.setQuantity({ id: props.storeId, buildingId: props.buildingId, buildingName: props.buildingName }, p, qty(p) + delta);
  if (result === false) uni.showToast({ title: p.asSeckill && cart.linesOf(props.storeId).some(line => line.asSeckill && line.productId !== p.id) ? '每单仅支持一种秒杀商品' : '请先移除购物车中的该商品，再切换购买方式', icon: 'none' });
}
function bound() { phoneGate.value = false; const raw = props.products.find(p => p.id === pendingId); const p = raw && (!pendingSeckill || raw.seckill?.id === pendingPromotionId) ? pricedProduct(raw, pendingSeckill) : undefined; pendingId = ''; if (p) change(p, 1); }
function reset() { query.value = ''; category.value = ''; }
</script>

<template>
  <view class="shelf">
    <view class="shelf__search">
      <view class="shelf__search-icon" />
      <input v-model="query" class="shelf__input" placeholder="搜索零食、饮品或商品条码" confirm-type="search" :maxlength="60" />
      <button v-if="query" class="shelf__clear" aria-label="清空搜索" @tap="query = ''">×</button>
    </view>
    <scroll-view scroll-x class="shelf__categories" :show-scrollbar="false">
      <view class="shelf__chips">
        <button class="shelf__chip" :class="{ 'shelf__chip--active': !category }" @tap="category = ''">全部好物</button>
        <button v-if="products.some(product => product.seckill)" class="shelf__chip" :class="{ 'shelf__chip--active': category === 'seckill' }" @tap="category = 'seckill'">限时秒杀</button>
        <button v-if="products.some(product => product.featured)" class="shelf__chip" :class="{ 'shelf__chip--active': category === 'featured' }" @tap="category = 'featured'">精选推荐</button>
        <button v-for="c in categories" :key="c.id" class="shelf__chip" :class="{ 'shelf__chip--active': category === c.id }" @tap="category = c.id">{{ c.name }}</button>
      </view>
    </scroll-view>
    <view class="shelf__caption"><text>{{ query || category ? '筛选结果' : '今晚的好物' }}</text><text>{{ visible.length }} 款 · 本楼直送</text></view>
    <view v-if="!visible.length" class="shelf__empty">
      <text class="shelf__empty-title">{{ products.length ? '没有找到这件好物' : '货架正在准备中' }}</text>
      <text>{{ products.length ? '试试其他关键词或分类' : '楼长备货后，好吃的就来啦' }}</text>
      <button v-if="products.length" class="shelf__reset" @tap="reset">查看全部商品</button>
    </view>
    <view v-else class="shelf__grid">
      <view v-for="p in visible" :key="p.id" class="shelf__goods" :class="{ 'shelf__goods--sold': p.soldOut }" @tap="openDetail(p)">
        <view class="shelf__picture"><image v-if="p.image" :src="p.image" mode="aspectFit" /><text v-else class="shelf__fallback">夜宵好物</text><text v-if="p.soldOut" class="shelf__stock">暂时售罄</text><text v-else-if="p.promotion" class="shelf__stock">{{ p.asSeckill ? '限时秒杀' : '限时特惠' }}</text><text v-else-if="p.stock <= 5" class="shelf__stock">仅剩 {{ p.stock }} {{ p.retailUnit || '件' }}</text></view>
        <view class="shelf__copy"><text class="shelf__name">{{ p.name }}</text><text class="shelf__subtitle">{{ p.subtitle || p.categoryName || '今晚犒劳一下自己' }}</text>
          <view class="shelf__bottom"><text class="shelf__price"><text>¥</text>{{ fenToYuan(p.price) }}</text>
            <view class="shelf__stepper" @tap.stop>
              <button v-if="qty(p)" class="shelf__quantity" :aria-label="`减少${p.name}`" @tap="change(p, -1)">−</button><text v-if="qty(p)" class="shelf__number">{{ qty(p) }}</text>
              <button class="shelf__quantity shelf__quantity--add" :class="{ 'shelf__quantity--disabled': p.soldOut || !open }" :aria-label="`添加${p.name}`" @tap="change(p, 1)">＋</button>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view v-if="detail" class="shelf__mask" @tap="detailId = ''">
      <view class="shelf__detail" @tap.stop>
        <button class="shelf__close" aria-label="关闭商品详情" @tap="detailId = ''">×</button>
        <swiper v-if="detailImages.length" class="shelf__detail-img" :indicator-dots="detailImages.length > 1"><swiper-item v-for="url in detailImages" :key="url"><image class="shelf__gallery-image" :src="url" mode="aspectFit" @tap="previewImage(url)" /></swiper-item></swiper>
        <text class="shelf__detail-category">{{ detail.categoryName || '夜宵好物' }}</text><text class="shelf__detail-name">{{ detail.name }}</text>
        <text class="shelf__detail-sub">{{ detail.subtitle || '本楼楼长备货，直接送到寝室' }}</text>
        <text v-if="detail.description" class="shelf__description">{{ detail.description }}</text>
        <text v-if="detail.purchaseLimitMeta" class="shelf__description">{{ ({ once: '每人终身', weekly: '每人每周', monthly: '每人每月' } as Record<string, string>)[detail.purchaseLimitMeta.kind] || '每人' }}限购 {{ detail.purchaseLimitMeta.qty }} 件（含待支付订单）</text>
        <view class="shelf__detail-meta"><text>单位：{{ detail.retailUnit || '件' }}</text><text>可购库存：{{ detail.stock }}</text></view>
        <view class="shelf__detail-footer"><view><text class="shelf__price">¥{{ fenToYuan(detail.price) }}</text><text v-if="detail.originalPrice && detail.originalPrice > detail.price" class="shelf__original">¥{{ fenToYuan(detail.originalPrice) }}</text></view><view class="shelf__stepper"><button class="shelf__quantity" aria-label="减少数量" @tap="change(detail, -1)">−</button><text class="shelf__number">{{ qty(detail) }}</text><button class="shelf__quantity shelf__quantity--add" aria-label="增加数量" @tap="change(detail, 1)">＋</button></view></view>
        <text v-if="!open" class="shelf__closed">店铺休息中，可以先浏览，开门后下单</text>
      </view>
    </view>
    <PhoneGate v-if="phoneGate && session.needsPhone" @bound="bound" @close="phoneGate = false; pendingId = ''" />
  </view>
</template>

<style scoped lang="scss">
.shelf { margin-top: 28rpx; }
button::after { border: 0; }
.shelf__search { display: flex; align-items: center; gap: 18rpx; padding: 0 22rpx; min-height: 48px; border: 1px solid #e1e8df; background: #fff; border-radius: 24rpx; }
.shelf__search-icon { width: 24rpx; height: 24rpx; border: 2px solid #718176; border-radius: 50%; position: relative; flex: none; }
.shelf__search-icon::after { content: ''; position: absolute; width: 10rpx; height: 2px; background: #718176; transform: rotate(45deg); right: -8rpx; bottom: -4rpx; }
.shelf__input { min-width: 0; flex: 1; font-size: 26rpx; height: 48px; }
.shelf__clear, .shelf__close { width: 44px; height: 44px; margin: 0; padding: 0; border: 0; background: transparent; color: #587062; line-height: 44px; font-size: 44rpx; flex: none; }
.shelf__categories { width: 100%; margin: 16rpx 0; white-space: nowrap; }
.shelf__chips { display: inline-flex; gap: 12rpx; }
.shelf__chip { display: inline-flex; align-items: center; min-height: 44px; margin: 0; padding: 0 26rpx; border: 1px solid transparent; border-radius: 22rpx; background: #edf1e9; color: #56685b; font-size: 25rpx; line-height: 1.2; }
.shelf__chip--active { background: #193d2e; color: #ffe2a1; border-color: #33523e; }
.shelf__caption { display: flex; justify-content: space-between; gap: 12rpx; padding: 14rpx 2rpx 22rpx; color: #738176; font-size: 22rpx; }
.shelf__caption > text:first-child { font-weight: 800; color: #253e30; font-size: 28rpx; }
.shelf__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20rpx; }
.shelf__goods { border-radius: 28rpx; overflow: hidden; border: 1px solid #e5ebdf; background: #fff; box-shadow: 0 6rpx 20rpx rgba(30, 66, 42, .035); }
.shelf__picture { position: relative; height: 260rpx; display: flex; align-items: center; justify-content: center; padding: 24rpx; background: linear-gradient(140deg, #f7f8ee, #f1f4e9); box-sizing: border-box; }
.shelf__picture image { width: 100%; height: 100%; }
.shelf__stock { position: absolute; left: 14rpx; bottom: 14rpx; border-radius: 10rpx; background: rgba(255,255,255,.93); padding: 6rpx 12rpx; color: #7b6043; font-size: 20rpx; }
.shelf__fallback { color: #6f8066; font-size: 26rpx; }
.shelf__copy { padding: 20rpx 18rpx 12rpx; }
.shelf__name { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.45; min-height: 80rpx; color: #263b2e; font-weight: 750; font-size: 28rpx; }
.shelf__subtitle { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #758277; font-size: 22rpx; margin-top: 8rpx; }
.shelf__bottom { display: flex; justify-content: space-between; align-items: center; gap: 4rpx; flex-wrap: wrap; margin-top: 12rpx; }
.shelf__price { color: #173f2c; font-size: 34rpx; font-weight: 850; font-variant-numeric: tabular-nums; }
.shelf__price > text { font-size: 22rpx; margin-right: 3rpx; }
.shelf__stepper { display: flex; align-items: center; gap: 0; margin-left: auto; }
.shelf__quantity { width: 44px; height: 44px; padding: 0; margin: 0; border: 0; border-radius: 50%; background: transparent; color: #43624e; font-size: 34rpx; line-height: 44px; }
.shelf__quantity--add { background: radial-gradient(circle at center, #214c36 53%, transparent 55%); color: #ffe5a3; }
.shelf__quantity--disabled { background: radial-gradient(circle at center, #e3e9df 53%, transparent 55%); color: #71846f; }
.shelf__number { min-width: 26rpx; text-align: center; color: #2d4936; font-size: 26rpx; font-weight: 700; }
.shelf__goods--sold .shelf__picture image { opacity: .55; }
.shelf__empty { display: flex; flex-direction: column; align-items: center; gap: 16rpx; padding: 80rpx 20rpx; text-align: center; color: #768576; font-size: 25rpx; }
.shelf__empty-title { color: #39513e; font-size: 32rpx; font-weight: 800; }
.shelf__reset { min-height: 44px; padding: 0 32rpx; margin-top: 12rpx; display: flex; align-items: center; background: #e7eee0; color: #24482e; border-radius: 22rpx; font-size: 27rpx; }
/* Above the shared tab bar (990), below phone authorization (1100). */
.shelf__mask { position: fixed; inset: 0; z-index: 1000; background: rgba(10, 31, 20, .55); display: flex; align-items: flex-end; }
.shelf__detail { position: relative; width: 100%; max-height: 86vh; overflow-y: auto; background: #fbfcf7; box-sizing: border-box; padding: 36rpx 36rpx calc(36rpx + env(safe-area-inset-bottom)); border-radius: 40rpx 40rpx 0 0; }
.shelf__close { position: absolute; top: 12rpx; right: 12rpx; z-index: 1; }
.shelf__detail-img { display: block; width: 100%; height: 360rpx; margin: 18rpx 0 28rpx; }
.shelf__gallery-image { width: 100%; height: 100%; }
.shelf__description { display: block; margin-top: 24rpx; white-space: pre-wrap; line-height: 1.7; color: #4b6250; font-size: 27rpx; overflow-wrap: anywhere; }
.shelf__original { margin-left: 14rpx; color: #7d897c; font-size: 24rpx; text-decoration: line-through; }
.shelf__detail-category { display: block; color: #65815e; font-size: 23rpx; letter-spacing: 2rpx; }
.shelf__detail-name { display: block; color: #203e2a; font-size: 40rpx; font-weight: 800; margin: 12rpx 0; line-height: 1.4; }
.shelf__detail-sub { display: block; color: #6f806f; font-size: 27rpx; line-height: 1.6; }
.shelf__detail-meta { display: flex; justify-content: space-between; gap: 18rpx; margin-top: 30rpx; border-top: 1px solid #e0e7db; padding-top: 26rpx; font-size: 24rpx; color: #657863; }
.shelf__detail-footer { display: flex; align-items: center; margin-top: 24rpx; }
.shelf__closed { display: block; margin-top: 16rpx; font-size: 24rpx; color: #7d704c; }
</style>
