import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test"
import { devSaveHandler } from "@/scripts/dev-save-handler"

let directory: string
let path: string
let server: Server
let url: string

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "dnd-save-test-"))
  path = join(directory, "save.json")
  server = createServer(devSaveHandler(path))
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("サーバー未起動")
  url = `http://127.0.0.1:${address.port}/__dev/save`
})

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
    server.closeAllConnections()
  })
  rmSync(directory, { recursive: true, force: true })
})

describe("開発用保存 HTTP", () => {
  it("保存がないときだけ204を返す", async () => {
    expect((await fetch(url)).status).toBe(204)
    writeFileSync(path, JSON.stringify({ seed: 1 }))
    expect((await fetch(url)).status).toBe(204)
    writeFileSync(path, JSON.stringify({ seed: 1, save: null }))
    const response = await fetch(url)
    expect(response.status).toBe(200)
    expect(await response.json()).toBeNull()
  })

  it.each(["{broken", "null", "[]"])(
    "壊れた保存 %s を上書きせず、明示的な削除で復旧できる",
    async (raw) => {
      writeFileSync(path, raw)
      expect((await fetch(url)).status).toBe(500)
      expect((await fetch(url, { method: "PUT", body: "{}" })).status).toBe(500)
      expect(readFileSync(path, "utf8")).toBe(raw)
      expect((await fetch(url, { method: "DELETE" })).status).toBe(204)
      expect((await fetch(url)).status).toBe(204)
      expect(
        (await fetch(url, { method: "PUT", body: '{"name":"テスト"}' })).status
      ).toBe(204)
      expect(await (await fetch(url)).json()).toEqual({ name: "テスト" })
    }
  )

  it("不正なリクエストの後もサーバーと既存保存が保たれる", async () => {
    const original = JSON.stringify({
      seed: 7,
      rng: 8,
      serial: 9,
      save: { old: true },
    })
    writeFileSync(path, original)
    expect((await fetch(url, { method: "PUT", body: "{" })).status).toBe(400)
    expect(readFileSync(path, "utf8")).toBe(original)
    expect(await (await fetch(url)).json()).toEqual({ old: true })
    expect((await fetch(url, { method: "POST" })).status).toBe(405)
  })

  it("更新・削除でもCLIの乱数とIDの状態は保持する", async () => {
    const metadata = { seed: 7, rng: 8, serial: 9 }
    writeFileSync(path, JSON.stringify({ ...metadata, save: { old: true } }))
    expect(
      (await fetch(url, { method: "PUT", body: '{"new":true}' })).status
    ).toBe(204)
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      ...metadata,
      save: { new: true },
    })
    expect((await fetch(url, { method: "DELETE" })).status).toBe(204)
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(metadata)
  })
})
