import { fileURLToPath } from "node:url"
import { defineConfig, mergeConfig } from "vite-plus"
import sharedConfig from "../../vite.shared"

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url))

export default defineConfig(() =>
  mergeConfig(sharedConfig, {
    publicDir: fileURLToPath(new URL("../../public", import.meta.url)),
    // 開発画面のshadcnだけが使う依存。ゲームには入れない。
    optimizeDeps: { include: ["cn", "class-variance-authority"] },
    server: {
      host: "::1",
      allowedHosts: ["dev.dnd.localhost"],
      fs: { allow: [workspaceRoot] },
    },
    preview: {
      host: "::1",
      port: Number(process.env.PORT ?? 4173),
      strictPort: true,
      allowedHosts: ["dev.dnd.localhost"],
    },
  })
)
