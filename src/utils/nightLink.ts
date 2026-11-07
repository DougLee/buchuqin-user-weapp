/** Shares enter the building confirmation page; a link never grants delivery eligibility. */
export function nightStoreLink(input: { campusId?: string; buildingId?: string; catalogProductId?: string }) {
  const pairs = Object.entries({ campus: input.campusId, buildingId: input.buildingId, catalogProductId: input.catalogProductId }).filter((entry): entry is [string, string] => !!entry[1]);
  return `/pages/night/buildings${pairs.length ? '?' + pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&') : ''}`;
}
/** Timeline shares keep the current page; its onLoad forwards this query to confirmation. */
export function nightTimelineQuery(input: Parameters<typeof nightStoreLink>[0]) {
  const query = nightStoreLink(input).split('?')[1];
  return `businessType=night${query ? '&' + query : ''}`;
}
