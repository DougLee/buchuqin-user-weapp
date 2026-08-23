import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import CartOverlay from "./components/CartOverlay.vue";
import TabBar from "./components/TabBar.vue";
export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  // IK97FD：全局注册购物车悬浮窗。uni-app 的 App.vue 不渲染 template，
  // 因此各页面需写一行 <CartOverlay />（此处全局注册后无需再 import）；
  // 任意页面 uni.$emit('open-cart') 即可唤起。
  app.component("CartOverlay", CartOverlay);
  // IKAFP6 悬浮球已下线（IKAHBR）：购物车 Tab 角标取代其入口职能。
  // 自绘 tabBar（2026-08-19）：4 个 tab 页各挂 <TabBar :current="N" />，
  // 原生条在 App.vue onLaunch 即隐藏。
  app.component("TabBar", TabBar);
  return { app };
}
