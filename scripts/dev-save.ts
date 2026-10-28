import type { Plugin } from "vite"
import { devSaveHandler } from "./dev-save-handler"

export function devSave(): Plugin {
  return {
    name: "dnd-dev-save",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/save", devSaveHandler())
    },
  }
}
