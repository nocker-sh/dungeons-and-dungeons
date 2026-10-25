import { layoutTime } from "@/lib/dev/studio/patterns"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "@void/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SidebarInset } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StudioNavigation } from "./studio-navigation"
import {
  frameUrl,
  parseStudioConfig,
  viewportPresets,
  type StudioConfig,
} from "@/lib/dev/studio/config"
import { studioMembers, studioFoes } from "@/lib/dev/studio/scenarios"
import type { StudioBridge, StudioInspection } from "@/lib/dev/studio/runtime"

const sectionStyle = {
  display: "grid",
  gap: 12,
  padding: 16,
  borderBottom: "1px solid var(--border)",
}
const rowStyle = { display: "flex", alignItems: "center", gap: 8 } as const

export function DevStudio({ scene }: { scene: string }) {
  const router = useRouter()
  const [config, setConfig] = useState<StudioConfig>(() =>
    parseStudioConfig({ scene })
  )
  const [time, setTime] = useState(() => layoutTime(scene))
  const [inspection, setInspection] = useState<StudioInspection | null>(null)
  const [playing, setPlaying] = useState(false)
  const [guides, setGuides] = useState(false)
  const [error, setError] = useState("")
  const [actionTime, setActionTime] = useState(4000)
  const [actionLabel, setActionLabel] = useState("放つ")
  const frame = useRef<HTMLIFrameElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [space, setSpace] = useState({ width: 800, height: 600 })
  const seekRef = useRef<(target: number) => Promise<void>>(async () => {})
  const pending = useRef<number | undefined>(undefined)
  const pumping = useRef(false)
  const revision = useRef(0)
  const cancellation = useRef(new AbortController())
  const [reload, setReload] = useState(0)
  const inspectionRef = useRef(inspection)
  inspectionRef.current = inspection
  const json = JSON.stringify(config)
  const bridge = () => frame.current?.contentWindow?.__devStudio
  useEffect(() => {
    setConfig((previous) => {
      if (previous.scene === scene) return previous
      const next = parseStudioConfig({
        scene,
        seed: previous.seed,
        width: previous.width,
        height: previous.height,
        party: previous.party,
      })
      setTime(layoutTime(scene))
      return next
    })
  }, [scene])
  useEffect(() => {
    cancellation.current.abort()
    const controller = new AbortController()
    cancellation.current = controller
    revision.current++
    setInspection(null)
    setPlaying(false)
    setError("")
    pending.current = Math.min(time, config.duration)
    return () => controller.abort()
  }, [json, reload])
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
  const receive = (next: StudioInspection) => {
    setInspection(next)
    inspectionRef.current = next
    if (next.errors.length) setError(next.errors.join("\n"))
  }
  const waitReady = async (generation: number, previous?: StudioBridge) => {
    for (let attempt = 0; attempt < 1500; attempt++) {
      if (generation !== revision.current)
        throw new Error("条件が変更されました")
      const failure = frame.current?.contentWindow?.__devStudioError
      if (failure) throw new Error(failure)
      const api = bridge()
      if (api?.ready && api !== previous) return api
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error(
      "プレビューの起動を確認できません。サーバーとiframeのエラーを確認してください"
    )
  }
  const seek = useCallback(
    async (target: number) => {
      setTime(target)
      pending.current = target
      if (pumping.current) return
      pumping.current = true
      const generation = revision.current
      const signal = cancellation.current.signal
      const current = <T,>(operation: Promise<T>): Promise<T> =>
        new Promise((resolve, reject) => {
          const abort = () => reject(new Error("条件が変更されました"))
          if (signal.aborted) {
            abort()
            return
          }
          signal.addEventListener("abort", abort, { once: true })
          void operation.then(
            (value) => {
              signal.removeEventListener("abort", abort)
              resolve(value)
            },
            (problem) => {
              signal.removeEventListener("abort", abort)
              reject(problem)
            }
          )
        })
      try {
        while (pending.current !== undefined) {
          const next = pending.current
          pending.current = undefined
          let api = await waitReady(generation)
          if (generation !== revision.current) break
          if (next < api.inspect().time) {
            const element = frame.current!
            element.contentWindow!.location.replace(frameUrl(config))
            api = await waitReady(generation, api)
          }
          const state = await current(api.advance(next))
          if (generation !== revision.current) break
          api.guides(guides)
          receive(state)
        }
      } catch (problem) {
        if (generation === revision.current) {
          setPlaying(false)
          setError(String(problem))
        }
      } finally {
        pumping.current = false
        if (pending.current !== undefined) {
          const next = pending.current
          queueMicrotask(() => void seekRef.current(next))
        }
      }
      // iframeと条件はこのレンダーのもの。変更中の結果はrevisionで捨てる。
    },
    [json, guides]
  )
  seekRef.current = seek
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        !inspectionRef.current ||
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="option"]'
          ))
      )
        return
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault()
        setPlaying((value) => !value)
        return
      }
      const target =
        event.key === "ArrowLeft"
          ? Math.max(0, time - (event.shiftKey ? 1000 : 1000 / 60))
          : event.key === "ArrowRight"
            ? Math.min(
                config.duration,
                time + (event.shiftKey ? 1000 : 1000 / 60)
              )
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? config.duration
                : undefined
      if (target === undefined) return
      event.preventDefault()
      setPlaying(false)
      void seekRef.current(target)
    }
    addEventListener("keydown", keydown)
    return () => removeEventListener("keydown", keydown)
  }, [time, config.duration])
  useEffect(() => {
    if (!playing) return
    let cancelled = false
    let frameId = 0
    const start = performance.now()
    const from = inspectionRef.current?.time ?? 0
    const tick = async (now: number) => {
      if (cancelled) return
      const target = Math.min(config.duration, from + now - start)
      await seek(Math.round(target))
      if (cancelled) return
      if (target >= config.duration) {
        setPlaying(false)
        return
      }
      frameId = requestAnimationFrame((next) => void tick(next))
    }
    frameId = requestAnimationFrame((next) => void tick(next))
    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
    }
  }, [playing, seek, config.duration])
  const update = (patch: Partial<StudioConfig>) => {
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
  const command = `bun scripts/studio.ts capture --config-json '${json.replaceAll("'", "'\\''")}' --at ${Math.round(time)} --out '${`node_modules/.cache/studio/${config.scene}-${Math.round(time)}.png`.replaceAll("'", "'\\''")}'`
  const scale = Math.min(
    space.width / config.width,
    space.height / config.height,
    1
  )
  const trackGroups = new Map<
    string,
    NonNullable<StudioInspection>["animations"]
  >()
  for (const track of inspection?.animations ?? []) {
    const key = `${track.label} · ${track.properties.join(", ")}`
    trackGroups.set(key, [...(trackGroups.get(key) ?? []), track])
  }
  const initialReady = () => seek(Math.min(time, config.duration))
  const addAction = () => {
    try {
      const next = parseStudioConfig({
        ...config,
        actions: [
          ...config.actions,
          { at: actionTime, label: actionLabel },
        ].sort((a, b) => a.at - b.at),
      })
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
      <StudioNavigation scene={scene} />
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
            <div style={rowStyle}>
              <Button
                size="sm"
                title="Space"
                onClick={() => setPlaying(!playing)}
                disabled={!inspection}
              >
                {playing ? "停止" : "再生"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="←（Shiftで1秒）"
                disabled={!inspection}
                onClick={() => {
                  setPlaying(false)
                  void seek(Math.max(0, time - 1000 / 60))
                }}
              >
                −1コマ
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="→（Shiftで1秒）"
                disabled={!inspection}
                onClick={() => {
                  setPlaying(false)
                  void seek(Math.min(config.duration, time + 1000 / 60))
                }}
              >
                ＋1コマ
              </Button>
              <Input
                aria-label="時刻（ms）"
                type="number"
                min={0}
                max={config.duration}
                value={Math.round(time)}
                style={{ width: 110 }}
                onChange={(event) => {
                  setPlaying(false)
                  void seek(
                    Math.min(
                      config.duration,
                      Math.max(0, Number(event.target.value))
                    )
                  )
                }}
              />
              <span style={{ fontSize: 12 }}>ms / {config.duration}</span>
            </div>
            <Slider
              aria-label="タイムライン"
              min={0}
              max={config.duration}
              step={10}
              value={[Math.round(time)]}
              onValueChange={(value) => {
                setPlaying(false)
                void seek(Array.isArray(value) ? value[0] : value)
              }}
            />
            <div
              aria-label="アニメーショントラック"
              style={{
                maxHeight: 140,
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: 4,
              }}
            >
              {[...trackGroups].map(([label, tracks]) => (
                <div
                  key={label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px minmax(0,1fr)",
                    height: 20,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span
                    title={label}
                    style={{
                      fontSize: 10,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      padding: "2px 4px",
                    }}
                  >
                    {label}
                  </span>
                  <div
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      borderLeft: "1px solid var(--border)",
                    }}
                  >
                    {tracks.map((track) => (
                      <button
                        key={track.id}
                        aria-label={`${label}・${Math.round(track.start)}msへ`}
                        title={`${Math.round(track.start)}ms / ${Math.round(track.duration)}ms`}
                        onClick={() => {
                          setPlaying(false)
                          void seek(
                            Math.max(0, Math.min(config.duration, track.start))
                          )
                        }}
                        style={{
                          position: "absolute",
                          top: 3,
                          left: `${(track.start / config.duration) * 100}%`,
                          width: `${Math.max(0.3, (Math.min(config.duration, track.duration) / config.duration) * 100)}%`,
                          height: 13,
                          border: "1px solid var(--border)",
                          borderRadius: 2,
                          background: "var(--muted-foreground)",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                    {config.actions.map((action, index) => (
                      <button
                        key={index}
                        aria-label={`${action.label}の時刻へ`}
                        title={`${action.at}ms: ${action.label}`}
                        onClick={() => {
                          setPlaying(false)
                          void seek(action.at)
                        }}
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: `${(action.at / config.duration) * 100}%`,
                          width: 2,
                          padding: 0,
                          border: 0,
                          background: "var(--primary)",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${(time / config.duration) * 100}%`,
                        width: 2,
                        background: "var(--foreground)",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
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
          <div style={sectionStyle}>
            <Field label="乱数の種">
              <Input
                type="number"
                min={0}
                max={0xffffffff}
                value={config.seed}
                onChange={(event) =>
                  update({ seed: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="長さ（ms）">
              <Input
                type="number"
                min={100}
                max={60000}
                value={config.duration}
                onChange={(event) => {
                  setTime((previous) =>
                    Math.min(previous, Number(event.target.value))
                  )
                  update({ duration: Number(event.target.value) })
                }}
              />
            </Field>
          </div>
          <div style={sectionStyle}>
            {config.party.map((slug, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 70px",
                  gap: 8,
                }}
              >
                <Field label={`${index + 1}人目`}>
                  <Choice
                    value={slug}
                    disabled={index === 0}
                    options={studioMembers.filter(
                      (member) =>
                        member.slug === slug ||
                        !config.party.includes(member.slug)
                    )}
                    onChange={(value) =>
                      update({
                        party: config.party.map((entry, at) =>
                          at === index ? value : entry
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="HP %">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    disabled={config.scene !== "battle"}
                    value={config.hp[index]}
                    onChange={(event) =>
                      update({
                        hp: config.hp.map((entry, at) =>
                          at === index ? Number(event.target.value) : entry
                        ),
                      })
                    }
                  />
                </Field>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              未実装のキャラの能力は同ロールの表示モック。
            </p>
          </div>
          <div style={sectionStyle}>
            {config.foes.map((slug, index) => (
              <div key={index} style={rowStyle}>
                <Field label={`敵${index + 1}`}>
                  <Choice
                    value={slug}
                    disabled={config.scene !== "battle"}
                    options={studioFoes}
                    onChange={(value) =>
                      update({
                        foes: config.foes.map((entry, at) =>
                          at === index ? value : entry
                        ),
                      })
                    }
                  />
                </Field>
                {config.foes.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={config.scene !== "battle"}
                    aria-label={`敵${index + 1}を削除`}
                    onClick={() =>
                      update({
                        foes: config.foes.filter((_, at) => at !== index),
                      })
                    }
                  >
                    −
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={config.scene !== "battle" || config.foes.length >= 4}
              onClick={() =>
                update({ foes: [...config.foes, studioFoes[0].slug] })
              }
            >
              敵を追加
            </Button>
          </div>
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
                  if (file)
                    void file
                      .text()
                      .then((text) => {
                        const next = parseStudioConfig(JSON.parse(text))
                        setConfig(next)
                        return router.visit(`/dev/studio/${next.scene}`)
                      })
                      .catch((problem) => setError(String(problem)))
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
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Label style={{ display: "grid", gap: 6, fontSize: 12, width: "100%" }}>
      {label}
      {children}
    </Label>
  )
}
function Choice({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  options: readonly { slug: string; name?: string; title?: string }[]
  disabled?: boolean
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(value) => {
        if (value) onChange(value)
      }}
    >
      <SelectTrigger style={{ width: "100%" }}>
        <SelectValue>
          {options.find((entry) => entry.slug === value)?.name ?? value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((entry) => (
          <SelectItem key={entry.slug} value={entry.slug}>
            {entry.name ?? entry.title ?? entry.slug}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
