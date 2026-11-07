<script setup lang="ts">
import type { BusinessType } from '../utils/businessContext';
defineProps<{ modelValue: BusinessType; disabled?: boolean }>();
defineEmits<{ change: [value: BusinessType] }>();
const modes: BusinessType[] = ['day', 'night'];
</script>
<template>
  <view class="business-tabs" role="group" aria-label="店铺类型">
    <button role="button" v-for="mode in modes" :key="mode" :disabled="disabled"
      :aria-label="mode === 'night' ? '夜宵店' : '白天店'" :aria-pressed="modelValue === mode" :class="{ active: modelValue === mode, night: mode === 'night' }"
      @tap="$emit('change', mode)">{{ mode === 'night' ? '夜宵店' : '白天店' }}</button>
  </view>
</template>
<style scoped>
.business-tabs { display: flex; padding: 4px; gap: 4px; margin-bottom: 20px; background: #e9eee9; border-radius: 18px; }
.business-tabs button { flex: 1; min-height: 44px; line-height: 44px; margin: 0; padding: 0 16px; border: 0; border-radius: 14px; font-size: 15px; color: #627266; background: transparent; }
.business-tabs button::after { border: 0; }
.business-tabs button.active { color: #24553b; background: #fff; box-shadow: 0 2px 8px #173d2010; font-weight: 600; }
.business-tabs button.active.night { color: #ffe3a0; background: #173f2e; }
</style>
