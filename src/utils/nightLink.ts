/**
 * IKTZ7J 道哥 2026-11-09：地址定楼——夜宵分享落首页（businessType=night），
 * 接收者按自己当前地址自动定店；链接不再携带/确认楼栋（buildingId 参数
 * 弃用），链接也从不授予配送资格（服务端校区/本楼校验兜底不变）。
 */
export function nightStoreLink(input: { campusId?: string; buildingId?: string; catalogProductId?: string }) {
  const pairs = Object.entries({ campus: input.campusId }).filter((entry): entry is [string, string] => !!entry[1]);
  return `/pages/index/index${pairs.length ? '?' + pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&') + '&' : '?'}businessType=night`;
}
/** Timeline shares keep the current page; its onLoad ignores building params. */
export function nightTimelineQuery(input: Parameters<typeof nightStoreLink>[0]) {
  const query = nightStoreLink(input).split('?')[1];
  return query || 'businessType=night';
}
