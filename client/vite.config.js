import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const apiPort = Number(env.PORT ?? 3001);
  const apiTarget = `http://localhost:${apiPort}`;

  return {
    plugins: [react()],
    root: path.resolve(__dirname),
    build: {
      outDir: "dist",
      emptyOutDir: true
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": apiTarget,
        "/uploads": apiTarget,
        "/socket.io": {
          target: apiTarget,
          ws: true
        }
      }
    }
  };
});
