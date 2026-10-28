import { useEffect } from "react"
import { motion } from "motion/react"
import {
  PALETTE,
  REVERT,
  UI_LAYER,
  unit,
} from "@/client/components/canvas/tokens"
import { playEventConversation } from "@/client/components/game/play-event-conversation"
import { useArrival } from "@/client/components/game/use-arrival"
import { useNav } from "@/client/components/game/use-nav"
import { useStage } from "@/client/components/stage/use-stage"
import { useWide } from "@/client/components/stage/use-wide"
import { useGame } from "@/client/contexts/use-game"
import { placeName } from "@/content/looks/place-name"
import { sceneOf } from "@/content/looks/scene-of"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { inPhase } from "@/lib/wiz/phases/in-phase"

/**
 * はじめから遊ぶときの開幕。夜明け前の宿の屋根裏で、ロクスと話す。
 * 見終えたら最初の仕事（Prologue）へ。名前と容姿はそのあと、ギルドの登録用紙で決める。台本の選択と既読は Game が持つ。
 */
export function Create() {
  const game = useGame()
  const nav = useNav()
  const stage = useStage()
  const wide = useWide()
  const art = sceneOf("attic", wide)
  // 画面の幅が変わって絵が替わったときも、読み込んでから差し替える
  useEffect(() => void stage.art(art), [stage, art])
  // 開幕の場面は続けて流す。始まらなければ打ち切る
  const ready = useArrival(art, "crane", 5, async (signal) => {
    for (let scene = 0; scene < 4 && !signal.aborted; scene++) {
      if (!game.queries.canStartConversation(game.state, "opening")) return
      const before = game.state
      await playEventConversation(game, "opening", signal)
      if (game.state === before) return
    }
  })

  useEffect(() => {
    if (!ready) return
    const left = inPhase(game, "creating")?.leaveCamp()
    if (!left || left instanceof GameCommandError) return
    // 切り替えは flushSync するので、effect を抜けて描画が終わってから始める
    void Promise.resolve().then(() =>
      nav.go(
        { name: "prologue" },
        { exit: { z: 2.1, blur: 16, ms: 420 }, enter: "none" }
      )
    )
  }, [game, nav, ready])

  return (
    <div className="ui-layer create" style={UI_LAYER}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        style={{
          ...REVERT,
          display: "block",
          position: "absolute",
          zIndex: 22,
          top: wide ? "8%" : "6%",
          left: wide ? "6%" : "6%",
          fontSize: unit(2.6),
          letterSpacing: ".3em",
          color: PALETTE.sage,
          textShadow: `0 0 ${unit(1)} ${PALETTE.ink}`,
          pointerEvents: "none",
        }}
      >
        {placeName("attic")}
      </motion.div>
    </div>
  )
}
