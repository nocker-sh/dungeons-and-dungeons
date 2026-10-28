import { LayerProgress } from "@/client/components/screens/expedition/layer-progress"
import { useBranchLayout } from "@/client/components/screens/expedition/use-branch-layout"
import { BranchChoices } from "@/client/components/screens/expedition/branch-choices"
import { ReturnSummary } from "@/client/components/screens/expedition/return-summary"
import { Discovery } from "@/client/components/game/discovery"
import { playEventConversation } from "@/client/components/game/play-event-conversation"
import { after } from "@/client/components/canvas/after"
import { nextFrame } from "@/client/components/canvas/next-frame"
import { parallel } from "@/client/components/canvas/parallel"
import { useAnimationEffect } from "@/client/components/canvas/use-animation-effect"
import { useAnimationScope } from "@/client/components/canvas/use-animation-scope"
import { reportAnimationError } from "@/client/components/canvas/report-animation-error"
import { animationTiming } from "@/client/components/stage/timing"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { layerSceneArt } from "@/content/looks/layer-scene-art"
import { useFormation } from "@/client/components/game/formation/context"
import { LootPanel } from "@/client/components/game/loot-panel"
import { useNav } from "@/client/components/game/use-nav"
import { RouteMap } from "@/client/components/game/route-map"
import type { RouteMapHandle } from "@/client/components/game/route-map"
import { geometry } from "@/client/components/game/route-geometry"
import { ease } from "@/client/components/stage/camera"
import { COLOR, EASE_OUT } from "@/client/components/stage/kit"
import { randomBetween } from "@/client/components/stage/random-between"
import {
  LeavingContext,
  useLeaving,
} from "@/client/components/stage/use-leaving"
import { useStage } from "@/client/components/stage/use-stage"
import { useFx } from "@/client/components/stage/use-fx"
import { Word } from "@/client/components/stage/word"
import { useWide } from "@/client/components/stage/use-wide"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { eventsOf } from "@/lib/wiz/phases/events-of"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { UI_LAYER } from "@/client/components/canvas/tokens"
import { play } from "@/client/components/canvas/play"
import { lootItems } from "@/client/components/screens/expedition/loot-items"
import { arrived } from "@/client/components/screens/expedition/arrived"

/** 地点に着いたら、画面を横断する道のり図と「進む」「撤退」だけを置く。 */
export type Props = {
  intro: boolean
  onBattle: () => void
}

export function Layer(props: Props) {
  const game = useGame()
  const state = useGameState()
  const stage = useStage()
  const nav = useNav()
  const fx = useFx()
  const formation = useFormation()
  const wide = useWide()
  const leaving = useLeaving()
  const route = game.queries.route(state)!
  const compactBranch = !wide && route.choices.length > 1
  const mapRef = useRef<RouteMapHandle>(null)
  const busy = useRef(false)
  const lifetime = useAnimationScope()
  const [pick, setPick] = useState<string | null>(
    route.choices.length > 1 ? route.choices[0] : null
  )
  const nextStation = route.stations.find(
    (station) =>
      station.id === (route.choices.length > 1 ? pick : route.choices[0])
  )
  const nextBattle = nextStation?.boss
    ? "次はボス戦"
    : nextStation?.midboss
      ? "次は中ボス戦"
      : null
  const selectedPath =
    route.paths.find((path) => path.id === pick) ?? route.paths[0]
  const [held, setHeld] = useState(false)
  const [showLeft, setShowLeft] = useState(!props.intro)
  const [retreating, setRetreating] = useState(false)
  const [buttonsKey, setButtonsKey] = useState(0)
  const leftRef = useRef<HTMLDivElement>(null)
  const selectedPathDetails = useRef<HTMLDivElement>(null)
  const carryingSummary = useRef<HTMLDivElement>(null)
  const view = stage.canvas.current
  const geo = geometry(
    wide,
    view?.clientWidth ?? innerWidth,
    view?.clientHeight ?? innerHeight
  )

  useEffect(
    () => setPick(route.choices.length > 1 ? route.choices[0] : null),
    [route.at, route.choices]
  )

  useAnimationEffect(() => {
    if (!props.intro) return
    after(fx.cutIn("出発進行！", { delay: 150 }), () => setShowLeft(true))
    fx.shake(0.9)
  }, [props.intro, fx])

  useLayoutEffect(() => {
    if (showLeft)
      play(
        leftRef.current,
        [
          { transform: "translateX(-60vw) rotate(-20deg)" },
          { transform: "none" },
        ],
        { duration: animationTiming.enter, easing: EASE_OUT, fill: "both" }
      )
  }, [showLeft])

  const pending = route.pending && !held ? route.pending : null
  const hideButtons = !!pending || retreating
  const home = route.atEnd && route.cleared
  const growingMembers = home
    ? game.queries.party(state).filter((member) => member.levelUpReady)
    : []
  const nextLayer = home
    ? game.queries
        .destinations(state)
        .find((layer) => layer.no === route.layer.no + 1 && layer.open)
    : undefined
  const nextChallenge = nextLayer
    ? `次の挑戦：${nextLayer.no}層・${nextLayer.name}`
    : "街へ戻ると踏破の結果を見られる"
  const { carrying } = route
  const carried = [
    carrying.gold ? `金貨 ${carrying.gold}G` : "",
    carrying.junk ? `ガラクタ ×${carrying.junk}` : "",
    carrying.rareJunk ? `光るガラクタ ×${carrying.rareJunk}` : "",
    carrying.otherGoods ? `ほかの品 ×${carrying.otherGoods}` : "",
    carrying.unequippedGear ? `未装備の拾い物 ×${carrying.unequippedGear}` : "",
  ].filter(Boolean)
  const carryingText = carried.length ? `抱えた物：${carried.join("・")}` : ""
  const returnMoneyText = `帰還後の所持金 ${route.returnBalance}G${route.bonus > 0 ? `（手当て +${route.bonus}G）` : ""}`
  const [buttons, setButtons] = useState(!hideButtons)
  const { branchTop, branchDetailsHeight } = useBranchLayout({
    wide,
    showLeft,
    carryingText,
    buttons,
    buttonsKey,
    hideButtons,
    route,
    leftRef,
    selectedPathDetails,
    carryingSummary,
    stage,
  })
  useEffect(() => {
    if (!hideButtons) {
      setButtons(true)
      setButtonsKey((key) => key + 1)
      return
    }
    const controller = new AbortController()
    void nextFrame(controller.signal)
      .then(() => stage.exits.wait())
      .then(() => {
        if (!controller.signal.aborted) setButtons(false)
      })
      .catch(reportAnimationError)
    return () => controller.abort()
  }, [hideButtons])

  const advance = async () => {
    if (busy.current || route.atEnd || route.pending) return
    const to = route.choices.length > 1 ? pick : route.choices[0]
    if (!to) return
    busy.current = true
    formation.lift(null)
    const scope = lifetime.current
    try {
      if (route.choices.length > 1)
        await playEventConversation(game, "branch", scope.signal)
      scope.assertActive()
      await parallel(
        () => stage.camera.to({ z: 1.45, blur: 8, y: -30 }, 200, ease.in),
        scope.signal
      )
      scope.assertActive()
      stage.camera.cut({ z: 0.92, blur: 4, y: 20, x: randomBetween(-60, 60) })
      fx.shake(0.5)
      const { width, height } = fx.size()
      fx.focusLines(width * 0.5, height * 0.45, { dur: 300, count: 34 })
      void stage.camera.to({ z: 1, blur: 0, y: 0, x: 0 }, 420, ease.out)
      setHeld(true)
      const events = eventsOf(inPhase(game, "expedition")?.advance(to))
      if (!Array.isArray(events)) return
      const arrival = arrived(events)
      if (!arrival) return
      const kind = arrival.kind
      // 着いた地点の背景へ差し替える（選ぶのはエンジン。ここは絵を引くだけ）
      const arrivedScene = game.queries.scene(game.state)
      if (arrivedScene)
        void stage.art(
          layerSceneArt(arrivedScene.layer, arrivedScene.key, wide) ?? null
        )
      await nextFrame(scope.signal)
      await parallel(() => mapRef.current?.arrive(to, kind), scope.signal)
      scope.assertActive()
      const at = () => fx.center(mapRef.current?.node(to) ?? null)
      await parallel(() => {
        const q = at()
        if (kind === "trap") {
          fx.flash(COLOR.blood, 0.35)
          fx.shake(1.4)
          fx.burst(q.x, q.y, q.w * 1.4, "BOOM!", {
            fill: COLOR.blood,
            ink: COLOR.paper,
          })
          fx.shards(q.x, q.y, { n: 18, power: 1.3 })
        }
        if (kind === "treasure") {
          fx.flash(COLOR.mist, 0.3)
          fx.burst(q.x, q.y, q.w * 1.3, "")
          fx.shards(q.x, q.y, { n: 12, colors: [COLOR.paper, COLOR.sage] })
        }
        if (kind === "battle") {
          fx.burst(q.x, q.y, q.w * 1.5, "", {
            fill: COLOR.blood,
            ink: COLOR.paper,
          })
          fx.focusLines(q.x, q.y, { dur: 380 })
        }
      }, scope.signal)
      scope.assertActive()
      if (kind === "boss" || kind === "midboss")
        await parallel(() => {
          fx.flash(COLOR.blood, 0.5)
          fx.shake(1.6)
          const q = at()
          fx.burst(q.x, q.y, q.w * 1.3, "", {
            fill: COLOR.blood,
            ink: COLOR.paper,
            hold: 900,
          })
          fx.focusLines(q.x, q.y, { dur: 600 })
          void fx.cutIn(kind === "boss" ? "ボス出現！" : "中ボス出現！", {
            hold: animationTiming.milestone,
            delay: 350,
          })
        }, scope.signal)
      scope.assertActive()
      if (kind === "treasure") {
        if (events.some((event) => event.type === "encounter")) {
          await parallel(
            () => fx.cutIn("ミミックだ！", { hold: animationTiming.milestone }),
            scope.signal
          )
          scope.assertActive()
          props.onBattle()
          return
        }
        await playEventConversation(game, "chest", scope.signal)
        await playEventConversation(game, "item", scope.signal)
        scope.assertActive()
      }
      if (kind === "treasure" || kind === "trap" || kind === "discovery") {
        setHeld(false)
      }
      if (kind === "battle") {
        props.onBattle()
      }
      if (kind === "boss" || kind === "midboss") {
        props.onBattle()
      }
    } catch (error) {
      reportAnimationError(error)
    } finally {
      busy.current = false
    }
  }

  const retreat = async () => {
    if (busy.current) return
    busy.current = true
    formation.lift(null)
    setRetreating(true)
    await parallel(
      () =>
        fx.cutIn(route.atEnd && route.cleared ? "帰還！" : "撤退！", {
          hold: 1000,
        }),
      lifetime.current.signal
    )
    lifetime.current.assertActive()
    await nav.go(
      { name: "town" },
      {
        enter: "pan",
        during: async () => {
          stage.bars(13)
          await stage.camera.to({ y: -1600, blur: 26, z: 1.2 }, 520, ease.in)
          fx.flash(COLOR.mist, 0.6)
          void (
            inPhase(game, "expedition") ?? inPhase(game, "pending")
          )?.retreat()
        },
      }
    )
  }
  return (
    <div className="ui-layer" style={UI_LAYER}>
      <RouteMap
        ref={mapRef}
        route={route}
        geo={geo}
        pick={pick}
        onPick={setPick}
        draw={props.intro}
      />
      {route.choices.length > 1 && !pending && !held && !retreating ? (
        <BranchChoices
          route={route}
          pick={pick}
          setPick={setPick}
          wide={wide}
          selectedPath={selectedPath}
          selectedPathDetails={selectedPathDetails}
          branchDetailsHeight={branchDetailsHeight}
          top={branchTop}
        />
      ) : null}
      {showLeft && !leaving ? (
        <LayerProgress
          route={route}
          compactBranch={compactBranch}
          wide={wide}
          nextBattle={nextBattle}
          nextStation={nextStation}
          leftRef={leftRef}
        />
      ) : null}
      {buttons ? (
        <LeavingContext.Provider value={leaving || hideButtons}>
          <div key={buttonsKey} style={{ display: "contents" }}>
            {!home ? (
              <Word
                text="進む"
                size={wide ? 20 : 18}
                paper
                big
                tilt={-4}
                rotate={-7}
                from="right"
                delay={
                  props.intro && buttonsKey <= 1 ? animationTiming.cutIn : 60
                }
                disabled={route.atEnd}
                style={
                  wide
                    ? { right: "3vw", bottom: "8%" }
                    : { right: "3vw", bottom: "8%" }
                }
                onClick={advance}
              />
            ) : null}
            {/* 全滅時に残るガラクタの例外も伝え、進むか戻るかの判断に使う。 */}
            {!hideButtons && (carryingText || home) ? (
              <ReturnSummary
                route={route}
                home={home}
                wide={wide}
                carryingSummary={carryingSummary}
                carryingText={carryingText}
                returnMoneyText={returnMoneyText}
                carried={carried}
                growingMembers={growingMembers}
                nextChallenge={nextChallenge}
              />
            ) : null}
            <Word
              text={home ? "帰還" : "撤退"}
              size={home ? (wide ? 16 : 14) : 8}
              paper={home}
              big
              tilt={4}
              rotate={5}
              from="left"
              delay={
                props.intro && buttonsKey <= 1
                  ? animationTiming.cutIn + animationTiming.stagger
                  : 120
              }
              label={home ? "街へ帰還" : "撤退"}
              style={
                wide
                  ? { left: "4vw", bottom: "10%" }
                  : { left: "3vw", bottom: "10%" }
              }
              onClick={() => {
                void retreat().catch(reportAnimationError)
              }}
            />
          </div>
        </LeavingContext.Provider>
      ) : null}
      {pending?.kind === "discovery" ? (
        <Discovery />
      ) : pending ? (
        <LootPanel
          key={`${route.at}-${pending.kind}`}
          title={
            pending.kind === "loot"
              ? "戦利品"
              : pending.kind === "treasure"
                ? "宝箱"
                : "罠"
          }
          items={lootItems(game, pending)}
          onOk={() => {
            void (async () => {
              if (game.state.conversation?.active) return
              if (pending.kind === "loot")
                await playEventConversation(
                  game,
                  "item",
                  lifetime.current.signal
                )
              lifetime.current.assertActive()
              inPhase(game, "pending")?.acknowledge()
            })().catch(reportAnimationError)
          }}
        />
      ) : null}
    </div>
  )
}
