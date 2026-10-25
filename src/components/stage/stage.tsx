import { loadArtwork } from "@/lib/game-client/artwork"
import {
  AnimationBarrier,
  nextFrame,
  parallel,
} from "@/components/canvas/animation"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react"
import { motion } from "motion/react"
import { Camera } from "@/components/stage/camera"
import { FxLayer, FxStore } from "@/components/stage/fx"
import { seconds, unitPx, UNIT_STEPS } from "@/components/stage/kit"
import { useWideFormation } from "@/components/stage/word"
import { CanvasImage } from "@/components/canvas/primitives"
import {
  FONT_FAMILY,
  PALETTE,
  REVERT,
  STAGE_LAYER,
} from "@/components/canvas/tokens"

/** 映画の黒帯。高さは --bar（場面ごとに stage.bars で変える）。 */
const LETTERBOX: CSSProperties = {
  ...REVERT,
  position: "absolute",
  left: 0,
  right: 0,
  height: "var(--bar)",
  background: "#000",
  zIndex: STAGE_LAYER.letterbox,
  pointerEvents: "none",
}
import { StageContext, type StageApi } from "@/components/stage/stage-context"
import { StageDirector, type FormationShow } from "@/components/stage/director"
import {
  play,
  cancelDetachedAnimations,
  cancelAnimationsWithin,
} from "@/components/canvas/play"

/** カメラが動かす奥行きの層。 */
const LAYER: CSSProperties = {
  ...REVERT,
  position: "absolute",
  inset: "-18%",
  willChange: "transform, filter",
  transformOrigin: "50% 55%",
  pointerEvents: "none",
}
const LAYER_SVG: CSSProperties = {
  ...REVERT,
  display: "block",
  width: "100%",
  height: "100%",
}

/** 隊列は一列。横長の画面のときは低く、縦長のときは札を縦長にするので高く。 */
function formationHeight(wide: boolean) {
  return wide ? "13vh" : "24vh"
}

/** 下の隊列の帯。見せ方（StageDirector が決める）に合わせて下げる・畳む。 */
function FormationBand({
  show,
  wide,
  children,
}: {
  show: FormationShow
  wide: boolean
  children: ReactNode
}) {
  const folded = show === "folded" || show === "gone"
  const gone = show === "gone"
  // 引っ込めるときは加速して落とし、戻すときは少し弾ませる
  const transition = {
    duration: seconds(show === "shown" ? 480 : 380),
    ease:
      show === "shown"
        ? ([0.34, 1.1, 0.64, 1] as const)
        : ([0.7, 0, 0.84, 0] as const),
  }
  return (
    <motion.nav
      className="formation"
      aria-label="隊列"
      aria-hidden={gone || undefined}
      inert={gone}
      initial={false}
      animate={{
        height: folded ? "0vh" : formationHeight(wide),
        y: show === "lowered" ? "110%" : "0%",
        // 札は帯の外へはみ出して描くので、何も見せないときは畳み終えてから消す
        ...(gone
          ? { transitionEnd: { visibility: "hidden" as const } }
          : { visibility: "visible" as const }),
      }}
      transition={transition}
      style={{
        ...REVERT,
        display: "block",
        position: "relative",
        zIndex: STAGE_LAYER.formation,
      }}
    >
      {children}
    </motion.nav>
  )
}

/** 一枚絵の場面。絵を奥、光と手前の影を前に置いてカメラで撮る。 */
function ArtSet({
  src,
  camera,
  onArtboard,
}: {
  src: string | null
  camera: Camera
  onArtboard: (element: HTMLDivElement | null) => void
}) {
  const layers = useRef<(HTMLDivElement | null)[]>([])
  const registerArtboard = useCallback(
    (element: HTMLDivElement | null) => {
      layers.current[0] = element
      onArtboard(element)
    },
    [onArtboard]
  )
  useLayoutEffect(() => {
    const depths = [0.5, 0.9, 1.6]
    const offs = layers.current.map((el, i) =>
      el ? camera.add(el, depths[i]) : () => {}
    )
    return () => {
      for (const off of offs) off()
    }
  }, [camera, src])
  return (
    <>
      <div
        className="layer"
        ref={registerArtboard}
        style={{ ...LAYER, inset: "-7%" }}
      >
        {src ? (
          <CanvasImage
            src={src}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{ width: "100%", height: "100%", background: "#0b0c12" }}
          />
        )}
      </div>
      <div
        className="layer"
        ref={(el) => void (layers.current[1] = el)}
        style={LAYER}
      >
        <svg
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
          style={LAYER_SVG}
        >
          <polygon
            points="1000,0 1180,0 1560,1000 1260,1000"
            fill="#dcdee5"
            opacity=".08"
          />
        </svg>
      </div>
      <div
        className="layer"
        ref={(el) => void (layers.current[2] = el)}
        style={LAYER}
      >
        <svg
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
          style={LAYER_SVG}
        >
          <defs>
            <radialGradient id="vg" cx=".5" cy=".45" r=".7">
              <stop offset=".55" stopColor="#0b0c12" stopOpacity="0" />
              <stop offset="1" stopColor="#0b0c12" stopOpacity=".85" />
            </radialGradient>
          </defs>
          <rect width="1600" height="1000" fill="url(#vg)" />
        </svg>
      </div>
    </>
  )
}

/**
 * 画面は常に映画の一場面。奥行きのある層・操作・エフェクト・黒帯・粒子を重ね、下端に隊列（Formation）を置く。
 */
function subscribeResize(listener: () => void) {
  addEventListener("resize", listener)
  return () => removeEventListener("resize", listener)
}

export function Stage({
  children,
  formation,
}: {
  children: ReactNode
  formation: ReactNode
}) {
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
            {children}
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
        </main>
        <FormationBand show={view.formation} wide={wideFormation}>
          {formation}
        </FormationBand>
      </div>
    </StageContext.Provider>
  )
}
