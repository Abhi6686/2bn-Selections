import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL ?? "http://localhost:3001";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@2bn/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      },
    },
    server: {
      host: "0.0.0.0",
      proxy: {
        "/api": { target: apiUrl, changeOrigin: true },
        "/uploads": { target: apiUrl, changeOrigin: true },
      },
    },
  };
});
