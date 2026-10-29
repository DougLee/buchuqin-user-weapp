import { BASE_URL } from "../api/request";

/**
 * 用户行为埋点（IKRGLV MVP）：转化漏斗+商品热度。
 * 红线：fire-and-forget——入队即返回；攒批（10 条或 15s）一次性上报；
 * 任何失败静默丢弃、不重试、不 toast，绝不阻塞用户操作。
 * 事件白名单在 api 侧 DTO 校验（analytics.controller TRACK_EVENTS）。
 */
type TrackEvent = {
  event: string;
  targetId?: string;
  meta?: Record<string, unknown>;
};

const QUEUE_LIMIT = 10;
const FLUSH_INTERVAL = 15000;
let queue: TrackEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** 记一条行为事件（targetId：商品 id / 搜索词 / 页面名；无目标留空） */
export function track(
  event: string,
  targetId = "",
  meta?: Record<string, unknown>,
): void {
  // #ifdef MP-WEIXIN
  try {
    queue.push({ event, targetId, meta });
    if (queue.length >= QUEUE_LIMIT) {
      void flush();
    } else if (timer == null) {
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, FLUSH_INTERVAL);
    }
  } catch {
    /* 埋点永不影响主流程 */
  }
  // #endif
}

/** 立即上报积压事件（App onHide 时调用，防退后台丢批次） */
export function flushTrack(): void {
  if (queue.length) void flush();
}

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const batch = queue.splice(0, 50);
  if (!batch.length) return;
  try {
    const token = uni.getStorageSync("token") as string;
    // 未登录（静默登录完成前）不记——漏斗事件以 userId 归属为准
    if (!token) return;
    await new Promise<void>((resolve, reject) => {
      uni.request({
        url: `${BASE_URL}/analytics/events`,
        method: "POST",
        header: { Authorization: `Bearer ${token}` },
        data: { events: batch },
        success: (r) =>
          r.statusCode >= 200 && r.statusCode < 300
            ? resolve()
            : reject(new Error(`track ${r.statusCode}`)),
        fail: reject,
      });
    });
  } catch {
    /* 静默丢弃：网络失败/限流都不重试 */
  }
}
