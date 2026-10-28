import { flushSync } from "react-dom"
import { useStage } from "@/client/components/stage/use-stage"
import { parallel } from "@/client/components/canvas/parallel"
import { nextFrame } from "@/client/components/canvas/next-frame"
import { useRef, type Dispatch, type SetStateAction } from "react"
import type { useFormation } from "@/client/components/game/formation/context"
import { DEMON_ART } from "@/content/looks/combat-art"
import { frameOf } from "@/content/looks/frame-of"
import { skillPortraitOf } from "@/content/looks/skill-portrait-of"
import { specialArtOf } from "@/content/looks/special-art-of"
import { COLOR } from "@/client/components/stage/kit"
import { isAborted } from "@/client/components/stage/is-aborted"
import type { Fx } from "@/client/components/stage/use-fx"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { eventsOf } from "@/lib/wiz/phases/events-of"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import type { Game } from "@/lib/wiz/game/game"
import { play } from "@/client/components/canvas/play"
import { loadBattleArtwork } from "./artwork"
import { foeAppearance } from "@/content/foe-appearance"
import { foeAttackImage } from "@/content/foe-attack-image"
import type { BattleDirector } from "@/client/components/screens/battle/director"
import type { BattleParts } from "@/client/components/screens/battle/parts"
import type {
  Acted,
  BattleView,
  FoeAttack,
  Menu,
} from "@/client/components/screens/battle/types"

/** 仲間の指示。誰を狙うかは呼ぶ側が決める。 */
export type ActInput =
  | { command: "guard" | "brawl" }
  | { command: "skill"; skill: string; target?: string }
  | { command: "item"; good: string; target?: string }
  | { command: "pact"; mode: number }

type Props = {
  game: Game
  fx: Fx
  wide: boolean
  formation: ReturnType<typeof useFormation>
  parts: BattleParts
  director: BattleDirector
  /** 今の中断の合図（画面を離れたら止める）。 */
  signal: () => AbortSignal
  /** 手番の仲間。敵の手番なら null。 */
  actorId: string | null
  /** 狙っている敵。 */
  aim: string | null
  /** 今の手番の持ち主。 */
  current: BattleView["current"] | null
  setMenu: Dispatch<SetStateAction<Menu>>
  setAttacking: Dispatch<SetStateAction<FoeAttack | null>>
  setSettled: Dispatch<SetStateAction<number>>
}

/**
 * 戦闘の入力。仲間の指示と敵の手番をエンジンへ送り、返ってきた出来事を演出へ渡す。
 * 見せ方は持たない（それは再生の側）。
 */
export function useBattleTurns(props: Props) {
  const busy = useRef(false)
  const stage = useStage()
  const revealParty = async (signal: AbortSignal) => {
    if (signal.aborted) return
    flushSync(() => props.formation.freeze(false))
    await nextFrame(signal)
    await stage.updates.wait()
  }

  const foeTurn = async () => {
    if (busy.current || !props.current || props.current.kind !== "foe") return
    busy.current = true
    const signal = props.signal()
    const foeId = props.current.id
    try {
      // effect の中から呼ばれるので、描画が終わってから flushSync する
      await Promise.resolve()
      if (signal.aborted) return
      props.formation.lift(null)
      const battle = props.game.queries.battle(props.game.state)
      // 結果は先にエンジンで一度だけ決める。表示HPは演出完了まで直前の値を保つ。
      flushSync(() => props.formation.freeze(true))
      const events = eventsOf(inPhase(props.game, "foe-turn")?.resolve())
      if (events instanceof GameCommandError) return
      const acted = events.find(
        (event): event is Acted => event.type === "acted"
      )
      const foe = battle?.foes.find((entry) => entry.id === foeId)
      const image = foe
        ? foeAttackImage(foeAppearance(foe.foe, foe.appearanceId), {
            skill: acted?.skill,
          })
        : undefined
      const loaded = !image || (await loadBattleArtwork([image]))
      if (signal.aborted) return
      // 攻撃用の絵が読めなければ、通常の立ち絵で攻撃動作と結果を見せる。
      if (loaded)
        flushSync(() => props.setAttacking({ id: foeId, skill: acted?.skill }))
      await nextFrame(signal)
      await parallel(
        () =>
          play(
            props.parts.foe(foeId),
            [
              { transform: "none" },
              { transform: "translateY(6vh) scale(1.12)", offset: 0.3 },
              { transform: "none" },
            ],
            { duration: 420 }
          ),
        signal
      )
      if (signal.aborted) return
      if (acted) {
        const c = props.parts.foeCenter(foeId)
        await parallel(
          () =>
            props.fx.numberAt(c.x, c.y - c.h * 0.35, acted.name, {
              size: 7,
              color: COLOR.paper,
            }),
          signal
        )
      }
      if (acted)
        await props.director.playResults(
          acted,
          false,
          events.some((event) => event.type === "victory")
        )
      if (signal.aborted) return
      props.setAttacking(null)
      await props.director.playAfter(events, signal)
      await revealParty(signal)
      if (signal.aborted) return
      await props.director.finish(events)
    } catch (error) {
      if (!isAborted(error)) throw error
    } finally {
      if (!signal.aborted) {
        props.formation.freeze(false)
        props.setAttacking(null)
        busy.current = false
        props.setSettled((n) => n + 1)
      }
    }
  }

  const act = async (input: ActInput) => {
    if (busy.current || !props.actorId) return
    busy.current = true
    props.setMenu(null)
    const signal = props.signal()
    const actor = props.actorId
    try {
      flushSync(() => props.formation.freeze(true))
      const turn = inPhase(props.game, "member-turn")
      const events = eventsOf(
        input.command === "brawl"
          ? turn?.brawl(props.aim ?? undefined)
          : input.command === "guard"
            ? turn?.guard()
            : input.command === "skill"
              ? turn?.skill(input.skill, input.target ?? props.aim ?? undefined)
              : input.command === "item"
                ? turn?.item(input.good, input.target ?? props.aim ?? undefined)
                : input.command === "pact"
                  ? turn?.pact(input.mode)
                  : null
      )
      if (events instanceof GameCommandError) {
        props.fx.shake(0.6)
        props.setMenu("command")
        return
      }
      const acted = events.find(
        (event): event is Acted => event.type === "acted"
      )
      if (!acted) return
      if (input.command === "skill") {
        const member = props.game.queries.member(props.game.state, actor)
        const look = props.game.queries.look(props.game.state, actor)
        const frame = frameOf(
          look,
          member?.armor?.good,
          member?.pact?.find((mode) => mode.current)?.index
        )
        const demon = member?.hero
          ? props.game.queries.demon(props.game.state)
          : null
        // 合体中は悪魔、それ以外は専用イラストか今の立ち絵を出す。
        const special = specialArtOf(look, input.skill)
        const image = demon
          ? skillPortraitOf(demon.id, input.skill)
          : (special ?? frame.img)
        const focus = demon
          ? (DEMON_ART[demon.id]?.fx ?? 0.5)
          : special
            ? 0.5
            : frame.fx
        const loaded = await loadBattleArtwork([image])
        if (signal.aborted) return
        await parallel(() => {
          if (loaded)
            return props.fx.special(
              image,
              focus,
              acted.name,
              props.wide,
              demon?.name
            )
          const q = props.parts.memberCenter(props.game.state.party, actor)
          return props.fx.numberAt(
            q.x,
            props.fx.size().height * 0.5,
            acted.name,
            {
              size: 7,
            }
          )
        }, signal)
      }
      if (input.command === "pact") {
        // ケイヤク：モード名を見せ、状態更新に合わせて各表示の立ち絵も切り替える
        const q = props.parts.memberCenter(props.game.state.party, actor)
        await parallel(
          () =>
            props.fx.numberAt(
              q.x,
              props.fx.size().height * 0.5,
              `ケイヤク：${acted.name}`,
              {
                size: 7,
              }
            ),
          signal
        )
      }
      if (input.command === "item") {
        const q = props.parts.memberCenter(props.game.state.party, actor)
        await parallel(
          () =>
            props.fx.numberAt(q.x, props.fx.size().height * 0.5, acted.name, {
              size: 7,
            }),
          signal
        )
      }
      if (signal.aborted) return
      await props.director.playResults(
        acted,
        input.command === "skill",
        events.some((event) => event.type === "victory")
      )
      if (signal.aborted) return
      await props.director.playAfter(events, signal)
      await revealParty(signal)
      if (signal.aborted) return
      await props.director.finish(events)
    } catch (error) {
      if (!isAborted(error)) throw error
    } finally {
      if (!signal.aborted) {
        props.formation.freeze(false)
        busy.current = false
        props.setSettled((n) => n + 1)
      }
    }
  }

  return { act, foeTurn, busy }
}
