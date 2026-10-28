import type { BattleDirectorDeps } from "./director-context"
import { playBattleResults } from "./result-playback"
import { after } from "@/client/components/canvas/after"
import { hold } from "@/client/components/canvas/hold"
import { nextFrame } from "@/client/components/canvas/next-frame"
import { parallel } from "@/client/components/canvas/parallel"
import { animationTiming } from "@/client/components/stage/timing"
import { comicEffects } from "@/client/components/canvas/comic-effect"
import { loadBattleArtwork } from "./artwork"
import { foeImagePaths } from "@/content/foe-image-paths"
import { statusEffects } from "./effects"
import { ease } from "@/client/components/stage/camera"
import { COLOR, EASE_IN, EASE_OUT } from "@/client/components/stage/kit"
import { STATUS_NAMES } from "@/lib/wiz/queries/status-resistance-view"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import { play } from "@/client/components/canvas/play"
import { type Acted } from "@/client/components/screens/battle/types"

/**
 * 戦闘の再生の順序。突入の演出、敵の落下、被害と回復の見せ方、手番の終わり、勝敗までを受け持つ。
 * どの指示を送るかは決めない（それは入力の側）。
 */
export class BattleDirector {
  constructor(private readonly deps: BattleDirectorDeps) {}

  /** 突入：閃光、ぶれ、景色が暗く寄る → 敵が落ちてくる */
  async intro(signal: AbortSignal) {
    const { fx, stage, view, scene, parts, setPhase } = this.deps
    // 途中で入る戦闘も、その個体の絵がそろってから登場させる。
    let imagesReady = false
    const images = loadBattleArtwork(
      (view?.foes ?? []).flatMap((foe) =>
        foeImagePaths(foe.foe, foe.appearanceId)
      )
    ).then(() => {
      imagesReady = true
    })
    await Promise.all([
      images,
      loadBattleArtwork(comicEffects.map((effect) => effect.image)),
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
            if (!imagesReady) await images
            if (signal.aborted) return
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
    return playBattleResults(this.deps, acted, big, over, {
      recordFoeHp: (id, hp) => this.recordFoeHp(id, hp),
      knockOut: (id, delay) => this.knockOut(id, delay),
    })
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
