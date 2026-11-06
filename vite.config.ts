import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
// @ts-ignore Vite dev-only Node middleware.
import { nightUserPreviewLoginPlugin } from "./scripts/night-preview-login.mjs";
// @ts-ignore Vite dev-only Node middleware.
import { nightPreviewPayPlugin } from "./scripts/night-preview-pay.mjs";

const apiTarget = process.env.VITE_API_PROXY_TARGET || "https://admin-test.buchuqin.com";
if (!["localhost", "127.0.0.1", "admin-test.buchuqin.com"].includes(new URL(apiTarget).hostname)) throw new Error("本地开发只允许本机或指定测试API，禁止生产连接");

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni(), nightUserPreviewLoginPlugin({ apiTarget }), nightPreviewPayPlugin({ apiTarget })],
  define: { 'import.meta.env.VITE_NIGHT_LOCAL_PREVIEW': JSON.stringify(["http://localhost:3150", "http://127.0.0.1:3150"].includes(apiTarget) ? "true" : "false") },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.VITE_DEV_PORT || 5174),
    strictPort: true,
    // H5 联调代理（仅 dev server 生效，小程序构建不涉及）：C 端 API 无 CORS
    // 头，H5 调试必须经 proxy 同源转发
    proxy: {
      "/api/v1": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
