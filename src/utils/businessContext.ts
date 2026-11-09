import { nightApi } from '../api/night';
import { fetchAddresses } from '../api/addresses';
import { pickCurrentAddress } from './currentAddress';
import type { Address } from '../types';

export type BusinessType = 'day' | 'night';

/** Public channel resolver. A failed request never authorizes a different channel. */
export function createBusinessResolver(source: {
  identity: () => string;
  entry: () => Promise<{ inNightSession: boolean }>;
}) {
  return async (requested?: unknown): Promise<BusinessType> => {
    if (requested !== undefined && requested !== '') {
      if (requested !== 'day' && requested !== 'night') throw new Error('业务类型不正确，请重新进入');
      return requested;
    }
    const identity = source.identity();
    const entry = await source.entry();
    if (identity !== source.identity()) throw new Error('身份或校区已变化，请重试');
    return entry.inNightSession ? 'night' : 'day';
  };
}

export const resolveBusinessType = createBusinessResolver({
  identity: () => String(uni.getStorageSync('token') || ''),
  entry: () => nightApi.entry(),
});

export function businessUrl(path: string, type: BusinessType) {
  return `${path}${path.includes('?') ? '&' : '?'}businessType=${type}`;
}

function buildingKey() {
  const owner = String(uni.getStorageSync('nightCartOwner') || '');
  return owner ? `nightBuilding:${owner}` : '';
}
export function readNightBuilding(): string {
  const key = buildingKey();
  return key ? String(uni.getStorageSync(key) || '') : '';
}
export function rememberNightBuilding(id: string) {
  const key = buildingKey();
  if (key) uni.setStorageSync(key, id);
}
export function clearNightBuilding() {
  const key = buildingKey();
  if (key) uni.removeStorageSync(key);
}

/**
 * IKTZ7J 道哥 2026-11-09：地址定楼栋——不再有选楼页，当前收货地址的
 * buildingId 是夜宵店唯一事实源（选中 → isDefault → 第一条，与全 App
 * 「当前地址」同源）；storage 楼栋记忆降级为缓存，仅在地址接口失败时
 * 兜底（失败不授权换渠道，也不清缓存留待下次 onShow 重试）。
 * 返回空串 = 当前校区无地址 / 地址缺楼栋（旧数据），调用方引导添加地址。
 */
export async function resolveNightBuildingId(pre?: Address[]): Promise<string> {
  let list: Address[] = pre ?? [];
  if (!pre) {
    try {
      list = await fetchAddresses();
    } catch {
      return readNightBuilding();
    }
  }
  const current = pickCurrentAddress(list);
  const buildingId = current?.buildingId || '';
  if (buildingId) {
    if (buildingId !== readNightBuilding()) rememberNightBuilding(buildingId);
    return buildingId;
  }
  clearNightBuilding();
  return '';
}

/** Each loader owns a scope; identity changes and a newer load invalidate its ticket. */
export function createBusinessRequestScope() {
  let generation = 0;
  const identity = () => `${String(uni.getStorageSync('token') || '')}\u0000${String(uni.getStorageSync('nightCartOwner') || '')}`;
  return {
    begin() {
      const current = ++generation, owner = identity();
      return Object.assign(() => current === generation && owner === identity(), {
        // A refreshed token invalidates data, but must not leave the latest loader spinning.
        isLatest: () => current === generation,
      });
    },
    invalidate() { generation++; },
  };
}
