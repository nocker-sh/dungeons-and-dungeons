import { useEffect, useState } from "react"
import type { ComponentType } from "react"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { StudioRuntime } from "@/client/dev/studio-runtime"
import { createStudioStart } from "@/development/studio/create-studio-start"
import { loadArtwork } from "@/client/game/load-artwork"
import { studioArtwork } from "@/development/studio/artwork"
import type { GameApp } from "@/client/components/game/game-app"
import type { PreviewStart } from "@/client/dev/preview-start"

type Props = { scene: string; json: string }

export function Frame(props: Props) {
  const [loaded, setLoaded] = useState<{
    Component: ComponentType<Parameters<typeof GameApp>[0]>
    start: PreviewStart
    runtime: StudioRuntime
  } | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let runtime: StudioRuntime | undefined
    let cancelled = false
    delete window.__devStudioError
    void (async () => {
      const config = parseStudioConfig({
        ...(props.json ? JSON.parse(props.json) : {}),
        scene: props.scene,
      })
      const start = createStudioStart(config)
      // 一覧では何枚も同時に開くので、一度に要求しすぎない（ブラウザが要求を断る）
      const artwork = studioArtwork(start)
      for (let index = 0; index < artwork.length; index += 24) {
        if (cancelled) return
        await loadArtwork(artwork.slice(index, index + 24))
      }
      if (cancelled) return
      runtime = new StudioRuntime(config)
      if (props.scene === "components") {
        const { PartsPreview } =
          await import("@/client/components/dev/parts-preview")
        start.render = <PartsPreview />
      }
      const { GameApp: Component } =
        await import("@/client/components/game/game-app")
      if (cancelled) {
        runtime.dispose()
        return
      }
      setLoaded({ Component, start, runtime })
    })().catch((problem) => {
      if (cancelled) return
      window.__devStudioError = String(problem)
      setError(String(problem))
      if (runtime) {
        runtime.errors.push(String(problem))
        runtime.ready = true
        runtime.showInitialFrame()
      }
    })
    return () => {
      cancelled = true
      runtime?.dispose()
    }
  }, [props.scene, props.json])
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
        if (window.__devStudio !== runtime) return
        runtime.game = game
        void runtime.initialize().catch((problem) => {
          if (window.__devStudio !== runtime) return
          runtime.errors.push(String(problem))
          runtime.ready = true
          runtime.showInitialFrame()
          setError(String(problem))
        })
      }}
    />
  )
}
