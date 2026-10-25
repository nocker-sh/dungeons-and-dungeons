import {
  after,
  hold,
  nextFrame,
  parallel,
  type Playback,
} from "@/components/canvas/animation"
import { animationTiming } from "@/components/stage/timing"
import type { Dispatch, SetStateAction } from "react"
import { comicEffects } from "@/components/canvas/comic-effect"
import { loadArtwork } from "@/lib/game-client/artwork"
import { attackEffect, statusEffects } from "./effects"
import type { useFormation } from "@/components/game/formation"
import type { useNav } from "@/components/game/nav"
import { ease } from "@/components/stage/camera"
import { COLOR, EASE_IN, EASE_OUT } from "@/components/stage/kit"
import type { StageApi } from "@/components/stage/stage-context"
import type { Fx } from "@/components/stage/use-fx"
import {
  STATUS_NAMES,
  type ActionResult,
  type Game,
  type GameEvent,
} from "@/lib/wiz"
import { play } from "@/components/canvas/play"
import type { BattleParts } from "@/components/screens/battle/parts"
import {
  STATUS_WORDS,
  type Acted,
  type BattlePhase,
  type BattleView,
  type Menu,
} from "@/components/screens/battle/types"

type BattleDirectorDeps = {
  game: Game
  fx: Fx
  stage: StageApi
  nav: ReturnType<typeof useNav>
  formation: ReturnType<typeof useFormation>
  parts: BattleParts
  view: BattleView | null
  /** 戦う場所の背景（エンジンの戦う場所から作品のデータで引いた絵）。 */
  scene: string | null
  gone: readonly string[]
  shownHp: Record<string, number>
  /** 今の中断の合図（画面を離れたら止める）。 */
  signal: () => AbortSignal
  onEnd: (result: "victory" | "defeat") => void
  setPhase: Dispatch<SetStateAction<BattlePhase>>
  setMenu: Dispatch<SetStateAction<Menu>>
  setPeek: Dispatch<SetStateAction<string | null>>
  setShownHp: Dispatch<SetStateAction<Record<string, number>>>
  setGone: Dispatch<SetStateAction<string[]>>
}

/**
 * 戦闘の再生の順序。突入の演出、敵の落下、被害と回復の見せ方、手番の終わり、勝敗までを受け持つ。
 * どの指示を送るかは決めない（それは入力の側）。
 */
export class BattleDirector {
  constructor(private readonly deps: BattleDirectorDeps) {}

  /** 突入：閃光、ぶれ、景色が暗く寄る → 敵が落ちてくる */
  async intro(signal: AbortSignal) {
    const { fx, stage, view, scene, parts, setPhase } = this.deps
    await Promise.all([
      loadArtwork(comicEffects.map((effect) => effect.image)),
      // 戦闘用の背景へ差し替える（読み込みが済んだら一度に替わる。突入の演出とは並行）
      scene ? stage.art(scene) : undefined,
      parallel(() => {
        fx.flash(COLOR.blood, 0.55)
        fx.shake(1.6)
        stage.bars(4)
        const { width, height } = fx.size()
        fx.focusLines(width / 2, height / 2, { dur: 700 })
        fx.cutIn(
          view?.boss
            ? "ボス戦！"
            : view?.midboss
              ? "中ボス戦！"
              : "エンカウント！",
          { hold: animationTiming.milestone }
        )
        stage.camera.to({ z: 1.35, r: 4, blur: 3 }, 600, ease.out)
        play(
          stage.set.current,
          [
            { filter: "brightness(1)" },
            { filter: "brightness(.35) saturate(.7)" },
          ],
          { duration: 500, fill: "both" }
        )
        after(
          hold(animationTiming.encounterLead),
          async () => {
            setPhase("stage")
            await nextFrame(signal)
            await this.dropFoes(signal)
            if (signal.aborted) return
            return parallel(() => {
              fx.shake(1.2)
              const first = view?.foes[0]
              const center = fx.center(first ? parts.foe(first.id) : null, 0.45)
              fx.comic(
                "comic-hit",
                center.x + center.w * 0.38,
                center.y - center.w * 0.35,
                Math.max(center.w * 0.62, fx.size().height * 0.25),
                { text: "" }
              )
              fx.focusLines(center.x, center.y, { dur: 380 })
            }, signal)
          },
          signal
        )
      }, signal),
    ])
    if (signal.aborted) return

    for (const [i, el] of this.deps.parts.allFoes().entries()) {
      play(
        el.firstElementChild,
        [
          { transform: "translateY(0)" },
          { transform: "translateY(-1.5%)" },
          { transform: "translateY(0)" },
        ],
        { duration: 1800 + i * 200, iterations: Infinity }
      )
    }
    setPhase("fight")
  }

  /** 戦闘を離れるとき：景色の明るさとカメラを戻す。 */
  leave() {
    const { stage, formation } = this.deps
    play(
      stage.set.current,
      [{ filter: "brightness(.35) saturate(.7)" }, { filter: "brightness(1)" }],
      { duration: 400, fill: "both" }
    )
    void stage.camera.to({ z: 1, r: 0, blur: 0 }, 600, ease.out)
    formation.lift(null)
    formation.freeze(false)
  }

  /** 敵が一体ずつ落ちてくる */
  dropFoes(signal = this.deps.signal()) {
    return parallel(() => {
      for (const [i, el] of this.deps.parts.allFoes().entries()) {
        play(
          el,
          [
            {
              easing: EASE_OUT,
              transform: "translateY(-80vh) scale(1.3) rotate(-8deg)",
            },
            { transform: "translateY(3vh) scale(1)", offset: 0.7 },
            { transform: "none" },
          ],
          {
            duration: animationTiming.enter,
            delay: i * animationTiming.stagger,
            fill: "both",
          }
        )
      }
    }, signal)
  }

  /** 削った後の敵のHPを覚える。敵のHPは画面に出さず、倒れたかの見た目にだけ使う。 */
  recordFoeHp(foeId: string, to: number) {
    this.deps.setShownHp((hp) => ({ ...hp, [foeId]: to }))
  }

  /** 倒れた敵は回りながら画面外へ吹き飛ぶ。 */
  knockOut(foeId: string, delay: number) {
    const { parts, setGone } = this.deps
    return after(
      play(
        parts.foe(foeId),
        [
          { transform: "none", opacity: 1 },
          {
            transform: "translate(40vw,-50vh) rotate(260deg) scale(.4)",
            opacity: 0,
          },
        ],
        {
          duration: animationTiming.knockout,
          delay,
          easing: EASE_IN,
          fill: "both",
        }
      ),
      () => {
        setGone((list) => (list.includes(foeId) ? list : [...list, foeId]))
      },
      this.deps.signal()
    )
  }

  async finish(events: readonly GameEvent[]) {
    const {
      fx,
      stage,
      nav,
      formation,
      view,
      gone,
      setPhase,
      setMenu,
      setPeek,
    } = this.deps
    const signal = this.deps.signal()
    if (events.some((event) => event.type === "victory")) {
      setPhase("end")
      setMenu(null)
      formation.lift(null)
      setPeek(null)
      const standing = (view?.foes ?? []).filter(
        (foe) => !gone.includes(foe.id)
      )
      const lastFoe = standing.at(-1)
      await parallel(() => {
        for (const [i, foe] of [...standing].entries())
          this.knockOut(foe.id, 200 + i * 80)
        fx.flash(COLOR.mist, 0.7)
        fx.shake(1.4)
        const c = lastFoe
          ? this.deps.parts.foeCenter(lastFoe.id)
          : { x: 0, y: 0, w: 0, h: 0 }
        fx.hitStop(2)
        fx.comic(
          "comic-critical",
          c.x,
          c.y,
          Math.max(c.w * 1.1, fx.size().height * 0.4),
          { text: "KA-BOOM!" }
        )
        fx.shards(c.x, c.y, { n: 36, power: 2.2 })
        fx.focusLines(c.x, c.y, { dur: 700 })
        void fx.cutIn("ゲキタイ！", {
          hold: animationTiming.milestone,
          delay: animationTiming.change,
        })
      }, signal)
      if (signal.aborted) return true
      this.deps.onEnd("victory")
      return true
    }
    if (events.some((event) => event.type === "defeated")) {
      setPhase("end")
      setMenu(null)
      formation.lift(null)
      setPeek(null)
      await parallel(() => {
        fx.flash(COLOR.blood, 0.8)
        fx.shake(2)
        play(
          stage.set.current,
          [
            { filter: "brightness(.35) saturate(.7)" },
            { filter: "brightness(.15) grayscale(1)" },
          ],
          { duration: 600, fill: "both" }
        )
        void fx.cutIn("全滅……", {
          hold: animationTiming.milestone,
          delay: animationTiming.change,
        })
      }, signal)
      if (signal.aborted) return true
      this.deps.onEnd("defeat")
      if (view?.townQuest) return true
      await nav.go(
        { name: "town" },
        {
          enter: "pan",
          during: async () => {
            stage.bars(13)
            await stage.camera.to({ y: -1600, blur: 26, z: 1.2 }, 520, ease.in)
            fx.flash(COLOR.mist, 0.6)
          },
        }
      )
      return true
    }
    return false
  }

  /** 相手が誰でも同じ見せ方：敵へ・仲間へ、被害・回復・状態。 */
  playResults(acted: Acted, big: boolean, over: boolean) {
    const { fx, game, parts, view, shownHp } = this.deps
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
                this.recordFoeHp(ref.id, to)
                if (result.down && !over) this.knockOut(ref.id, 0)
              },
              this.deps.signal()
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
            if (damagePlayback)
              after(damagePlayback, showStatus, this.deps.signal())
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
    }, this.deps.signal())
    return after(
      resultsPlayback,
      () => hold(animationTiming.resultPause),
      this.deps.signal()
    )
  }

  /** 手番の終わりの出来事：毒で削られる、縛られて動けない。 */
  async playAfter(events: readonly GameEvent[], signal: AbortSignal) {
    const { fx, game, parts, shownHp } = this.deps
    for (const event of events) {
      if (signal.aborted) return
      if (event.type === "ticked") {
        // 毒は削られ、再生は戻る。符号を変えて同じ見せ方にする
        const damage = event.damage ?? 0
        const heal = event.heal ?? 0
        await parallel(() => {
          const at =
            event.target.kind === "foe"
              ? parts.foeCenter(event.target.id)
              : parts.memberCenter(game.state.party, event.target.id)
          fx.comic(statusEffects[event.status], at.x, at.y - at.h * 0.4, at.w, {
            text: "",
          })
          fx.numberAt(
            at.x,
            at.y - at.h * 0.2,
            `${STATUS_NAMES[event.status]} ${heal ? `+${heal}` : `−${damage}`}`,
            { size: 7, color: COLOR.sage }
          )
          fx.shake(0.5)
          if (event.target.kind === "foe") {
            const id = event.target.id
            const from = shownHp[id] ?? 0
            const foe = this.deps.view?.foes.find((entry) => entry.id === id)
            const to = heal
              ? Math.min(foe?.maxHp ?? from + heal, from + heal)
              : Math.max(0, from - damage)
            this.recordFoeHp(id, to)
            if (event.down && !events.some((entry) => entry.type === "victory"))
              this.knockOut(id, 300)
          }
        }, signal)
      }
      if (event.type === "skipped") {
        await parallel(() => {
          const at =
            event.actor.kind === "foe"
              ? parts.foeCenter(event.actor.id)
              : parts.memberCenter(game.state.party, event.actor.id)
          fx.comic(statusEffects[event.status], at.x, at.y - at.h * 0.4, at.w, {
            text: "動けない！",
          })
        }, signal)
      }
    }
  }
}
