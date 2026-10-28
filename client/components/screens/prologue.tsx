import { useEffect } from "react"
import { playEventConversation } from "@/client/components/game/play-event-conversation"
import { useArrival } from "@/client/components/game/use-arrival"
import { useNav } from "@/client/components/game/use-nav"
import { useStage } from "@/client/components/stage/use-stage"
import { useWide } from "@/client/components/stage/use-wide"
import { useGame } from "@/client/contexts/use-game"
import { placeIdOf } from "@/content/looks/place-id-of"
import { sceneOf } from "@/content/looks/scene-of"

/**
 * はじめから遊ぶとき、夜明けの場面のあとに自動で進める流れ。
 * ギルドのホールで3人が冒険者の登録を決め、受付の登録用紙へ。戦闘より先に名前と容姿を決める。
 * 登録のあとは受付から街はずれへ進み、初出撃する（段階はエンジンの Query が決める）。
 */
export function Prologue() {
  const game = useGame()
  const nav = useNav()
  const stage = useStage()
  const wide = useWide()
  const art = sceneOf("guild", wide)
  useEffect(() => void stage.art(art), [stage, art])
  const ready = useArrival(art, "crane", 5, async (signal) => {
    if (game.queries.prologue(game.state) !== "register") return
    await playEventConversation(game, "visit", signal, {
      place: placeIdOf("guild"),
    })
  })
  useEffect(() => {
    if (!ready) return
    const step = game.queries.prologue(game.state)
    // 切り替えは flushSync するので、effect を抜けて描画が終わってから始める
    void Promise.resolve().then(() =>
      step === "register"
        ? nav.go({ name: "place", place: "reception" }, { enter: "none" })
        : step === "depart"
          ? nav.go({ name: "outskirts" }, { enter: "none" })
          : nav.go({ name: "town", intro: true })
    )
  }, [game, nav, ready])
  return null
}
