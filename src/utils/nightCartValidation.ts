import type { NightCartLine } from '../stores/nightCart';
import type { NightProduct } from '../types/night';
export function nightCartIssue(line: NightCartLine, product?: NightProduct, now = Date.now()): string {
  if (!product) return '商品已下架或停售';
  if (line.quantity > product.stock) return `库存不足，仅剩 ${product.stock} 件`;
  if (line.asSeckill) {
    if (!product.seckill || product.seckill.id !== line.promotionId || !line.promotionEndsAt || !(new Date(line.promotionEndsAt).getTime() > now) || !(new Date(product.seckill.endsAt).getTime() > now)) return '秒杀活动已失效，请重新选购';
    if (line.quantity > 1) return '每单秒杀限购1件';
  }
  return '';
}
