import { after } from "@/client/components/canvas/after"
import { hold } from "@/client/components/canvas/hold"
import { parallel } from "@/client/components/canvas/parallel"
import type { Playback } from "@/client/components/canvas/animation"
import { animationTiming } from "@/client/components/stage/timing"
import { attackEffect, statusEffects } from "./effects"
import { COLOR } from "@/client/components/stage/kit"
import type { ActionResult } from "@/lib/wiz/state/action-result"
import { play } from "@/client/components/canvas/play"
import {
  STATUS_WORDS,
  type Acted,
} from "@/client/components/screens/battle/types"
import type { BattleDirectorDeps } from "./director-context"

type ResultCallbacks = {
  recordFoeHp: (foeId: string, to: number) => void
  knockOut: (foeId: string, delay: number) => Playback
}

/** 一つの行動の被害・回復・状態変化を再生する。 */
export function playBattleResults(
  deps: BattleDirectorDeps,
  acted: Acted,
  big: boolean,
  over: boolean,
  callbacks: ResultCallbacks
) {
  const { fx, game, parts, view, shownHp } = deps
  const { width, height } = fx.size()
  const results: readonly ActionResult[] = acted.results
  const impact = attackEffect(
    acted.skill ? game.queries.skill(acted.skill) : undefined,
    acted.good ? game.queries.good(acted.good) : undefined
  )
  const resultsPlayback = parallel(() => {
    // 自分を削って放つワザ（悪魔の流派）は、まず払ったHPを見せる
    if (acted.paid && acted.actor.kind === "member") {
      const self = parts.memberCenter(game.state.party, acted.actor.id)
      fx.numberAt(self.x, height * 0.72, `代償 −${acted.paid}`, {
        size: 8,
        color: COLOR.blood,
      })
    }
    for (const [i, result] of [...results].entries()) {
      const delay = i * animationTiming.stagger
      const ref = result.target
      if (ref.kind === "foe") {
        const foe = view?.foes.find((entry) => entry.id === ref.id)
        const c = parts.foeCenter(ref.id)
        let damagePlayback: Playback | undefined
        if (result.blocked && !result.damage) {
          fx.comic("comic-guard", c.x, c.y, c.w * 0.8, {
            delay,
            text: "防がれた！",
          })
        } else if (result.damage !== undefined && acted.command !== "guard") {
          const from = shownHp[ref.id] ?? foe?.hp ?? 0
          const to = result.down ? 0 : Math.max(0, from - result.damage)
          fx.hitStop(big ? 1.6 : 1)
          fx.comic(
            result.blocked ? "comic-guard" : impact,
            c.x,
            c.y - c.h * 0.22,
            c.w * (big ? 1.05 : 0.85),
            { delay, text: result.blocked ? "防がれた！" : undefined }
          )
          fx.shards(c.x, c.y, {
            n: big ? 22 : 12,
            power: big ? 1.4 : 1,
            delay: delay + 90,
          })
          if (big && i === 0) fx.focusLines(c.x, c.y, { dur: 500 })
          play(
            parts.foe(ref.id),
            [
              { transform: "none", filter: "brightness(3)" },
              {
                transform: "translateX(3vw) scale(.94)",
                filter: "brightness(2)",
                offset: 0.25,
              },
              { transform: "none", filter: "brightness(1)" },
            ],
            { duration: 380, delay: delay + animationTiming.impact }
          )
          fx.shake(big ? 1.8 : 1)
          const damage = fx.damageAt(c.x, c.y + c.h * 0.22, result.damage, {
            big: impact === "comic-critical",
            delay: delay + animationTiming.impact,
          })
          damagePlayback = damage
          after(
            damage,
            () => {
              callbacks.recordFoeHp(ref.id, to)
              if (result.down && !over) callbacks.knockOut(ref.id, 0)
            },
            deps.signal()
          )
        }
        if (result.heal) {
          fx.comic("comic-heal", c.x, c.y - c.h * 0.12, c.w * 0.8, { delay })
          fx.numberAt(c.x, c.y, `+${result.heal}`, {
            size: 10,
            color: COLOR.sage,
            delay,
          })
        }
        if (result.status || result.resisted) {
          // 飛んでいるダメージ数字に状態の文字を重ねない。
          const showStatus = () => {
            const statusDelay = damagePlayback ? 0 : delay
            if (result.status)
              fx.comic(
                statusEffects[result.status],
                c.x,
                c.y - c.h * 0.2,
                c.w * 0.8,
                { text: STATUS_WORDS[result.status], delay: statusDelay }
              )
            if (result.resisted)
              fx.numberAt(c.x, c.y - c.h * 0.3, "効かない", {
                size: 6,
                delay: statusDelay,
              })
          }
          if (damagePlayback) after(damagePlayback, showStatus, deps.signal())
          else showStatus()
        }
        continue
      }
      const q = parts.memberCenter(game.state.party, ref.id)
      if (result.missed) {
        fx.numberAt(q.x, height * 0.74, "外れた", {
          size: 7,
          color: COLOR.paper,
          delay,
        })
        continue
      }
      if (result.blocked && !result.damage) {
        fx.comic("comic-guard", q.x, height * 0.74, q.w * 1.2, {
          delay,
          text: "守った！",
        })
      } else if (result.damage !== undefined && result.damage > 0) {
        const guarded = !!result.guarded
        // 防具の耐久で受けた分と、HP（生命力）へ届いた分を分けて見せる
        const onArmor = result.armor ?? 0
        const onHp = result.damage - onArmor
        fx.flash(COLOR.blood, guarded ? 0.25 : 0.5)
        fx.shake(guarded ? 0.8 : 1.8)
        fx.hitStop(guarded ? 0.5 : 1.2)
        fx.comic(
          result.broke
            ? "comic-armor-break"
            : guarded || result.blocked
              ? "comic-guard"
              : impact,
          q.x,
          height * (result.broke ? 0.66 : 0.78),
          q.w * 1.2,
          { delay }
        )
        fx.shards(q.x, height * 0.82, { n: 12, delay })
        if (onArmor > 0)
          fx.numberAt(q.x, height * 0.7, `防具 −${onArmor}`, {
            size: 7,
            color: COLOR.dusk,
            delay,
          })
        if (onHp > 0)
          fx.numberAt(q.x, height * 0.78, `−${onHp}`, {
            size: 12,
            color: COLOR.lavender,
            delay: delay + (onArmor > 0 ? 220 : 0),
          })
        if (result.broke) {
          fx.shake(1.4)
          // 札の端の仲間でも文字が画面から切れないよう、中央寄りへ寄せる
          fx.numberAt(
            Math.min(Math.max(q.x, width * 0.32), width * 0.68),
            height * 0.58,
            "防具が砕けた",
            { size: 5, color: COLOR.paper, delay: delay + 200 }
          )
        }
        // 守りの加護で減ったときは「守った！」、防御で減ったときは「ガード！」
        if (result.blocked)
          fx.numberAt(q.x, height * 0.64, "守った！", {
            size: 6,
            color: COLOR.paper,
            delay: delay + 80,
          })
        else if (guarded)
          fx.numberAt(q.x, height * 0.64, "ガード！", {
            size: 6,
            color: COLOR.paper,
            delay: delay + 80,
          })
        if (result.down)
          fx.numberAt(q.x, height * 0.56, "たおれた", {
            size: 6,
            color: COLOR.paper,
            delay: delay + 300,
          })
      } else if (result.guarded && acted.command === "guard") {
        fx.comic("comic-guard", q.x, height * 0.55, q.w * 1.3, {
          delay,
          text: "防御",
        })
      }
      if (result.repaired !== undefined) {
        fx.numberAt(q.x, q.y - q.h, `防具 +${result.repaired}`, {
          size: 9,
          color: COLOR.dusk,
          delay,
        })
        fx.comic("comic-repair", q.x, q.y - q.h * 0.6, q.w * 1.2, {
          delay,
        })
      }
      if (
        result.heal !== undefined ||
        result.refill !== undefined ||
        result.revived
      ) {
        fx.flash(COLOR.sage, 0.35)
        const label = result.revived
          ? "復活！"
          : result.heal !== undefined
            ? `+${result.heal}`
            : `残り+${result.refill}`
        fx.numberAt(q.x, q.y - q.h, label, {
          size: 10,
          color: COLOR.sage,
          delay,
        })
        fx.comic(
          result.revived
            ? "comic-revive"
            : result.cured?.length
              ? "comic-purify"
              : "comic-heal",
          q.x,
          q.y - q.h * 0.6,
          q.w * 1.2,
          { delay }
        )
        fx.shards(q.x, q.y, {
          n: 8,
          colors: [COLOR.paper, COLOR.sage],
          power: 0.7,
          delay,
        })
      }
      if (result.status)
        fx.comic(
          statusEffects[result.status],
          q.x,
          q.y - q.h * 0.8,
          q.w * 1.2,
          {
            text: STATUS_WORDS[result.status],
            delay: delay + 300,
          }
        )
      if (result.resisted)
        fx.numberAt(q.x, q.y - q.h * 1.4, "効かない", {
          size: 6,
          delay: delay + 300,
        })
      if (result.cured?.length) {
        if (result.heal === undefined && !result.revived)
          fx.comic("comic-purify", q.x, q.y - q.h * 0.6, q.w * 1.2, { delay })
        fx.numberAt(q.x, q.y - q.h * 1.2, "治った！", {
          size: 7,
          color: COLOR.sage,
          delay: delay + 200,
        })
      }
    }
  }, deps.signal())
  return after(
    resultsPlayback,
    () => hold(animationTiming.resultPause),
    deps.signal()
  )
}
