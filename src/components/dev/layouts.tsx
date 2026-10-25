import { useEffect, useRef, useState } from "react"
import { Link } from "@void/react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SidebarInset } from "@/components/ui/sidebar"
import { StudioNavigation } from "./studio-navigation"
import {
  frameUrl,
  parseStudioConfig,
  viewportPresets,
  type StudioConfig,
} from "@/lib/dev/studio/config"
import { studioScenes } from "@/lib/dev/studio/scenarios"
import { layoutTime } from "@/lib/dev/studio/patterns"

/** コピーした見た目ではなく、実ゲームのiframeを同じ時計で停止して並べる。 */
function LayoutFrame({ config, at }: { config: StudioConfig; at: number }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)
  const scale = Math.min(320 / config.width, 460 / config.height)
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
          .advance(at)
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
  }, [config, at])
  return (
    <div
      style={{
        position: "relative",
        width: config.width * scale,
        height: config.height * scale,
        overflow: "hidden",
        background: "#000",
        margin: "0 auto",
      }}
    >
      <iframe
        ref={frame}
        src={frameUrl(config)}
        title={config.scene}
        data-layout-ready={ready ? "true" : "false"}
        style={{
          width: config.width,
          height: config.height,
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

export function LayoutsPage() {
  const [viewport, setViewport] = useState<(typeof viewportPresets)[number]>(
    viewportPresets[0]
  )
  const [filter, setFilter] = useState("")
  const [page, setPage] = useState(0)
  const scenes = studioScenes.filter((scene) =>
    `${scene.title} ${scene.slug}`.includes(filter)
  )
  const pageSize = 6
  const pageCount = Math.max(1, Math.ceil(scenes.length / pageSize))
  const selectedPage = Math.min(page, pageCount - 1)
  const visible = scenes.slice(
    selectedPage * pageSize,
    (selectedPage + 1) * pageSize
  )
  return (
    <>
      <StudioNavigation />
      <SidebarInset
        style={{ height: "100dvh", overflow: "auto", minWidth: 720 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 16,
            flexWrap: "wrap",
          }}
        >
          {viewportPresets.map((preset) => (
            <Button
              key={preset.name}
              variant={viewport.name === preset.name ? "secondary" : "outline"}
              onClick={() => setViewport(preset)}
            >
              {preset.name}
            </Button>
          ))}
          <Input
            aria-label="場面を絞り込む"
            placeholder="場面を絞り込む"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value)
              setPage(0)
            }}
            style={{ width: 220 }}
          />
          <Button
            variant="outline"
            disabled={selectedPage === 0}
            onClick={() => setPage(selectedPage - 1)}
          >
            前へ
          </Button>
          <span>
            {selectedPage + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            disabled={selectedPage + 1 === pageCount}
            onClick={() => setPage(selectedPage + 1)}
          >
            次へ
          </Button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 16,
            padding: 16,
            alignItems: "start",
          }}
        >
          {visible.map((scene) => {
            const config = parseStudioConfig({
              scene: scene.slug,
              width: viewport.width,
              height: viewport.height,
            })
            const at = layoutTime(scene.slug)
            return (
              <Card
                key={`${scene.slug}:${viewport.name}`}
                style={{ padding: 0, gap: 0, overflow: "hidden" }}
              >
                <Link
                  href={`/dev/studio/${scene.slug}`}
                  style={{ display: "block", padding: 12 }}
                >
                  {scene.title}
                </Link>
                <LayoutFrame config={config} at={at} />
              </Card>
            )
          })}
        </div>
      </SidebarInset>
    </>
  )
}
