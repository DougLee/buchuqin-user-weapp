import { fetchAddresses } from '../api/addresses';
import { pickCurrentAddress } from './currentAddress';
import { useBusinessStore } from '../stores/business';
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

/**
 * IKU0KH 道哥拍板 B 档：渠道判定走业务渠道 store（60s TTL，过期等待刷新），
 * 切页命中缓存零等待零闪烁；无缓存（首次/换身份）实拉失败仍进保守错误态。
 * 资金前置校验（night/checkout 营业窗口）不走此缓存，保持每次实拉。
 */
export const resolveBusinessType = createBusinessResolver({
  identity: () => String(uni.getStorageSync('token') || ''),
  entry: () => useBusinessStore().ensureEntry(),
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
 * 「当前地址」同源）；storage 楼栋记忆仅供展示缓存；地址接口失败上抛，不能授权沿用旧楼栋。
 * 返回空串 = 当前校区无地址 / 地址缺楼栋（旧数据），调用方引导添加地址。
 */
export async function resolveNightBuildingId(pre?: Address[]): Promise<string> {
  let list: Address[] = pre ?? [];
  if (!pre) {
    list = await fetchAddresses();
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
