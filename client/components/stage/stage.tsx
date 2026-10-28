import { loadArtwork } from "@/client/game/load-artwork"
import { AnimationBarrier } from "@/client/components/canvas/animation"
import { nextFrame } from "@/client/components/canvas/next-frame"
import { parallel } from "@/client/components/canvas/parallel"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import type { CSSProperties, ReactNode } from "react"
import { Camera } from "@/client/components/stage/camera"
import { FxLayer } from "@/client/components/stage/fx/fx-layer"
import { FxStore } from "@/client/components/stage/fx/store"
import { unitPx } from "@/client/components/stage/unit-px"
import { UNIT_STEPS } from "@/client/components/stage/unit-step"
import { useWideFormation } from "@/client/components/stage/use-wide-formation"
import {
  FONT_FAMILY,
  PALETTE,
  REVERT,
  STAGE_LAYER,
} from "@/client/components/canvas/tokens"
import { StageContext } from "@/client/components/stage/use-stage"
import type { StageApi } from "@/client/components/stage/use-stage"
import { StageDirector } from "@/client/components/stage/director"
import { play } from "@/client/components/canvas/play"
import { cancelDetachedAnimations } from "@/client/components/canvas/cancel-detached-animations"
import { cancelAnimationsWithin } from "@/client/components/canvas/cancel-animations-within"
import { ArtSet } from "@/client/components/stage/art-set"
import { FormationBand } from "@/client/components/stage/formation-band"
import { subscribeResize } from "@/client/components/stage/stage/subscribe-resize"

/** 映画の黒帯。高さは --bar（場面ごとに stage.bars で変える）。 */
export const LETTERBOX: CSSProperties = {
  ...REVERT,
  position: "absolute",
  left: 0,
  right: 0,
  height: "var(--bar)",
  background: "#000",
  zIndex: STAGE_LAYER.letterbox,
  pointerEvents: "none",
}

export type Props = {
  children: ReactNode
  formation: ReactNode
  /** 保存失敗など、専用画面で通常のUIを隠している間も必要な知らせ。 */
  alerts?: ReactNode
  /** バッグや対象選択中は、背景画像に重なる入口も操作対象から外す。 */
  backgroundInert?: boolean
}

export function Stage(props: Props) {
  const backgroundInert =
    props.backgroundInert === undefined ? false : props.backgroundInert

  // 文字と部品の大きさの単位。画面の大きさに合わせて段ごとに切り替える（滑らかには変えない）
  const unit = useSyncExternalStore(
    subscribeResize,
    unitPx,
    () => UNIT_STEPS[1]
  )
  const root = useRef<HTMLDivElement>(null)
  const topBar = useRef<HTMLDivElement>(null)
  const bottomBar = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLElement>(null)
  const set = useRef<HTMLDivElement>(null)
  const updates = useMemo(() => new AnimationBarrier(), [])
  const exits = useMemo(() => new AnimationBarrier(), [])
  const camera = useMemo(() => new Camera(), [])
  const fxStore = useMemo(() => new FxStore(), [])
  const director = useMemo(() => new StageDirector(), [])
  // 場面のUI・共通UI・隊列の見せ方は、今なにが画面を占めているかから決まる
  const view = useSyncExternalStore(
    director.subscribe,
    director.snapshot,
    director.snapshot
  )
  const [art, setArt] = useState<string | null>(null)
  // 最後に頼まれた背景（古い頼みの読み込みが後から終わっても差し替えない）
  const artRequest = useRef(0)
  const [artboard, setArtboard] = useState<HTMLDivElement | null>(null)
  const [chrome, setChrome] = useState<HTMLDivElement | null>(null)
  const [solo, setSolo] = useState<HTMLDivElement | null>(null)
  const sceneHidden = view.scene === "hidden"
  const wideFormation = useWideFormation()

  useEffect(() => camera.start(), [camera])
  useEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new MutationObserver(cancelDetachedAnimations)
    observer.observe(element, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      exits.cancel()
      updates.cancel()
      fxStore.clear()
      cancelAnimationsWithin(element)
    }
  }, [fxStore, exits, updates])

  const api = useMemo<StageApi>(
    () => ({
      exits,
      updates,
      camera,
      fxStore,
      canvas,
      set,
      artboard,
      chrome,
      director,
      solo,
      art: async (src) => {
        const request = ++artRequest.current
        if (src) {
          try {
            await loadArtwork([src])
          } catch {
            // 読めない絵でも画面は進める（壊れた画像は CanvasImage が表示しない）
          }
        }
        if (request !== artRequest.current) return
        setArt(src)
        // 差し替えを描いてから解決する
        await nextFrame()
      },
      bars: (units) =>
        parallel(() => {
          root.current?.style.setProperty(
            "--letterbox-height",
            `${units * unitPx()}px`
          )
          for (const element of [topBar.current, bottomBar.current]) {
            if (!element) continue
            play(
              element,
              [
                { height: getComputedStyle(element).height },
                { height: `${units * unitPx()}px` },
              ],
              {
                duration: 600,
                easing: "cubic-bezier(.16,1,.3,1)",
                fill: "both",
                id: "letterbox",
              }
            )
          }
        }),
    }),
    [camera, fxStore, exits, updates, director, artboard, chrome, solo]
  )

  return (
    <StageContext.Provider value={api}>
      <div
        className="game"
        ref={root}
        style={
          {
            ...REVERT,
            "--u": `${unit}px`,
            "--bar": "0px",
            position: "fixed",
            inset: 0,
            display: "grid",
            gridTemplateRows: "1fr auto",
            overflow: "clip",
            overscrollBehavior: "none",
            background: PALETTE.ink,
            color: PALETTE.mist,
            fontFamily: FONT_FAMILY,
            fontWeight: 900,
            WebkitFontSmoothing: "antialiased",
            WebkitTapHighlightColor: "transparent",
            userSelect: "none",
            boxSizing: "border-box",
          } as CSSProperties
        }
      >
        <main
          className="canvas"
          ref={canvas}
          aria-label="場面"
          style={{
            ...REVERT,
            display: "block",
            position: "relative",
            overflow: "clip",
            background: PALETTE.ink,
          }}
        >
          <div
            className="set"
            ref={set}
            inert={backgroundInert}
            style={{ ...REVERT, position: "absolute", inset: 0 }}
          >
            <ArtSet
              key={art ?? "none"}
              src={art}
              camera={camera}
              onArtboard={setArtboard}
            />
          </div>
          {/* 場面のUIを隠す間も外さないので、状態と動きは保つ */}
          <div
            aria-hidden={sceneHidden || undefined}
            inert={sceneHidden}
            style={{
              display: "contents",
              visibility: sceneHidden ? "hidden" : undefined,
            }}
          >
            {props.children}
          </div>
          <FxLayer store={fxStore} />
          <div ref={topBar} style={{ ...LETTERBOX, top: 0 }} />
          <div
            ref={bottomBar}
            className="letterbox"
            style={{ ...LETTERBOX, bottom: 0 }}
          />
          <div
            style={{
              ...REVERT,
              position: "absolute",
              inset: 0,
              zIndex: STAGE_LAYER.vignette,
              pointerEvents: "none",
              background:
                "radial-gradient(ellipse at 50% 40%, transparent 50%, rgb(0 0 0 / 0.55)), repeating-linear-gradient(0deg, rgb(255 255 255 / 0.02) 0 1px, transparent 1px 3px)",
            }}
          />
          {/* 共通UI（設定・戻る）。黒帯と暗がりより上に出す */}
          <div
            ref={setChrome}
            data-stage-chrome=""
            style={{
              ...REVERT,
              display: "block",
              position: "absolute",
              inset: 0,
              zIndex: STAGE_LAYER.chrome,
              pointerEvents: "none",
              visibility: view.chrome === "hidden" ? "hidden" : undefined,
            }}
          />
          {/* それだけを見せる面（<Solo>）。共通UIより上 */}
          <div
            ref={setSolo}
            data-stage-solo=""
            style={{
              ...REVERT,
              display: "block",
              position: "absolute",
              inset: 0,
              zIndex: STAGE_LAYER.solo,
              pointerEvents: "none",
            }}
          />
          {props.alerts}
        </main>
        <FormationBand show={view.formation} wide={wideFormation}>
          {props.formation}
        </FormationBand>
      </div>
    </StageContext.Provider>
  )
}
