import { flushSync } from "react-dom"
import { useStage } from "@/components/stage/stage-context"
import { parallel, nextFrame } from "@/components/canvas/animation"
import { useRef, type Dispatch, type SetStateAction } from "react"
import type { useFormation } from "@/components/game/formation"
import {
  DEMON_ART,
  frameOf,
  skillPortraitOf,
  specialArtOf,
} from "@/lib/content/looks"
import { COLOR, isAborted } from "@/components/stage/kit"
import type { Fx } from "@/components/stage/use-fx"
import { GameCommandError, eventsOf, inPhase, type Game } from "@/lib/wiz"
import { play } from "@/components/canvas/play"
import { loadArtwork } from "@/lib/game-client/artwork"
import { foeAppearance, foeAttackImage } from "@/lib/content/foe-appearance"
import type { BattleDirector } from "@/components/screens/battle/director"
import type { BattleParts } from "@/components/screens/battle/parts"
import type {
  Acted,
  BattleView,
  FoeAttack,
  Menu,
} from "@/components/screens/battle/types"

/** 仲間の指示。誰を狙うかは呼ぶ側が決める。 */
export type ActInput =
  | { command: "guard" | "brawl" }
  | { command: "skill"; skill: string; target?: string }
  | { command: "item"; good: string; target?: string }
  | { command: "pact"; mode: number }

type BattleTurnsDeps = {
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
export function useBattleTurns(deps: BattleTurnsDeps) {
  const {
    game,
    fx,
    wide,
    formation,
    parts,
    director,
    signal: signalOf,
    actorId,
    aim,
    current,
    setMenu,
    setAttacking,
    setSettled,
  } = deps
  const busy = useRef(false)
  const stage = useStage()
  const revealParty = async (signal: AbortSignal) => {
    if (signal.aborted) return
    flushSync(() => formation.freeze(false))
    await nextFrame(signal)
    await stage.updates.wait()
  }

  const foeTurn = async () => {
    if (busy.current || !current || current.kind !== "foe") return
    busy.current = true
    const signal = signalOf()
    const foeId = current.id
    try {
      // effect の中から呼ばれるので、描画が終わってから flushSync する
      await Promise.resolve()
      if (signal.aborted) return
      formation.lift(null)
      const battle = game.queries.battle(game.state)
      // 結果は先にエンジンで一度だけ決める。表示HPは演出完了まで直前の値を保つ。
      flushSync(() => formation.freeze(true))
      const events = eventsOf(inPhase(game, "foe-turn")?.resolve())
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
      if (image) await loadArtwork([image])
      if (signal.aborted) return
      flushSync(() => setAttacking({ id: foeId, skill: acted?.skill }))
      await nextFrame(signal)
      await parallel(
        () =>
          play(
            parts.foe(foeId),
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
        const c = parts.foeCenter(foeId)
        await parallel(
          () =>
            fx.numberAt(c.x, c.y - c.h * 0.35, acted.name, {
              size: 7,
              color: COLOR.paper,
            }),
          signal
        )
      }
      if (acted)
        await director.playResults(
          acted,
          false,
          events.some((event) => event.type === "victory")
        )
      if (signal.aborted) return
      setAttacking(null)
      await director.playAfter(events, signal)
      await revealParty(signal)
      if (signal.aborted) return
      await director.finish(events)
    } catch (error) {
      if (!isAborted(error)) throw error
    } finally {
      if (!signal.aborted) {
        formation.freeze(false)
        setAttacking(null)
        busy.current = false
        setSettled((n) => n + 1)
      }
    }
  }

  const act = async (input: ActInput) => {
    if (busy.current || !actorId) return
    busy.current = true
    setMenu(null)
    const signal = signalOf()
    const actor = actorId
    try {
      flushSync(() => formation.freeze(true))
      const turn = inPhase(game, "member-turn")
      const events = eventsOf(
        input.command === "brawl"
          ? turn?.brawl(aim ?? undefined)
          : input.command === "guard"
            ? turn?.guard()
            : input.command === "skill"
              ? turn?.skill(input.skill, input.target ?? aim ?? undefined)
              : input.command === "item"
                ? turn?.item(input.good, input.target ?? aim ?? undefined)
                : input.command === "pact"
                  ? turn?.pact(input.mode)
                  : null
      )
      if (events instanceof GameCommandError) {
        fx.shake(0.6)
        setMenu("command")
        return
      }
      const acted = events.find(
        (event): event is Acted => event.type === "acted"
      )
      if (!acted) return
      if (input.command === "skill") {
        const member = game.queries.member(game.state, actor)
        const look = game.queries.look(game.state, actor)
        const frame = frameOf(
          look,
          member?.armor?.good,
          member?.pact?.find((mode) => mode.current)?.index
        )
        const demon = member?.hero ? game.queries.demon(game.state) : null
        // 合体している悪魔がいれば、その立ち絵でワザを見せる
        if (demon) {
          const art = DEMON_ART[demon.id]
          const image = skillPortraitOf(demon.id, input.skill)
          await loadArtwork([image])
          if (signal.aborted) return
          await parallel(
            () =>
              fx.special(image, art?.fx ?? 0.5, acted.name, wide, demon.name),
            signal
          )
        } else {
          // 必殺技の専用イラストがあればそれを、なければ今の立ち絵を出す
          const special = specialArtOf(look, input.skill)
          if (special) {
            await loadArtwork([special])
            if (signal.aborted) return
          }
          await parallel(
            () =>
              fx.special(
                special ?? frame.img,
                special ? 0.5 : frame.fx,
                acted.name,
                wide
              ),
            signal
          )
        }
      }
      if (input.command === "pact") {
        // ケイヤク：モード名を見せ、状態更新に合わせて各表示の立ち絵も切り替える
        const q = parts.memberCenter(game.state.party, actor)
        await parallel(
          () =>
            fx.numberAt(
              q.x,
              fx.size().height * 0.5,
              `ケイヤク：${acted.name}`,
              {
                size: 7,
              }
            ),
          signal
        )
      }
      if (input.command === "item") {
        const q = parts.memberCenter(game.state.party, actor)
        await parallel(
          () =>
            fx.numberAt(q.x, fx.size().height * 0.5, acted.name, { size: 7 }),
          signal
        )
      }
      if (signal.aborted) return
      await director.playResults(
        acted,
        input.command === "skill",
        events.some((event) => event.type === "victory")
      )
      if (signal.aborted) return
      await director.playAfter(events, signal)
      await revealParty(signal)
      if (signal.aborted) return
      await director.finish(events)
    } catch (error) {
      if (!isAborted(error)) throw error
    } finally {
      if (!signal.aborted) {
        formation.freeze(false)
        busy.current = false
        setSettled((n) => n + 1)
      }
    }
  }

  return { act, foeTurn, busy }
}
