import { ref, onUnmounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
/** Expiry feedback keeps up while visible, without background tab timers. */
export function useVisibleNow() {
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | undefined;
  function stop() { if (timer !== undefined) { clearInterval(timer); timer = undefined; } }
  onShow(() => { now.value = Date.now(); stop(); timer = setInterval(() => { now.value = Date.now(); }, 1000); });
  onHide(stop); onUnmounted(stop);
  return now;
}
