import { defineConfig } from "vite";
// 并行工作区的热更新会销毁正在验收的世界；独立验收端口关闭文件监听。
export default defineConfig({
  define: { "import.meta.env.VITE_DEV_GRANT_SWORD_WIND": JSON.stringify("0") },
  server: {
    host: "127.0.0.1",
    port: 5183,
    strictPort: true,
    hmr: false,
    watch: null,
  },
});
