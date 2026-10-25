import { nextFrame, parallel } from "@/components/canvas/animation"
import { animationTiming } from "@/components/stage/timing"
import { useRef, useState } from "react"
import { layerSceneArt, sceneOf } from "@/lib/content/looks"
import { useArrival, useNav } from "@/components/game/nav"
import { Battle } from "@/components/screens/battle"
import { ease } from "@/components/stage/camera"
import { COLOR } from "@/components/stage/kit"
import { useStage } from "@/components/stage/stage-context"
import { useFx } from "@/components/stage/use-fx"
import { useWide } from "@/components/stage/word"
import { useGame, useGameState } from "@/contexts/game"
import { Layer } from "./layer"

/** 大渓谷の層。着いた地点から道のり図を走り、戦闘に入り、戻ってくる。 */
export function Expedition() {
  const game = useGame()
  const state = useGameState()
  const stage = useStage()
  const nav = useNav()
  const fx = useFx()
  const screen = nav.screen.name === "expedition" ? nav.screen : null
  const lastLayer = useRef<string | null>(null)
  const here = game.queries.expedition(state)
  if (here) lastLayer.current = here.layer
  const layer = lastLayer.current
  const [mode, setMode] = useState<"layer" | "battle">(
    state.phase.type === "battle" ? "battle" : "layer"
  )
  const [intro, setIntro] = useState(true)
  const wide = useWide()
  const scene = game.queries.scene(state)
  const art =
    (layer ? layerSceneArt(layer, scene?.key, wide) : undefined) ??
    sceneOf("outskirts")
  const ready = useArrival(
    art,
    screen?.descent ? "none" : "crane",
    4,
    async (signal) => {
      if (!screen?.descent) return
      stage.camera.cut({ x: 0, y: 180, z: 1.5, r: -4, blur: 12 })
      await nextFrame(signal)
      fx.flash(COLOR.mist, 0.8)
      screen.descent()
      stage.camera.shake(1.6)
      await parallel(
        () =>
          stage.camera.to(
            { x: 0, y: 0, z: 1, r: 0, blur: 0 },
            animationTiming.arrival,
            ease.soft
          ),
        signal
      )
    }
  )
  if (!ready || !layer) return null
  if (mode === "battle")
    return (
      <Battle
        onEnd={(result) => {
          setIntro(false)
          if (result !== "victory") return
          // 戦闘用の背景から、いまの地点の背景へ戻す
          void stage.art(art)
          setMode("layer")
        }}
      />
    )
  if (!here) return null
  return <Layer intro={intro} onBattle={() => setMode("battle")} />
}
