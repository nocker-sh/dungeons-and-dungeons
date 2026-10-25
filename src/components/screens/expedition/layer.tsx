import { BranchChoices } from "./branch-choices"
import { ReturnSummary } from "./return-summary"
import { Discovery } from "@/components/game/discovery"
import { playEventConversation } from "@/components/game/event-conversation"
import { after, nextFrame, parallel } from "@/components/canvas/animation"
import {
  useAnimationEffect,
  useAnimationScope,
  reportAnimationError,
} from "@/components/canvas/use-animation"
import { animationTiming } from "@/components/stage/timing"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { layerSceneArt } from "@/lib/content/looks"
import { useFormation } from "@/components/game/formation"
import { LootPanel } from "@/components/game/loot"
import { useNav } from "@/components/game/nav"
import {
  RouteMap,
  geometry,
  type RouteMapHandle,
} from "@/components/game/route-map"
import { ease } from "@/components/stage/camera"
import { COLOR, EASE_OUT, randomBetween } from "@/components/stage/kit"
import {
  LeavingContext,
  useLeaving,
  useStage,
} from "@/components/stage/stage-context"
import { useFx } from "@/components/stage/use-fx"
import { Word, useWide } from "@/components/stage/word"
import { useGame, useGameState } from "@/contexts/game"
import type { GameEvent } from "@/lib/wiz"
import { eventsOf, inPhase } from "@/lib/wiz"
import { PALETTE, REVERT, UI_LAYER, unit } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"
import { lootItems } from "./loot-items"

function arrived(events: readonly GameEvent[]) {
  return events.find(
    (event): event is Extract<GameEvent, { type: "arrived" }> =>
      event.type === "arrived"
  )
}

/** 地点に着いたら、画面を横断する道のり図と「進む」「撤退」だけを置く。 */
export function Layer({
  intro,
  onBattle,
}: {
  intro: boolean
  onBattle: () => void
}) {
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
  const [showLeft, setShowLeft] = useState(!intro)
  const [retreating, setRetreating] = useState(false)
  const [buttonsKey, setButtonsKey] = useState(0)
  const leftRef = useRef<HTMLDivElement>(null)
  const selectedPathDetails = useRef<HTMLDivElement>(null)
  const carryingSummary = useRef<HTMLDivElement>(null)
  const [branchTop, setBranchTop] = useState<number | null>(null)
  const [branchDetailsHeight, setBranchDetailsHeight] = useState<number | null>(
    null
  )
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
    if (!intro) return
    after(fx.cutIn("出発進行！", { delay: 150 }), () => setShowLeft(true))
    fx.shake(0.9)
  }, [intro, fx])

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
  useEffect(() => {
    const details = selectedPathDetails.current
    const summary = carryingSummary.current
    if (wide || !details || !summary) {
      setBranchDetailsHeight(null)
      setBranchTop(null)
      return
    }
    let disposed = false
    const resize = () => {
      if (disposed) return
      const status = leftRef.current
      const canvas = stage.canvas.current
      if (
        status &&
        canvas &&
        !status
          .getAnimations()
          .some((animation) => animation.playState === "running")
      ) {
        const bounds = canvas.getBoundingClientRect()
        const scale = canvas.clientHeight / bounds.height
        setBranchTop(
          Math.ceil(
            (status.getBoundingClientRect().bottom - bounds.top) * scale + 8
          )
        )
      }
      const available =
        summary.getBoundingClientRect().top -
        details.getBoundingClientRect().top -
        8
      setBranchDetailsHeight(Math.min(150, Math.max(40, Math.floor(available))))
    }
    const observer = new ResizeObserver(resize)
    observer.observe(summary)
    if (leftRef.current) {
      observer.observe(leftRef.current)
      // 入場の移動中は位置が変わるので、演出が終わった位置でも測り直す。
      void Promise.allSettled(
        leftRef.current.getAnimations().map((animation) => animation.finished)
      ).then(resize)
    }
    if (details.previousElementSibling)
      observer.observe(details.previousElementSibling)
    if (stage.canvas.current) observer.observe(stage.canvas.current)
    resize()
    return () => {
      disposed = true
      observer.disconnect()
    }
  }, [
    wide,
    showLeft,
    branchTop,
    carryingText,
    buttons,
    buttonsKey,
    hideButtons,
    route.at,
    route.surveyLeft,
  ])
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
          onBattle()
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
        onBattle()
      }
      if (kind === "boss" || kind === "midboss") {
        onBattle()
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
        draw={intro}
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
        <div
          ref={leftRef}
          className="left2"
          aria-label={`${route.layer.no}層・${route.layer.name}。${route.stepsLeft > 0 ? `終点まであと${route.stepsLeft}区間` : "終点"}${route.midbossSteps !== null ? `。中ボスまであと${route.midbossSteps}区間` : ""}${nextBattle ? `。${nextBattle}` : ""}`}
          style={{
            ...REVERT,
            position: "absolute",
            left: "3%",
            top: compactBranch ? "2%" : "6%",
            rotate: "-6deg",
            pointerEvents: "none",
            color: PALETTE.paper,
            textShadow: `0 0 6px ${PALETTE.ink}`,
            whiteSpace: "nowrap",
          }}
        >
          <small
            data-expedition-layer
            style={{
              ...REVERT,
              display: "block",
              fontSize: `max(12px, ${unit(3)})`,
              fontWeight: 800,
              lineHeight: 1.3,
              marginBottom: compactBranch ? 4 : 8,
              maxWidth: unit(55),
              whiteSpace: "normal",
            }}
          >
            {route.layer.no}層・{route.layer.name}
          </small>
          <small
            style={{
              ...REVERT,
              display: "block",
              fontSize: `max(11px, ${unit(2.6)})`,
              letterSpacing: "0.3em",
            }}
          >
            終点まで（区間）
          </small>
          <b
            style={
              {
                ...REVERT,
                fontSize: unit(compactBranch ? 8 : 14),
                lineHeight: 0.85,
                WebkitTextStroke: `0.05em ${PALETTE.ink}`,
                paintOrder: "stroke fill",
                textShadow: `0.05em 0.05em 0 ${PALETTE.blood}`,
              } as CSSProperties
            }
          >
            {route.stepsLeft > 0 ? route.stepsLeft : "!"}
          </b>
          {route.midbossSteps !== null ? (
            <small
              style={{
                ...REVERT,
                display: "block",
                fontSize: `max(11px, ${unit(2.6)})`,
                marginTop: compactBranch ? 4 : 8,
              }}
            >
              中ボスまであと{route.midbossSteps}区間
            </small>
          ) : null}
          {nextBattle ? (
            <>
              <small
                style={{
                  ...REVERT,
                  display: "block",
                  fontSize: `max(11px, ${unit(2.6)})`,
                  fontWeight: 900,
                  background: PALETTE.blood,
                  padding: "4px 8px",
                  marginTop: 8,
                }}
              >
                {nextBattle}
              </small>
              {nextStation?.fixedFoes.map((foe) => (
                <small
                  key={foe.name}
                  data-next-fixed-foe=""
                  style={{
                    ...REVERT,
                    display: "block",
                    maxWidth: wide ? 360 : "75vw",
                    whiteSpace: "normal",
                    fontSize: `max(11px, ${unit(2.6)})`,
                    lineHeight: 1.4,
                    padding: "4px 8px",
                    background: PALETTE.ink,
                  }}
                >
                  敵：{foe.name}
                  {foe.skills.length ? (
                    <span style={{ display: "block" }}>
                      ワザ：{foe.skills.join("・")}
                    </span>
                  ) : null}
                  {foe.resistances.length ? (
                    <span style={{ display: "block" }}>
                      耐性：
                      {foe.resistances.map((entry) => entry.label).join("・")}
                    </span>
                  ) : null}
                </small>
              ))}
            </>
          ) : null}
        </div>
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
                delay={intro && buttonsKey <= 1 ? animationTiming.cutIn : 60}
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
                intro && buttonsKey <= 1
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
