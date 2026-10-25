import { useEffect } from "react"
import { GameApp } from "@/components/game/game-app"

export default function Home() {
  // 本番だけ Service Worker を入れる（ホームに追加・オフライン）。開発中は古い物を出さないため入れない
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return
    void navigator.serviceWorker.register("/sw.js")
    // 読み込んだ資源を保存させる（初回からオフラインで開けるように）
    void navigator.serviceWorker.ready.then((registration) => {
      const urls = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((url) => url.startsWith(location.origin))
      registration.active?.postMessage({ type: "cache", urls: [...urls, "/"] })
    })
  }, [])
  return <GameApp />
}
