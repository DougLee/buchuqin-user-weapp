import type { Address } from "../types";

/**
 * 当前收货地址（道哥 2026-09-09）：地址列表页「选择」/ 地址编辑保存
 * 写入 storage 的 selectedAddressId 是全 App 单一事实源——首页、我的页、
 * 结算页统一按这里取，三级回退：显式选中 → 默认地址 → 第一条。
 * 修复此前首页/我的页只读 isDefault 导致「切换地址后展示不跟随」。
 */
export function pickCurrentAddress(list: Address[]): Address | null {
  if (!list.length) return null;
  const selected = uni.getStorageSync("selectedAddressId") as string;
  return (
    (selected && list.find((a) => a.id === selected)) ||
    list.find((a) => a.isDefault) ||
    list[0] ||
    null
  );
}
