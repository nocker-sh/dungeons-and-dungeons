import { randomUUID } from "node:crypto"
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import { dirname } from "node:path"
import { readEnvelope } from "./read-envelope"

export const DEV_SAVE_PATH = process.env.DND_SAVE ?? "/tmp/dnd/save.json"

export function devSaveHandler(path = DEV_SAVE_PATH) {
  return (request: IncomingMessage, response: ServerResponse) => {
    const fail = (status: number) => {
      response.statusCode = status
      response.end()
    }
    if (request.method === "GET") {
      try {
        const saved = readEnvelope(path)
        const hasSave = Object.hasOwn(saved, "save")
        response.statusCode = hasSave ? 200 : 204
        response.setHeader("content-type", "application/json")
        response.end(hasSave ? JSON.stringify(saved.save) : "")
      } catch {
        fail(500)
      }
      return
    }
    if (request.method === "PUT" || request.method === "DELETE") {
      const chunks: Buffer[] = []
      request.on("data", (chunk: Buffer) => chunks.push(chunk))
      request.on("error", () => fail(400))
      request.on("end", () => {
        let save: unknown
        if (request.method === "PUT") {
          try {
            save = JSON.parse(Buffer.concat(chunks).toString("utf8"))
          } catch {
            fail(400)
            return
          }
        }
        try {
          let before: Record<string, unknown>
          try {
            before = readEnvelope(path)
          } catch (error) {
            // 壊れたファイルを捨てられるのは、明示的に削除したときだけ。
            if (request.method !== "DELETE" || !(error instanceof SyntaxError))
              throw error
            before = {}
          }
          const next = { ...before, save }
          mkdirSync(dirname(path), { recursive: true })
          // 書き込み失敗で元の保存を切り詰めない。同じ場所へ書き終えてから置き換える。
          const temporary = `${path}.${randomUUID()}.tmp`
          try {
            writeFileSync(temporary, JSON.stringify(next), { flag: "wx" })
            renameSync(temporary, path)
          } finally {
            rmSync(temporary, { force: true })
          }
          response.statusCode = 204
          response.end()
        } catch {
          fail(500)
        }
      })
      return
    }
    fail(405)
  }
}
