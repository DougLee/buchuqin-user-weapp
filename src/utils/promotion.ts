/** 限时特价共用文案/倒计时（ADR-0006 / IKAHFG） */
/** 模块标题：首页模块卡标题文案 */
export const PROMO_TITLE: Record<string, string> = {
  seckill: "限时秒杀",
  clearance: "临期特惠",
};
/** 角标短文案：商品卡/详情用 */
export const PROMO_TAG: Record<string, string> = {
  seckill: "秒杀",
  clearance: "临期",
};
/** 倒计时：剩余时间 → HH:MM:SS（超 24h 小时数直接堆叠，活动窗口通常小时级） */
export function countdownText(endsAt: string, now: number): string {
  const rest = new Date(endsAt).getTime() - now;
  if (rest <= 0) return "已结束";
  const h = Math.floor(rest / 3_600_000),
    m = Math.floor((rest % 3_600_000) / 60_000),
    s = Math.floor((rest % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
