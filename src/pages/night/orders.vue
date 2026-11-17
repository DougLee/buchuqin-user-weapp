<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
// 兼容旧夜宵订单链接，统一进入用户“我的订单”，默认展示两个渠道。
onLoad(() => uni.redirectTo({ url: '/pages/orders/index' }));
</script>
<template><view class="page">正在打开我的订单…</view></template>
