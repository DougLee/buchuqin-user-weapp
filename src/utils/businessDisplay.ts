export function businessTime(value: string): string {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time + 8 * 3600_000).toISOString().slice(11, 16) : '';
}

/** API timestamps are UTC; store dates are displayed in China time. */
export function businessDate(value: string): string {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time + 8 * 3600_000).toISOString().slice(0, 10) : '';
}
export function afterSaleDescription(value: string): string {
  const labels: Record<string, string> = { quality: '质量问题', missing: '商品缺失', damaged: '包装破损', wrong: '错发商品', other: '其他' };
  return value.replace(/^(quality|missing|damaged|wrong|other)[：:]/, (_, type: string) => `${labels[type]}：`);
}
