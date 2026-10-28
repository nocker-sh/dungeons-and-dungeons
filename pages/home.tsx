import { useEffect } from "react"
import { GameApp } from "@/client/components/game/game-app"

export default function Home() {
  // 本番だけ Service Worker を入れる（ホームに追加・オフライン）。開発中は古い物を出さないため入れない
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return
    // SW管理前に読み込んだ資源だけ、初回のオフライン再開に備えて保存する。
    // 管理下の再読込ではfetch処理が保存するため、一括取得を重ねない。
    const controlled = !!navigator.serviceWorker.controller
    void navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        if (controlled) return
        const urls = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((url) => url.startsWith(location.origin))
        registration.active?.postMessage({
          type: "cache",
          urls: [...urls, "/"],
        })
      })
      .catch(() => {
        // オフライン用の準備を拒否されても、ゲーム本体の起動と保存は続ける。
      })
  }, [])
  return <GameApp />
}
