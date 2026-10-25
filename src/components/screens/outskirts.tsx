import { Supplies } from "@/components/game/supplies"
import { StageChrome } from "@/components/stage/chrome"
import {
  playEventConversation,
  useVisitScene,
} from "@/components/game/event-conversation"
import { CanvasBox, CanvasButton } from "@/components/canvas/primitives"
import { PALETTE, STAGE_LAYER } from "@/components/canvas/tokens"
import { ListView } from "@/components/game/list-view"
import { gearGoalDesc } from "@/components/game/gear-text"
import { parallel } from "@/components/canvas/animation"
import {
  useAnimationScope,
  reportAnimationError,
} from "@/components/canvas/use-animation"
import { useEffect, useRef, useState } from "react"
import {
  guideLine,
  keeperOf,
  layerLook,
  personFor,
  placeIdOf,
  sceneOf,
  standOf,
} from "@/lib/content/looks"
import { useFormation } from "@/components/game/formation"
import { useArrival, useNav } from "@/components/game/nav"
import { COLOR } from "@/components/stage/kit"
import { Guide, type GuideHandle } from "@/components/stage/guide"
import { Revolver } from "@/components/stage/revolver"
import { useStage } from "@/components/stage/stage-context"
import { useFx } from "@/components/stage/use-fx"
import { Word, useWide } from "@/components/stage/word"
import { useGame, useGameState } from "@/contexts/game"
import { inPhase } from "@/lib/wiz"
import { UI_LAYER } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"

/** 街はずれの乗り場。案内人と、行き先の層のリボルバー。「カチコミ」で降りる。 */
export function Outskirts() {
  const game = useGame()
  const state = useGameState()
  const stage = useStage()
  const nav = useNav()
  const fx = useFx()
  const formation = useFormation()
  const wide = useWide()
  const destinations = game.queries.destinations(state)
  const ownedGear = game.queries.gear(state)
  const party = game.queries.party(state)
  const brokenArmor = ownedGear.filter(
    (entry) =>
      entry.armor?.durability === 0 &&
      entry.armor.maxDurability > 0 &&
      party.some((member) => member.id === entry.ownerId)
  )
  const armorWarning = brokenArmor.length
    ? `防具が${brokenArmor.length}着、耐久切れだ。ダメージを防げないぞ。街の鍛冶屋で修理しよう。`
    : null
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      destinations.findIndex(
        (entry) => entry.id === game.queries.defaultDestination(state)
      )
    )
  )
  const [say, setSay] = useState(guideLine("ask"))
  const showArmorWarning =
    !!armorWarning &&
    (say === guideLine("ask") ||
      destinations.some(
        (entry) => entry.open && say === layerLook(entry.id).line
      ))
  const [showFinds, setShowFinds] = useState(false)
  const findsTrigger = useRef<HTMLButtonElement>(null)
  const findsDialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showFinds) return
    findsDialog.current?.querySelector<HTMLButtonElement>("button")?.focus()
    return () => findsTrigger.current?.focus()
  }, [showFinds])
  const guide = useRef<GuideHandle>(null)
  const busy = useRef(false)
  const lifetime = useAnimationScope()
  const art = sceneOf("outskirts", wide)
  const ready = useArrival(art, "crane", 5, async () =>
    fx.flash(COLOR.sage, 0.25)
  )
  // 画面の幅が変わって絵が替わったときも、読み込んでから差し替える
  useEffect(() => void stage.art(art), [stage, art])
  // はじめから遊ぶときは、昇降機番の場面のあとにそのまま0層へ降りる
  const prologue = useRef(game.queries.prologue(state) === "depart")
  useVisitScene(placeIdOf("outskirts"), ready && !prologue.current)
  const descendRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    if (!ready || !prologue.current) return
    const controller = new AbortController()
    void playEventConversation(game, "visit", controller.signal, {
      place: placeIdOf("outskirts"),
    }).then(() => {
      if (!controller.signal.aborted) void descendRef.current()
    })
    return () => controller.abort()
  }, [game, ready])

  const pick = (index: number) => {
    setSelected(index)
    const dest = destinations[index]
    setSay(dest.open ? layerLook(dest.id).line : guideLine("locked"))
  }

  const descend = async () => {
    if (busy.current) return
    const dest = destinations[selected]
    if (!dest.open) {
      setSay(guideLine("locked"))
      guide.current?.pop()
      fx.shake(0.6)
      return
    }
    const readiness = game.queries.readiness(state)
    if (!readiness.ready) {
      setSay(
        readiness.short
          ? guideLine("short")
          : readiness.down.length
            ? guideLine("down", readiness.down)
            : guideLine("tired", readiness.tired)
      )
      guide.current?.pop()
      fx.shake(0.6)
      return
    }
    busy.current = true
    formation.lift(null)
    setSay(guideLine("go"))
    await parallel(
      () =>
        play(
          guide.current?.bubble,
          [
            { scale: 1.3, rotate: "-12deg" },
            { scale: 1, rotate: "-5deg" },
          ],
          { duration: 300, easing: "cubic-bezier(.34,1.56,.64,1)" }
        ),
      lifetime.current.signal
    )
    lifetime.current.assertActive()
    const handle = { open: () => {} }
    await nav.go(
      { name: "expedition", descent: () => handle.open(), land: true },
      {
        enter: "none",
        during: async () => {
          stage.bars(13)
          const blades = fx.blades(layerLook(dest.id).glow ?? COLOR.lavender)
          handle.open = blades.open
          await blades.closed
          lifetime.current.assertActive()
          fx.shake(1.2)
          inPhase(game, "town")?.depart(dest.id)
        },
      }
    )
  }

  descendRef.current = descend
  if (!ready) return null
  return (
    <div className="ui-layer" style={UI_LAYER}>
      {!showFinds ? <Supplies /> : null}
      {destinations[selected].armorFinds.length ||
      destinations[selected].weaponFinds.length ? (
        <CanvasButton
          className="slot-item"
          ref={findsTrigger}
          aria-label="探索装備の目標を見る"
          onClick={() => setShowFinds(true)}
          style={{
            position: "absolute",
            left: "52%",
            top: "14%",
            zIndex: 25,
            padding: "10px 12px",
            background: PALETTE.paper,
            color: PALETTE.ink,
            border: "2px solid",
            fontSize: 16,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          探索の装備
        </CanvasButton>
      ) : null}
      {showArmorWarning ? (
        <CanvasBox
          role="status"
          aria-label={armorWarning ?? undefined}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clipPath: "inset(50%)",
            whiteSpace: "nowrap",
          }}
        >
          {armorWarning}
        </CanvasBox>
      ) : null}
      <Guide
        ref={guide}
        img={keeperOf(personFor("guide")).img}
        say={showArmorWarning ? armorWarning : say}
        sayStyle={
          showArmorWarning
            ? {
                whiteSpace: "normal",
                width: wide ? 360 : "76vw",
                boxSizing: "border-box",
                fontSize: "max(12px, calc(var(--u)*2.8))",
              }
            : undefined
        }
        style={standOf("outskirts", wide)}
      />
      <Revolver
        label="行き先"
        disabled={showFinds}
        items={destinations.map((dest) => ({
          key: dest.id,
          no: dest.no,
          unit: "層",
          name: dest.name,
          note: dest.state,
          locked: !dest.open,
        }))}
        selected={selected}
        onSelect={pick}
        style={{ top: wide ? "11%" : "24%" }}
      />
      <Word
        text="カチコミ"
        size={13}
        paper
        big
        tilt={-3}
        rotate={-6}
        from="left"
        delay={260}
        style={
          wide ? { left: "24vw", bottom: "8%" } : { left: "30vw", bottom: "8%" }
        }
        onClick={() => {
          void descend().catch(reportAnimationError)
        }}
      />
      <Word
        text="会話"
        size={wide ? 4 : 4.4}
        tilt={3}
        rotate={-3}
        from="right"
        delay={440}
        style={{ right: "4%", top: wide ? "15%" : "13%" }}
        onClick={() => {
          if (busy.current) return
          busy.current = true
          void playEventConversation(game, "talk", undefined, {
            resident: personFor("guide"),
          }).then(() => {
            busy.current = false
          })
        }}
      />
      <StageChrome>
        <Word
          text="‹ 街へ"
          size={wide ? 4 : 4.4}
          tilt={-4}
          rotate={3}
          from="right"
          delay={380}
          style={{ right: "4%", top: wide ? "7%" : "6%" }}
          onClick={() =>
            void nav.go(
              { name: "town" },
              { exit: { x: -1100, r: 3, blur: 22, ms: 380 }, enter: "pan" }
            )
          }
        />
      </StageChrome>
      {showFinds ? (
        <CanvasBox
          ref={findsDialog}
          role="dialog"
          aria-modal="true"
          aria-label={`${destinations[selected].no}層の探索装備`}
          style={{ ...UI_LAYER, zIndex: STAGE_LAYER.sheet }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return
            const focusableElements = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), [tabindex="0"]'
              ),
            ]
            const index = focusableElements.indexOf(
              document.activeElement as HTMLElement
            )
            const next = event.shiftKey
              ? (index - 1 + focusableElements.length) %
                focusableElements.length
              : (index + 1) % focusableElements.length
            event.preventDefault()
            focusableElements[next]?.focus()
          }}
        >
          <ListView
            title={`${destinations[selected].no}層の探索装備`}
            kind="exploration-finds"
            notice={
              <CanvasBox style={{ paddingTop: wide ? 24 : 0 }}>
                <CanvasBox style={{ marginBottom: 8 }}>
                  現在所持：武器{" "}
                  {
                    destinations[selected].weaponFinds.filter(
                      (entry) => entry.own > 0
                    ).length
                  }
                  /{destinations[selected].weaponFinds.length}・防具{" "}
                  {
                    destinations[selected].armorFinds.filter(
                      (entry) => entry.own > 0
                    ).length
                  }
                  /{destinations[selected].armorFinds.length}種類
                </CanvasBox>
                鑑定候補は最深到達層で決まる。潜る層では変わらない。街の「武器と防具」で鑑定。光るガラクタは武器のみ。
              </CanvasBox>
            }
            tabs={[
              {
                name: "防具",
                rows: destinations[selected].armorFinds.map((entry) => ({
                  key: entry.id,
                  icon: entry.id,
                  name: entry.name,
                  stat: entry.stat,
                  desc: gearGoalDesc({
                    ...entry,
                    equipMembers: entry.equipMembers.map((member) => ({
                      ...member,
                      armorComparison: game.queries.armorGoalComparison(
                        state,
                        member.id,
                        entry.id
                      ),
                      currentArmor:
                        ownedGear.find(
                          (gear) =>
                            gear.ownerId === member.id && gear.kind === "armor"
                        ) ?? null,
                    })),
                  }),
                  sub: entry.own ? "所持中" : "未所持",
                  badge: entry.own ? `×${entry.own}` : undefined,
                })),
              },
              {
                name: "武器",
                rows: destinations[selected].weaponFinds.map((entry) => ({
                  key: entry.id,
                  icon: entry.id,
                  name: entry.name,
                  stat: entry.stat,
                  desc: gearGoalDesc({
                    ...entry,
                    equipMembers: entry.equipMembers.map((member) => {
                      const fit = game.queries.weaponFit(
                        state,
                        member.id,
                        entry.id
                      )
                      const current = game.queries.member(
                        state,
                        member.id
                      )?.weapon
                      return {
                        ...member,
                        short: fit?.short,
                        attackComparison: fit
                          ? {
                              before: current?.attack ?? 1,
                              after: fit.attack,
                              favorite: fit.favorite,
                            }
                          : null,
                      }
                    }),
                  }),
                  sub: entry.own ? "所持中" : "未所持",
                  badge: entry.own ? `×${entry.own}` : undefined,
                })),
              },
            ]}
            onClose={() => setShowFinds(false)}
          />
        </CanvasBox>
      ) : null}
    </div>
  )
}
