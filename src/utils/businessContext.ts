import { nightApi } from '../api/night';

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

/** Each loader owns a scope; identity changes and a newer load invalidate its ticket. */
export function createBusinessRequestScope() {
  let generation = 0;
  const identity = () => `${String(uni.getStorageSync('token') || '')}\u0000${String(uni.getStorageSync('nightCartOwner') || '')}`;
  return {
    begin() {
      const current = ++generation, owner = identity();
      return () => current === generation && owner === identity();
    },
    invalidate() { generation++; },
  };
}
