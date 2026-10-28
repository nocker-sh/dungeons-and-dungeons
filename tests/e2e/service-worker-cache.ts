import assert from "node:assert/strict"
import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { launch } from "@/tests/e2e/launch"
let version = "first"
let status = 200
let assetRequests = 0
const workerSource = readFileSync("public/sw.js")
const server = createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname
  response.setHeader("Cache-Control", "no-store")
  if (path === "/sw.js") {
    response.setHeader("Content-Type", "application/javascript")
    response.end(workerSource)
    return
  }
  if (path === "/") {
    response.setHeader("Content-Type", "text/html; charset=utf-8")
    response.end("<!doctype html><title>キャッシュ検証</title>")
    return
  }
  if (path.startsWith("/tmp/characters/"))
    response.setHeader("Cache-Control", "public, max-age=3600")
  if (path.startsWith("/assets/")) {
    assetRequests++
    response.setHeader("Vary", "Origin")
  }
  if (path === "/assets/module-hash789.js") {
    response.setHeader("Content-Type", "text/javascript")
    response.end(`export default ${JSON.stringify(version)}`)
    return
  }
  response.statusCode = path === "/tmp/characters/failed.webp" ? 503 : status
  response.end(version)
})
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
const port = (server.address() as AddressInfo).port
const browser = await launch()
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.evaluate(async () => {
    const previous = await caches.open("dnd-v0")
    await previous.put("/", new Response("古いゲームのホーム"))
    const unrelated = await caches.open("studio-v1")
    await unrelated.put(
      "/",
      new Response("<!doctype html><title>別ツールのホーム</title>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    )
    await unrelated.put(
      "/assets/app-hash123.js",
      new Response("別ツールの資源")
    )
    await unrelated.put(
      "/tmp/characters/foreign.webp",
      new Response("別ツールだけが保存した画像")
    )
    await caches.open("dnd-portraits")
    await navigator.serviceWorker.register("/sw.js")
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true }
        )
      )
  })
  assert.deepEqual(
    await page.evaluate(async () => (await caches.keys()).sort()),
    ["dnd-portraits", "dnd-v1", "studio-v1"],
    "ゲームの旧版以外のキャッシュを削除した"
  )
  const read = (path: string) =>
    page
      .evaluate(async (path) => {
        const result = await fetch(path)
        return { text: await result.text(), status: result.status }
      }, path)
      .catch((error) => {
        throw new Error(`取得失敗: ${path}`, { cause: error })
      })
  const cached = (path: string, text: string) =>
    page.waitForFunction(
      async ({ path, text }) =>
        (await (await caches.match(path, { cacheName: "dnd-v1" }))?.text()) ===
        text,
      { path, text }
    )
  if ((await read("/tmp/characters/portrait.webp")).text !== "first")
    throw new Error("初回画像を取得できない")
  await cached("/tmp/characters/portrait.webp", "first")
  version = "second"
  if ((await read("/tmp/characters/portrait.webp")).text !== "second")
    throw new Error("同名画像が更新されない")
  await cached("/tmp/characters/portrait.webp", "second")
  await context.setOffline(true)
  if ((await read("/tmp/characters/portrait.webp")).text !== "second")
    throw new Error("オフラインで更新画像が残らない")
  await assert.rejects(
    read("/tmp/characters/foreign.webp"),
    /取得失敗/,
    "別用途だけが保存した画像をゲームへ流用した"
  )
  await page.goto(`http://127.0.0.1:${port}/`)
  if ((await page.title()) !== "キャッシュ検証")
    throw new Error("オフラインでホームを開けない")
  await page.goto(`http://127.0.0.1:${port}/not-cached`)
  assert.equal(
    await page.title(),
    "キャッシュ検証",
    "未保存のページからゲームのホームへ戻れない"
  )
  await context.setOffline(false)
  if ((await read("/assets/app-hash123.js")).text !== "second")
    throw new Error("ビルド資源の初回取得が違う")
  await cached("/assets/app-hash123.js", "second")
  version = "third"
  if (
    (await read("/assets/app-hash123.js")).text !== "second" ||
    assetRequests !== 1
  )
    throw new Error("ハッシュ資源で保存を利用しない")
  status = 500
  if ((await read("/tmp/characters/portrait.webp")).status !== 500)
    throw new Error("HTTPエラーの応答が違う")
  await context.setOffline(true)
  if ((await read("/tmp/characters/portrait.webp")).text !== "second")
    throw new Error("HTTPエラーで保存済み画像を上書きした")
  await context.setOffline(false)
  status = 200
  await page.evaluate(() =>
    navigator.serviceWorker.controller!.postMessage({
      type: "cache",
      urls: [
        "/tmp/characters/portrait.webp",
        "/assets/app-hash123.js",
        "/tmp/characters/failed.webp",
        123,
      ],
    })
  )
  await cached("/tmp/characters/portrait.webp", "third")
  if (assetRequests !== 1) throw new Error("一括保存でハッシュ資源を再取得した")
  if (
    await page.evaluate(
      async () => !!(await caches.match("/tmp/characters/failed.webp"))
    )
  )
    throw new Error("一括保存でHTTP失敗を保存した")
  await context.setOffline(true)
  if ((await read("/tmp/characters/portrait.webp")).text !== "third")
    throw new Error("一括保存で同名画像を更新しない")
  await context.setOffline(false)
  await page.evaluate(() =>
    navigator.serviceWorker.controller!.postMessage({
      type: "cache",
      urls: ["/assets/module-hash789.js"],
    })
  )
  await cached("/assets/module-hash789.js", 'export default "third"')
  await context.setOffline(true)
  const loaded = await page.evaluate(async () => {
    const url = "/assets/module-hash789.js"
    return (await import(/* @vite-ignore */ url)).default
  })
  assert.equal(
    loaded,
    "third",
    "Originで応答が分かれるモジュールをオフラインで読めない"
  )
  assert.equal(assetRequests, 2, "保存済みモジュールを再取得した")
  await context.setOffline(false)
  version = "fourth"
  const worker = context.serviceWorkers()[0]!
  await worker.evaluate(() => {
    Cache.prototype.put = () =>
      Promise.reject(new DOMException("容量不足", "QuotaExceededError"))
  })
  if ((await read("/tmp/characters/portrait.webp")).text !== "fourth")
    throw new Error("保存失敗がネットの応答を壊した")
  await worker.evaluate(() => {
    CacheStorage.prototype.match = () =>
      Promise.reject(
        new DOMException("キャッシュを読み取れない", "SecurityError")
      )
  })
  if ((await read("/assets/unreadable-hash456.js")).text !== "fourth")
    throw new Error("キャッシュの読み取り失敗でオンラインのJSが取得できない")
  if ((await read("/assets/app-hash123.js")).text !== "fourth")
    throw new Error("保存済み資源も読み取れなければ通信から取得する必要がある")
  assert.equal(
    assetRequests,
    4,
    "読み取り失敗のたびに1回だけ通信する必要がある"
  )
  assert.equal(
    await page.evaluate(async () =>
      (
        await caches.match("/assets/app-hash123.js", { cacheName: "studio-v1" })
      )?.text()
    ),
    "別ツールの資源",
    "ゲームの資源保存で別用途のキャッシュを書き換えた"
  )
  console.log(
    "旧版のみ削除・他用途のキャッシュ保持と参照分離・同名画像更新・オフライン画像/ホーム・ハッシュ資源の保存優先・Vary:Origin付きモジュールのオフライン読込・HTTPエラー保存拒否・一括保存で同名画像更新・失敗資源除外・容量不足・読み取り失敗でも通信応答を表示"
  )
} finally {
  await browser.close()
  server.closeAllConnections()
  server.close()
}
