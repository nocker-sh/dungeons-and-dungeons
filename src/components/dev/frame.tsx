import { useRouter } from "@void/react"
import { useEffect, useState, type ComponentType } from "react"
import { parseStudioConfig } from "@/lib/dev/studio/config"
import { StudioRuntime } from "@/lib/dev/studio/runtime"
import { createStudioStart } from "@/lib/dev/studio/scenarios"
import { loadArtwork } from "@/lib/game-client/artwork"
import { studioArtwork } from "@/lib/dev/studio/artwork"
import type { GameApp, PreviewStart } from "@/components/game/game-app"

/** スタジオ・CLI が撮る一場面（/dev/frame/{scene}?config=）。 */
export function DevFrame({ scene }: { scene: string }) {
  const config = useRouter().query.get("config") ?? ""
  return <Frame key={`${scene}:${config}`} scene={scene} json={config} />
}
function Frame({ scene, json }: { scene: string; json: string }) {
  const [loaded, setLoaded] = useState<{
    Component: ComponentType<Parameters<typeof GameApp>[0]>
    start: PreviewStart
    runtime: StudioRuntime
  } | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let runtime: StudioRuntime | undefined
    let cancelled = false
    void (async () => {
      const config = parseStudioConfig({
        ...(json ? JSON.parse(json) : {}),
        scene,
      })
      const start = createStudioStart(config)
      // 一覧では何枚も同時に開くので、一度に要求しすぎない（ブラウザが要求を断る）
      const artwork = studioArtwork(start)
      for (let index = 0; index < artwork.length; index += 24)
        await loadArtwork(artwork.slice(index, index + 24))
      if (cancelled) return
      runtime = new StudioRuntime(config)
      if (scene === "components") {
        const { PartsPreview } = await import("@/components/dev/parts-preview")
        start.render = <PartsPreview />
      }
      const { GameApp: Component } = await import("@/components/game/game-app")
      if (cancelled) {
        runtime.dispose()
        return
      }
      setLoaded({ Component, start, runtime })
    })().catch((problem) => {
      window.__devStudioError = String(problem)
      setError(String(problem))
      if (runtime) {
        runtime.errors.push(String(problem))
        runtime.ready = true
      }
    })
    return () => {
      cancelled = true
      runtime?.dispose()
    }
  }, [scene, json])
  if (error)
    return (
      <p role="alert" style={{ padding: 24 }}>
        {error}
      </p>
    )
  if (!loaded) return <p style={{ padding: 24 }}>読み込み中</p>
  const { Component, start, runtime } = loaded
  return (
    <Component
      preview={start}
      onReady={(game) => {
        runtime.game = game
        void runtime.initialize().catch((problem) => {
          runtime.errors.push(String(problem))
          runtime.ready = true
          setError(String(problem))
        })
      }}
    />
  )
}
