import { afterEach, describe, expect, it } from "vite-plus/test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ResultCache, sourceFingerprint } from "@/builder/lib/result-cache"

const folders: string[] = []
function cacheFile() {
  const folder = mkdtempSync(join(tmpdir(), "dnd-result-cache-"))
  folders.push(folder)
  return join(folder, "results.json")
}

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true })
})

describe("測定結果キャッシュの読み込み", () => {
  const parts = ["first-battle", 0.9, null, [], 200, 1]
  const key = `${sourceFingerprint()}:${JSON.stringify(parts)}`

  it.each([
    "null",
    "[]",
    '"broken"',
    "123",
    "{",
    JSON.stringify({ [key]: "1" }),
    JSON.stringify({ [key]: true }),
    JSON.stringify({ [key]: {} }),
    `{${JSON.stringify(key)}:1e999}`,
  ])("不正なキャッシュ %s は使わず、再測定した値を保存できる", (raw) => {
    const file = cacheFile()
    writeFileSync(file, raw)
    const cache = new ResultCache(file)
    expect(cache.get(parts)).toBeUndefined()
    cache.save()
    expect(readFileSync(file, "utf8")).toBe(raw)
    cache.set(parts, 0.95)
    cache.save()
    expect(new ResultCache(file).get(parts)).toBe(0.95)
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ [key]: 0.95 })
  })

  it("通常の数値・0・無限大を保存して復元し、測定条件を分ける", () => {
    const file = cacheFile()
    const cache = new ResultCache(file)
    expect(cache.get(parts)).toBeUndefined()
    cache.set(parts, 0.95)
    cache.set(["zero"], 0)
    cache.set(["unreachable"], Infinity)
    cache.save()
    const resumed = new ResultCache(file)
    expect(resumed.get(parts)).toBe(0.95)
    expect(resumed.get(["zero"])).toBe(0)
    expect(resumed.get(["unreachable"])).toBe(Infinity)
    expect(resumed.get([...parts, "different"])).toBeUndefined()
  })
})
