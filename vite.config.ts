import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    // H5 联调代理（仅 dev server 生效，小程序构建不涉及）：C 端 API 无 CORS
    // 头，H5 调试必须经 proxy 同源转发
    proxy: {
      "/api/v1": {
        target: "https://admin-test.buchuqin.com",
        changeOrigin: true,
      },
    },
  },
});
