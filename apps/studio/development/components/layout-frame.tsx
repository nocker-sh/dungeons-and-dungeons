import { useEffect, useRef, useState } from "react"
import { frameUrl } from "@/development/studio/frame-url"
import type { StudioConfig } from "@/development/studio/config"

/** コピーした見た目ではなく、実ゲームのiframeを同じ時計で停止して並べる。 */
type Props = { config: StudioConfig; at: number }

export function LayoutFrame(props: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)
  const scale = Math.min(320 / props.config.width, 460 / props.config.height)
  useEffect(() => {
    let cancelled = false
    let started = false
    const deadline = performance.now() + 45000
    const timer = setInterval(() => {
      if (started) return
      const view = frame.current?.contentWindow
      const api = view?.__devStudio
      const failure = view?.__devStudioError
      if (failure || performance.now() > deadline) {
        setError(failure ?? "プレビューを起動できませんでした")
        clearInterval(timer)
      } else if (api?.ready) {
        started = true
        clearInterval(timer)
        void api
          .advance(props.at)
          .then((inspection) => {
            if (cancelled) return
            setError(inspection.errors.join("\n"))
            setReady(true)
          })
          .catch((problem) => {
            if (!cancelled) setError(String(problem))
          })
      }
    }, 100)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [props.config, props.at])
  return (
    <div
      style={{
        position: "relative",
        width: props.config.width * scale,
        height: props.config.height * scale,
        overflow: "hidden",
        background: "#000",
        margin: "0 auto",
      }}
    >
      <iframe
        ref={frame}
        src={frameUrl(props.config)}
        title={props.config.scene}
        data-layout-ready={ready ? "true" : "false"}
        style={{
          width: props.config.width,
          height: props.config.height,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      />
      {error ? (
        <p
          role="alert"
          style={{
            position: "absolute",
            inset: 0,
            padding: 12,
            background: "var(--background)",
            overflow: "auto",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
