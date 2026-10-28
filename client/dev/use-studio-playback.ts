import { useCallback, useEffect, useRef, useState } from "react"
import { frameUrl } from "@/development/studio/frame-url"
import type { StudioConfig } from "@/development/studio/config"
import { layoutTime } from "@/development/studio/layout-time"
import type { StudioBridge, StudioInspection } from "@/client/dev/studio-types"

/** iframeの時計を直列に進め、条件変更前の結果と再生を破棄する。 */
export function useStudioPlayback(config: StudioConfig, reload: number) {
  const [time, setTime] = useState(() => layoutTime(config.scene))
  const [inspection, setInspection] = useState<StudioInspection | null>(null)
  const [playing, setPlaying] = useState(false)
  const [guides, setGuides] = useState(false)
  const [error, setError] = useState("")
  const frame = useRef<HTMLIFrameElement>(null)
  const seekRef = useRef<(target: number) => Promise<void>>(async () => {})
  const pending = useRef<number | undefined>(undefined)
  const pumping = useRef(false)
  const revision = useRef(0)
  const cancellation = useRef(new AbortController())
  const inspectionRef = useRef(inspection)
  inspectionRef.current = inspection
  const json = JSON.stringify(config)
  const bridge = () => frame.current?.contentWindow?.__devStudio
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
      const current = <T>(operation: Promise<T>): Promise<T> =>
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
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !inspectionRef.current ||
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="option"], [role="slider"], [role="tab"]'
          ))
      )
        return
      if (event.code === "Space" && !event.repeat) {
        // ボタンのSpaceはそのボタンを押す。全体の再生と二重に扱わない。
        if (
          event.target instanceof Element &&
          event.target.closest(
            'button, a[href], [role="button"], [role="link"]'
          )
        )
          return
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
  return {
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
    initialReady: () => seek(Math.min(time, config.duration)),
  }
}
