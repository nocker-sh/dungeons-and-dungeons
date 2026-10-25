import { playEventConversation } from "@/components/game/event-conversation"
import { StageChrome } from "@/components/stage/chrome"
import { parallel, nextFrame } from "@/components/canvas/animation"
import { useAnimationScope } from "@/components/canvas/use-animation"
import { useEffect, useRef, useState } from "react"
import {
  nightTalks,
  roomLine,
  sceneOf,
  type NightTalk as NightScript,
} from "@/lib/content/looks"
import { useArrival, useNav } from "@/components/game/nav"
import { useFormation } from "@/components/game/formation"
import { COLOR, isAborted, pickOne } from "@/components/stage/kit"
import { SlamTitle } from "@/components/stage/guide"
import {
  LeavingContext,
  useLeaving,
  useStage,
} from "@/components/stage/stage-context"
import { useFx } from "@/components/stage/use-fx"
import { Word, useWide, Fly } from "@/components/stage/word"
import { useGame, useGameState } from "@/contexts/game"
import type { Game, LevelUp } from "@/lib/wiz"
import { eventsOf, inPhase } from "@/lib/wiz"
import { UI_LAYER } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"
import { TornLabel } from "@/components/canvas/paper"
import { LevelUpPanel } from "./level-up"
import { AskPanel, NightTalk } from "./night-talk"
import { Sleep } from "./sleep"

type RoomView = ReturnType<Game["queries"]["rooms"]>[number]

/** 部屋の効果を札にする。数値はエンジンのデータから。 */
function perks(room: RoomView) {
  return [
    room.heal === "full" ? "HP（生命力）全回復" : "HP（生命力）半分回復",
    "ワザの残り 全回復",
    room.clean
      ? "疲れ・汚れ 全快"
      : `疲れ ${room.fatigue > 0 ? "+" : "−"}${Math.abs(room.fatigue)}`,
    ...(!room.clean && room.dirt ? [`汚れ +${room.dirt}`] : []),
    room.levelUp ? "レベルアップ" : "レベルアップなし",
    "防具の耐久は回復しない",
  ]
}

type Night =
  | { step: "levelup"; index: number }
  | { step: "ask" }
  | { step: "talk"; talk: NightScript }
  | { step: "sleep" }
  | null

/** 部屋を見せて「泊まる」。泊まると暗くなり、レベルアップ → 夜の会話 → 眠る → 朝。 */
export function Room({ room: roomId }: { room: string }) {
  const game = useGame()
  const state = useGameState()
  const stage = useStage()
  const formation = useFormation()
  const nav = useNav()
  const { freeze } = formation
  useEffect(() => () => freeze(false), [freeze])
  const fx = useFx()
  const wide = useWide()
  const leaving = useLeaving()
  const room = game.queries.rooms(state).find((entry) => entry.id === roomId)
  const art = sceneOf(roomId, wide) ?? sceneOf("inn", wide)
  const ready = useArrival(art, "tilt")
  // 画面の幅が変わって絵が替わったときも、読み込んでから差し替える
  useEffect(() => void stage.art(art), [stage, art])
  const [night, setNight] = useState<Night>(null)
  const [staying, setStaying] = useState(false)
  const lifetime = useAnimationScope()
  const stayingLock = useRef(false)
  const levelUps = useRef<readonly LevelUp[]>([])
  const resume = useRef<((chat?: boolean) => void) | null>(null)
  if (!ready || !room) return null
  const growingMembers = game.queries
    .party(state)
    .filter((member) => member.levelUpReady)

  /** 画面の操作を待つ。next(true/false) で先へ。 */
  const wait = () =>
    new Promise<boolean>((resolve, reject) => {
      const signal = lifetime.current.signal
      const abort = () => {
        resume.current = null
        reject(new DOMException("Animation aborted", "AbortError"))
      }
      if (signal.aborted) return abort()
      signal.addEventListener("abort", abort, { once: true })
      resume.current = (chat = true) => {
        signal.removeEventListener("abort", abort)
        resolve(chat)
      }
    })
  const next = (chat = true) => {
    const done = resume.current
    resume.current = null
    done?.(chat)
  }

  const stay = async () => {
    if (staying || stayingLock.current) return
    stayingLock.current = true
    formation.freeze(true)
    const events = eventsOf(inPhase(game, "town")?.rest(roomId))
    if (!Array.isArray(events)) {
      formation.freeze(false)
      stayingLock.current = false
      return fx.shake(0.6)
    }
    const rested = events.find((event) => event.type === "rested")
    levelUps.current = rested && rested.type === "rested" ? rested.levelUps : []
    setStaying(true)
    const scope = lifetime.current
    try {
      await nextFrame(scope.signal)
      await stage.exits.wait()
      scope.assertActive()
      await parallel(() => {
        play(
          stage.set.current,
          [
            { filter: "brightness(1)" },
            { filter: "brightness(.35) saturate(.6) hue-rotate(200deg)" },
          ],
          { duration: 600, fill: "both" }
        )
        fx.cutIn("夜", { hold: 1000 })
      }, scope.signal)
      scope.assertActive()
      for (let i = 0; i < levelUps.current.length; i++) {
        setNight({ step: "levelup", index: i })
        await wait()
      }
      const hasEventTalk = game.queries.canStartConversation(game.state, "inn")
      // 今夜まだ話していない相手だけが並ぶ台本を選ぶ（仲間ひとりにつき一晩に一度）
      const available = nightTalks().filter(
        (entry) =>
          entry.pair.every((id) => game.state.party.includes(id)) &&
          entry.choice.options.every(([, who]) =>
            game.queries.canChatWith(game.state, who)
          )
      )
      const talk = available.length ? pickOne(available) : null
      if (talk || hasEventTalk) {
        setNight({ step: "ask" })
        const chat = await wait()
        if (chat) {
          if (hasEventTalk) {
            setNight(null)
            await playEventConversation(game, "inn", scope.signal)
            scope.assertActive()
          }
          if (talk) {
            setNight({ step: "talk", talk })
            await wait()
          }
        }
      }
      setNight({ step: "sleep" })
      await wait()
      scope.assertActive()
      setNight(null)
      play(stage.set.current, [{ filter: "none" }, { filter: "none" }], {
        duration: 10,
        fill: "both",
      })
      await parallel(() => {
        fx.flash(COLOR.mist, 0.8)
        fx.cutIn("おはよう！", { hold: 1200, delay: 150 })
      }, scope.signal)
      scope.assertActive()
      formation.freeze(false)
      await parallel(() => {
        for (const [i, card] of formation.cards.all().entries()) {
          const q = fx.center(card, 0.4)
          fx.shards(q.x, q.y, {
            n: 8,
            colors: [COLOR.paper, COLOR.sage],
            power: 0.8,
            delay: i * 110,
          })
        }
        const { width, height } = fx.size()
        fx.burst(
          width / 2,
          height * 0.42,
          height * 0.4,
          room.heal === "full" ? "全回復！" : "回復！",
          {
            fill: COLOR.paper,
            ink: COLOR.ink,
            hold: 900,
            delay: 250,
          }
        )
      }, scope.signal)
      scope.assertActive()
      await nav.go({ name: "place", place: "inn" })
    } catch (error) {
      if (!isAborted(error) && !scope.signal.aborted) throw error
    } finally {
      stayingLock.current = false
    }
  }

  return (
    <div className="ui-layer" style={UI_LAYER}>
      <LeavingContext.Provider value={leaving || staying}>
        <SlamTitle text={room.name} size={wide ? 11 : 10} rotate={-6} />
        <Fly
          from="left"
          rotate={-3}
          delay={150}
          style={{
            position: "absolute",
            ...(wide ? { left: "5%", top: "30%" } : { left: "5%", top: "22%" }),
            pointerEvents: "none",
          }}
        >
          <TornLabel
            background={COLOR.ink}
            color={COLOR.paper}
            clip="polygon(2% 6%, 100% 0, 98% 94%, 0 100%)"
            style={{
              padding: ".15em .7em",
              fontSize: `calc(var(--u)*${wide ? 5 : 6})`,
              boxShadow: `inset 0 0 0 2px ${COLOR.paper}`,
            }}
          >
            一泊{" "}
            <b style={{ fontSize: "1.4em" }}>
              {room.price ? room.price : "タダ"}
            </b>
            {room.price ? " G" : ""}
          </TornLabel>
          <ul
            data-room-perks
            style={{
              listStyle: "none",
              marginTop: "calc(var(--u)*1.6)",
              display: "grid",
              gap: "calc(var(--u)*.9)",
            }}
          >
            {perks(room).map((perk) => (
              <li
                key={perk}
                style={{
                  display: "inline-block",
                  width: "max-content",
                  padding: ".1em .6em",
                  background: COLOR.paper,
                  color: COLOR.ink,
                  fontSize: `max(11px, calc(var(--u)*${wide ? 2.8 : 3.2}))`,
                }}
              >
                {perk}
              </li>
            ))}
          </ul>
          {room.levelUp && growingMembers.length > 0 ? (
            <div
              data-room-growth
              role="region"
              aria-label="成長できる仲間"
              tabIndex={0}
              style={{
                marginTop: 6,
                padding: "6px 8px",
                maxWidth: wide ? 520 : "80vw",
                maxHeight: 90,
                overflowY: "auto",
                overflowWrap: "anywhere",
                boxSizing: "border-box",
                background: COLOR.paper,
                color: COLOR.ink,
                fontSize: "max(11px, calc(var(--u)*2.4))",
                lineHeight: 1.5,
                fontWeight: 800,
                pointerEvents: "auto",
              }}
            >
              レベルアップ予定：
              {growingMembers.map((member, index) => (
                <span
                  key={member.id}
                  style={{
                    display: "inline-block",
                    maxWidth: "100%",
                    overflowWrap: "anywhere",
                  }}
                >
                  {index > 0 ? "・" : ""}
                  {member.name}
                </span>
              ))}
            </div>
          ) : null}
          <p
            style={{
              marginTop: "calc(var(--u)*1.6)",
              color: COLOR.paper,
              fontSize: "calc(var(--u)*2.6)",
              fontWeight: 700,
              textShadow: `0 0 6px ${COLOR.ink}`,
            }}
          >
            {roomLine(roomId)}
          </p>
        </Fly>
        <Word
          text={room.affordable ? "泊まる" : `あと${room.missingGold}G必要`}
          size={room.affordable ? (wide ? 16 : 14) : wide ? 10 : 9}
          paper
          big
          tilt={-4}
          rotate={-7}
          delay={350}
          style={
            wide
              ? { right: "4vw", bottom: "10%" }
              : { right: "2vw", bottom: "8%" }
          }
          onClick={() => (room.affordable ? void stay() : fx.shake(0.6))}
        />
        <StageChrome>
          <Word
            text="‹ 戻る"
            size={wide ? 4.4 : 4.8}
            tilt={-4}
            rotate={3}
            delay={450}
            style={{ right: "4%", top: wide ? "8%" : "6%" }}
            onClick={() =>
              void nav.go(
                { name: "place", place: "inn" },
                { exit: { z: 1.8, blur: 12, ms: 360 } }
              )
            }
          />
        </StageChrome>
      </LeavingContext.Provider>
      {night?.step === "levelup" ? (
        <LevelUpPanel
          key={night.index}
          entry={levelUps.current[night.index]}
          onOk={() => next()}
        />
      ) : null}
      {night?.step === "ask" ? (
        <AskPanel onChat={() => next(true)} onSleep={() => next(false)} />
      ) : null}
      {night?.step === "talk" ? (
        <NightTalk talk={night.talk} onDone={() => next()} />
      ) : null}
      {night?.step === "sleep" ? <Sleep onDone={next} /> : null}
    </div>
  )
}
