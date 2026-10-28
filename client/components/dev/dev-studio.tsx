import { StudioConditions } from "@/client/components/dev/studio-conditions"
import { sectionStyle, rowStyle } from "@/client/components/dev/studio-layout"
import { layoutTime } from "@/development/studio/layout-time"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "@void/react"
import { Button } from "@/client/components/ui/button"
import { Input } from "@/client/components/ui/input"
import { Label } from "@/client/components/ui/label"
import { SidebarInset } from "@/client/components/ui/sidebar-inset"
import { Tabs } from "@/client/components/ui/tabs"
import { TabsContent } from "@/client/components/ui/tabs-content"
import { TabsList } from "@/client/components/ui/tabs-list"
import { TabsTrigger } from "@/client/components/ui/tabs-trigger"
import { StudioNavigation } from "@/client/components/dev/studio-navigation"
import { StudioTimeline } from "@/client/components/dev/studio-timeline"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { viewportPresets } from "@/development/studio/config"
import type { StudioConfig } from "@/development/studio/config"
import { useStudioPlayback } from "@/client/dev/use-studio-playback"

type Props = { scene: string }

export function DevStudio(props: Props) {
  const router = useRouter()
  const [config, setConfig] = useState<StudioConfig>(() =>
    parseStudioConfig({ scene: props.scene })
  )
  const [reload, setReload] = useState(0)
  const {
    time,
    setTime,
    inspection,
    playing,
    setPlaying,
    guides,
    setGuides,
    error,
    setError,
    frame,
    bridge,
    seek,
    initialReady,
  } = useStudioPlayback(config, reload)
  const [actionTime, setActionTime] = useState(4000)
  const [actionLabel, setActionLabel] = useState("放つ")
  const viewport = useRef<HTMLDivElement>(null)
  const [space, setSpace] = useState({ width: 800, height: 600 })
  const importRevision = useRef(0)
  const json = JSON.stringify(config)
  useEffect(
    () => () => {
      importRevision.current++
    },
    [props.scene]
  )
  useEffect(() => {
    setConfig((previous) => {
      if (previous.scene === props.scene) return previous
      const next = parseStudioConfig({
        scene: props.scene,
        seed: previous.seed,
        width: previous.width,
        height: previous.height,
        party: previous.party,
      })
      setTime(layoutTime(props.scene))
      return next
    })
  }, [props.scene])
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      setSpace({
        width: Math.max(1, rect.width - 32),
        height: Math.max(1, rect.height - 32),
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const update = (patch: Partial<StudioConfig>) => {
    importRevision.current++
    setConfig((previous) => ({ ...previous, ...patch }))
    setPlaying(false)
  }
  const download = (value: unknown, name: string) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2) + "\n"], {
        type: "application/json",
      })
    )
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const command = `vp run studio capture --config-json '${json.replaceAll("'", "'\\''")}' --at ${Math.round(time)} --out '${`node_modules/.cache/studio/${config.scene}-${Math.round(time)}.png`.replaceAll("'", "'\\''")}'`
  const scale = Math.min(
    space.width / config.width,
    space.height / config.height,
    1
  )
  const addAction = () => {
    try {
      const next = parseStudioConfig({
        ...config,
        actions: [
          ...config.actions,
          { at: actionTime, label: actionLabel },
        ].sort((a, b) => a.at - b.at),
      })
      importRevision.current++
      setConfig(next)
    } catch (problem) {
      setError(String(problem))
    }
  }
  const inspectValue = (kind: string) =>
    kind === "layout"
      ? inspection?.elements
      : kind === "state"
        ? {
            party: inspection?.party,
            battle: inspection?.battle,
            state: inspection?.state,
          }
        : {
            animations: inspection?.animations,
            operations: inspection?.operations,
            errors: inspection?.errors,
          }
  return (
    <>
      <StudioNavigation scene={props.scene} />
      <SidebarInset
        style={{
          height: "100dvh",
          minWidth: 720,
          display: "grid",
          gridTemplateColumns: "minmax(400px,1fr) 300px",
          overflow: "hidden",
        }}
      >
        <main
          style={{
            display: "grid",
            gridTemplateRows: "auto minmax(200px,1fr) auto",
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <div style={{ ...sectionStyle, padding: 12 }}>
            <div style={{ ...rowStyle, flexWrap: "wrap" }}>
              {viewportPresets.map((preset) => (
                <Button
                  key={preset.name}
                  variant={
                    config.width === preset.width &&
                    config.height === preset.height
                      ? "secondary"
                      : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    update({ width: preset.width, height: preset.height })
                  }
                >
                  {preset.name}
                </Button>
              ))}
              <Input
                aria-label="幅"
                type="number"
                min={240}
                max={2560}
                value={config.width}
                style={{ width: 80 }}
                onChange={(event) =>
                  update({ width: Number(event.target.value) })
                }
              />
              <span>×</span>
              <Input
                aria-label="高さ"
                type="number"
                min={240}
                max={2560}
                value={config.height}
                style={{ width: 80 }}
                onChange={(event) =>
                  update({ height: Number(event.target.value) })
                }
              />
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                {Math.round(scale * 100)}%
              </span>
              <Button
                size="sm"
                variant={guides ? "secondary" : "outline"}
                onClick={() => {
                  const next = !guides
                  setGuides(next)
                  bridge()?.guides(next)
                }}
              >
                枠線
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTime(0)
                  setReload((value) => value + 1)
                }}
              >
                リセット
              </Button>
            </div>
          </div>
          <div
            ref={viewport}
            style={{
              background: "#000",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            <div
              style={{
                position: "relative",
                width: config.width * scale,
                height: config.height * scale,
              }}
            >
              <iframe
                key={`${json}:${reload}`}
                ref={frame}
                src={frameUrl(config)}
                title="ゲームプレビュー"
                onLoad={() => void initialReady()}
                style={{
                  position: "absolute",
                  width: config.width,
                  height: config.height,
                  border: 0,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  background: "#000",
                }}
              />
            </div>
          </div>
          <div
            style={{
              ...sectionStyle,
              borderTop: "1px solid var(--border)",
              borderBottom: 0,
            }}
          >
            <StudioTimeline
              duration={config.duration}
              actions={config.actions}
              time={time}
              playing={playing}
              inspection={inspection}
              onPlayingChange={setPlaying}
              onSeek={seek}
            />
            {error && (
              <p
                role="alert"
                style={{
                  fontSize: 12,
                  color: "var(--destructive)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {error}
              </p>
            )}
          </div>
        </main>
        <aside
          aria-label="プレビュー条件"
          style={{ overflow: "auto", borderLeft: "1px solid var(--border)" }}
        >
          <StudioConditions config={config} update={update} setTime={setTime} />
          <div style={sectionStyle}>
            <div style={rowStyle}>
              <Input
                type="number"
                aria-label="操作の時刻（ms）"
                min={0}
                max={config.duration}
                value={actionTime}
                style={{ width: 95 }}
                onChange={(event) => setActionTime(Number(event.target.value))}
              />
              <Input
                aria-label="操作するボタン名"
                value={actionLabel}
                onChange={(event) => setActionLabel(event.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={addAction}>
              操作を追加
            </Button>
            {config.actions.map((action, index) => (
              <div key={index} style={{ ...rowStyle, fontSize: 12 }}>
                <span style={{ flex: 1 }}>
                  {action.at}ms {action.label}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`操作${index + 1}を削除`}
                  onClick={() =>
                    update({
                      actions: config.actions.filter((_, at) => at !== index),
                    })
                  }
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
          <div style={sectionStyle}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => download(config, `${config.scene}.json`)}
            >
              シナリオJSON
            </Button>
            <Label style={{ display: "grid", gap: 6 }}>
              JSONを読み込む
              <Input
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  // 同じファイルを修正して選び直した場合もchangeを受け取る。
                  event.target.value = ""
                  const request = ++importRevision.current
                  if (file)
                    void file
                      .text()
                      .then((text) => {
                        if (request !== importRevision.current) return
                        const next = parseStudioConfig(JSON.parse(text))
                        setError("")
                        setPlaying(false)
                        setTime((previous) => Math.min(previous, next.duration))
                        setConfig(next)
                        return router.visit(
                          `/dev/studio/${encodeURIComponent(next.scene)}`
                        )
                      })
                      .catch((problem) => {
                        if (request === importRevision.current)
                          setError(String(problem))
                      })
                }}
              />
            </Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(command)
                  .catch((problem) => setError(String(problem)))
              }
            >
              PNG撮影コマンドをコピー
            </Button>
            <details>
              <summary style={{ fontSize: 12, cursor: "pointer" }}>CLI</summary>
              <pre
                style={{
                  fontSize: 10,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  marginTop: 8,
                }}
              >
                {command}
              </pre>
            </details>
            <Button
              size="sm"
              variant="outline"
              disabled={!inspection}
              onClick={() =>
                download(
                  inspection,
                  `${config.scene}-${Math.round(time)}.inspection.json`
                )
              }
            >
              検証JSON
            </Button>
          </div>
          <div style={sectionStyle}>
            <Tabs defaultValue="layout">
              <TabsList style={{ width: "100%" }}>
                <TabsTrigger value="layout">配置</TabsTrigger>
                <TabsTrigger value="state">状態</TabsTrigger>
                <TabsTrigger value="motion">動き</TabsTrigger>
              </TabsList>
              {["layout", "state", "motion"].map((kind) => (
                <TabsContent key={kind} value={kind}>
                  <pre
                    style={{
                      fontSize: 10,
                      maxHeight: 340,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {JSON.stringify(inspectValue(kind), null, 2)}
                  </pre>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </aside>
      </SidebarInset>
    </>
  )
}
