import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { launch } from "./lib"
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
  if (path.startsWith("/images/"))
    response.setHeader("Cache-Control", "public, max-age=3600")
  if (path.startsWith("/assets/")) assetRequests++
  response.statusCode = path === "/images/failed.webp" ? 503 : status
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
  const read = (path: string) =>
    page.evaluate(async (path) => {
      const result = await fetch(path)
      return { text: await result.text(), status: result.status }
    }, path)
  const cached = (path: string, text: string) =>
    page.waitForFunction(
      async ({ path, text }) =>
        (await (await caches.match(path))?.text()) === text,
      { path, text }
    )
  if ((await read("/images/portrait.webp")).text !== "first")
    throw new Error("初回画像を取得できない")
  await cached("/images/portrait.webp", "first")
  version = "second"
  if ((await read("/images/portrait.webp")).text !== "second")
    throw new Error("同名画像が更新されない")
  await cached("/images/portrait.webp", "second")
  await context.setOffline(true)
  if ((await read("/images/portrait.webp")).text !== "second")
    throw new Error("オフラインで更新画像が残らない")
  await page.goto(`http://127.0.0.1:${port}/`)
  if ((await page.title()) !== "キャッシュ検証")
    throw new Error("オフラインでホームを開けない")
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
  if ((await read("/images/portrait.webp")).status !== 500)
    throw new Error("HTTPエラーの応答が違う")
  await context.setOffline(true)
  if ((await read("/images/portrait.webp")).text !== "second")
    throw new Error("HTTPエラーで保存済み画像を上書きした")
  await context.setOffline(false)
  status = 200
  await page.evaluate(() =>
    navigator.serviceWorker.controller!.postMessage({
      type: "cache",
      urls: [
        "/images/portrait.webp",
        "/assets/app-hash123.js",
        "/images/failed.webp",
        123,
      ],
    })
  )
  await cached("/images/portrait.webp", "third")
  if (assetRequests !== 1) throw new Error("一括保存でハッシュ資源を再取得した")
  if (
    await page.evaluate(
      async () => !!(await caches.match("/images/failed.webp"))
    )
  )
    throw new Error("一括保存でHTTP失敗を保存した")
  await context.setOffline(true)
  if ((await read("/images/portrait.webp")).text !== "third")
    throw new Error("一括保存で同名画像を更新しない")
  await context.setOffline(false)
  version = "fourth"
  const worker = context.serviceWorkers()[0]!
  await worker.evaluate(() => {
    Cache.prototype.put = () =>
      Promise.reject(new DOMException("容量不足", "QuotaExceededError"))
  })
  if ((await read("/images/portrait.webp")).text !== "fourth")
    throw new Error("保存失敗がネットの応答を壊した")
  console.log(
    "同名画像更新・オフライン画像/ホーム・ハッシュ資源の保存優先・HTTPエラー保存拒否・一括保存で同名画像更新・失敗資源除外・容量不足でも通信応答を表示"
  )
} finally {
  await browser.close()
  server.closeAllConnections()
  server.close()
}
