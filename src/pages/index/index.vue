<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../api'
import ProductCard from '../../components/ProductCard.vue'
import { useCartStore } from '../../stores/cart'
import { useSessionStore } from '../../stores/session'
import type { Category, Product } from '../../types'

const categoryImages=['/static/products/chips.svg','/static/products/soda.svg','/static/products/noodle.svg','/static/products/tissue.svg','/static/products/grape.svg','/static/products/biscuit.svg']
const cart=useCartStore(),campus=ref('湖北工业大学'),categories=ref<Category[]>([]),products=ref<Product[]>([]),loading=ref(true)
onShow(async()=>{await useSessionStore().ensureLogin();const home=await api.home();campus.value=home.campus.name;categories.value=home.categories;products.value=home.hotProducts;await cart.load();loading.value=false})
const add=(p:Product)=>cart.set(p,cart.quantity(p.id)+1)
const open=(id:string)=>uni.navigateTo({url:`/pages/product/detail?id=${id}`})
const goCategory=()=>uni.switchTab({url:'/pages/category/index'})
</script>

<template><view class="page home">
  <view class="brand-row"><text class="brand">不出寝食社</text><view class="brand-dot"/></view>
  <view class="location" @tap="uni.navigateTo({url:'/pages/address/index'})"><text class="pin">●</text><text>配送至：{{campus}} · 西区 5 栋 612</text><text class="down">⌄</text></view>
  <view class="search" @tap="goCategory"><text class="search__glass">⌕</text><text class="search__hint">搜索商品：请输入商品名称</text><text class="search__button">搜索</text></view>
  <view class="hero"><image src="/static/home-hero-v2.webp" mode="aspectFill"/><view class="hero__copy"><text class="hero__title">不出寝｜食社</text><text class="hero__sub">校园零食日用 · 送到寝室</text><text class="hero__note">今天不出寝，想吃的照样有</text></view></view>
  <view class="delivery"><view class="delivery__item delivery__item--green"><view><text class="delivery__title">立即配送</text><text class="delivery__sub">最快 30 分钟送达</text></view><text class="delivery__mark">›</text></view><view class="delivery__item delivery__item--orange"><view><text class="delivery__title">2 小时送到</text><text class="delivery__sub">超时赔付 · 安心等</text></view><text class="delivery__mark">›</text></view></view>
  <view class="categories card"><view v-for="(item,index) in categories" :key="item.id" class="category" @tap="goCategory"><view class="category__image"><image :src="categoryImages[index%categoryImages.length]" mode="aspectFit"/></view><text>{{item.name==='全部'?'零食饮料':item.name}}</text></view></view>
  <view class="section-title"><text class="section-title__main">为你推荐</text><text class="section-title__sub" @tap="goCategory">换一批 ↻</text></view>
  <view v-if="loading" class="grid"><view v-for="n in 4" :key="n" class="skeleton"/></view><view v-else class="grid"><ProductCard v-for="p in products" :key="p.id" :product="p" :quantity="cart.quantity(p.id)" @add="add" @open="open"/></view>
</view></template>

<style scoped lang="scss">
@import '../../styles/theme.scss';
.home{padding-top:calc(30rpx + env(safe-area-inset-top))}.brand-row{display:flex;align-items:center;gap:12rpx}.brand{font-size:40rpx;font-weight:900;color:$primary-dark;letter-spacing:1rpx}.brand-dot{width:10rpx;height:10rpx;border-radius:50%;background:$primary}.location{min-height:82rpx;display:flex;align-items:center;gap:12rpx;font-weight:700}.pin{color:$primary;font-size:30rpx}.down{color:$primary-dark}.search{height:84rpx;background:#fff;border:3rpx solid $primary;border-radius:44rpx;display:flex;align-items:center;padding-left:24rpx;overflow:hidden}.search__glass{font-size:40rpx;color:$muted}.search__hint{flex:1;color:#a3aaa5;margin-left:12rpx;font-size:25rpx}.search__button{align-self:stretch;min-width:126rpx;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#41ce69,$primary);color:#fff;font-weight:800;font-size:28rpx}.hero{height:315rpx;border-radius:28rpx;overflow:hidden;position:relative;margin-top:24rpx;background:$primary-soft}.hero image{width:100%;height:100%}.hero__copy{position:absolute;left:32rpx;top:46rpx;width:48%}.hero__copy text{display:block}.hero__title{color:$primary-dark;font-size:42rpx;font-weight:900;letter-spacing:-2rpx}.hero__sub{font-size:24rpx;font-weight:800;margin-top:16rpx}.hero__note{font-size:23rpx;margin-top:44rpx;font-weight:700;line-height:1.5}.delivery{display:grid;grid-template-columns:1fr 1fr;gap:16rpx;margin-top:20rpx}.delivery__item{min-height:116rpx;border-radius:24rpx;padding:22rpx 24rpx;display:flex;align-items:center;justify-content:space-between}.delivery__item--green{background:linear-gradient(135deg,#edfae9,#f8fff5);color:$primary-dark}.delivery__item--orange{background:linear-gradient(135deg,#fff4e8,#fffaf3);color:$orange}.delivery__title,.delivery__sub{display:block}.delivery__title{font-size:30rpx;font-weight:900}.delivery__sub{font-size:21rpx;color:$muted;margin-top:8rpx}.delivery__mark{font-size:48rpx;font-weight:300}.categories{display:grid;grid-template-columns:repeat(6,1fr);gap:8rpx;margin-top:22rpx;padding:24rpx 10rpx}.category{text-align:center;font-size:20rpx;min-width:0}.category__image{width:88rpx;height:88rpx;margin:0 auto 10rpx;border-radius:50%;background:$primary-soft;overflow:hidden}.category:nth-child(2n) .category__image{background:$cream}.category__image image{width:100%;height:100%}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18rpx}.skeleton{height:390rpx;border-radius:26rpx;background:linear-gradient(90deg,#edf2ed,#fff,#edf2ed);animation:pulse 1.2s infinite}@keyframes pulse{50%{opacity:.55}}
</style>
