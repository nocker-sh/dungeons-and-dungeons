/// <reference types="node" />
/**
 * 開発サーバーだけの保存の口（/__dev/save）。
 * ブラウザを `?save=tmp` で開くと、保存を localStorage ではなくこのファイルに読み書きする。
 * `bun builder/cli.ts ai` も同じファイルを使うので、AI が CLI で進めた場面をそのままブラウザで見られる。
 * ファイルは builder の形（{ seed, rng, serial, save }）。ブラウザは save だけを読み書きし、乱数の状態は残す。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { Plugin } from "vite"

export const DEV_SAVE_PATH = process.env.DND_SAVE ?? "/tmp/dnd/save.json"

export function devSave(): Plugin {
  return {
    name: "dnd-dev-save",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/save", (request, response) => {
        if (request.method === "GET") {
          const saved = existsSync(DEV_SAVE_PATH)
            ? (JSON.parse(readFileSync(DEV_SAVE_PATH, "utf8")) as {
                save?: unknown
              })
            : null
          response.statusCode = saved?.save ? 200 : 204
          response.setHeader("content-type", "application/json")
          response.end(saved?.save ? JSON.stringify(saved.save) : "")
          return
        }
        if (request.method === "PUT" || request.method === "DELETE") {
          let body = ""
          request.on("data", (chunk: Buffer) => (body += chunk.toString()))
          request.on("end", () => {
            const before = existsSync(DEV_SAVE_PATH)
              ? (JSON.parse(readFileSync(DEV_SAVE_PATH, "utf8")) as Record<
                  string,
                  unknown
                >)
              : {}
            const next =
              request.method === "DELETE"
                ? { ...before, save: undefined }
                : { ...before, save: JSON.parse(body) as unknown }
            mkdirSync(dirname(DEV_SAVE_PATH), { recursive: true })
            writeFileSync(DEV_SAVE_PATH, JSON.stringify(next))
            response.statusCode = 204
            response.end()
          })
          return
        }
        response.statusCode = 405
        response.end()
      })
    },
  }
}
