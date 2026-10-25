/*
 * ホームに追加したときにオフラインでも開けるようにする Service Worker。
 * - ページ（HTML）はネットを先に見る（更新をすぐ反映）。つながらなければ保存した物を出す
 * - 差し替え可能な画像などはネットを先に見る。ハッシュ付きビルド資源だけは保存を先に見る
 */
const CACHE = "dnd-v1"

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE).then((cache) => cache.addAll(["/"])),
      self.skipWaiting(),
    ])
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ページが読み込んだ資源（スクリプト・画像など）をまとめて保存する。初回からオフラインで開けるように
self.addEventListener("message", (event) => {
  const urls = event.data?.type === "cache" ? event.data.urls : null
  if (!Array.isArray(urls)) return
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          urls
            .filter((url) => typeof url === "string")
            .map(async (url) => {
              try {
                const resource = new URL(url, self.location.origin)
                if (resource.origin !== self.location.origin) return
                if (
                  resource.pathname.startsWith("/assets/") &&
                  (await cache.match(resource.href))
                )
                  return
                const response = await fetch(resource.href, {
                  cache: "no-cache",
                })
                if (response.ok) await cache.put(resource.href, response)
              } catch {
                // 一つの通信・保存失敗で残りの資源の保存を止めない。
              }
            })
        )
      )
      .catch(() => {})
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  const fallback = async () =>
    (await caches.match(request)) ??
    (request.mode === "navigate" ? await caches.match("/") : null) ??
    Response.error()
  // Viteのビルド資源は内容のハッシュを含む。通常の画像は同名で更新される。
  const response = url.pathname.startsWith("/assets/")
    ? caches.match(request).then((hit) => hit ?? fetch(request))
    : fetch(request, { cache: "no-cache" }).catch(fallback)
  // 保存の完了までWorkerを維持する。容量不足などは表示を妨げない。
  event.waitUntil(
    response
      .then((result) => {
        if (!result.ok) return
        const copy = result.clone()
        return caches.open(CACHE).then((cache) => cache.put(request, copy))
      })
      .catch(() => {})
  )
  event.respondWith(response)
})
