import { motion, useAnimationControls } from "motion/react"
import { seconds } from "@/components/stage/kit"
import { inPhase, eventsOf } from "@/lib/wiz"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useStage } from "@/components/stage/stage-context"
import { useWide, useWideFormation } from "@/components/stage/word"
import { Conversation, conversationBoxHeight } from "@/components/game/talk"
import {
  castLines,
  openingCast,
  type CastLine,
} from "@/components/game/conversation-cast"
import { play } from "@/components/canvas/play"
import { useGame, useGameState } from "@/contexts/game"
import { conceptEntries } from "@/lib/concept/database"
import { portraitFor } from "@/lib/concept/portraits"
import type { PortraitState } from "@/lib/concept/portrait-types"
import { REVERT, STAGE_LAYER } from "@/components/canvas/tokens"
import type { Game } from "@/lib/wiz"
import type {
  ConversationDefinition,
  ConversationSubject,
  ConversationTrigger,
} from "@/lib/wiz/conversations/schema"

/** 会話の終了を待つ。台本選択と既読は Game が所有する。 */
export function playEventConversation(
  game: Game,
  trigger: ConversationTrigger,
  signal?: AbortSignal,
  subject: ConversationSubject = {}
): Promise<void> {
  if (
    signal?.aborted ||
    !game.queries.canStartConversation(game.state, trigger, subject)
  )
    return Promise.resolve()
  return new Promise((resolve) => {
    let unsubscribe = () => {}
    const finish = () => {
      unsubscribe()
      signal?.removeEventListener("abort", finish)
      resolve()
    }
    unsubscribe = game.subscribe(() => {
      if (!game.state.conversation?.active) finish()
    })
    signal?.addEventListener("abort", finish, { once: true })
    const town = inPhase(game, "town")
    const result = eventsOf(
      trigger === "inn"
        ? town?.startConversation(trigger)
        : trigger === "talk"
          ? town?.talkTo(subject.resident ?? "")
          : trigger === "visit"
            ? town?.visit(subject.place ?? "")
            : trigger === "opening"
              ? inPhase(game, "creating")?.startOpening()
              : trigger === "branch"
                ? inPhase(game, "expedition")?.startConversation(trigger)
                : inPhase(game, "pending")?.startConversation(trigger)
    )
    if (!Array.isArray(result)) finish()
  })
}

/** 場所に入ったときの場面を流すか。プレビューでは既定で止める。 */
export const VisitScenesContext = createContext(true)

/** 場所に着いたら、その場所の場面を再生する。条件と確率は Game が判定する。 */
export function useVisitScene(place: string, ready: boolean) {
  const game = useGame()
  const enabled = useContext(VisitScenesContext)
  useEffect(() => {
    if (!ready || !enabled) return
    const controller = new AbortController()
    void playEventConversation(game, "visit", controller.signal, { place })
    return () => controller.abort()
  }, [game, place, ready, enabled])
}

/** 立ち絵の横位置。1人は中央、2人は左右、3人は横に並べる。 */
function portraitLeft(count: number, index: number) {
  if (count === 1) return "14%"
  if (count === 2) return index ? "50%" : "0%"
  return `${index * 31}%`
}

/**
 * 立ち絵の枠の幅と高さ。頭上に少し背景を残し、腰まで入れる。
 * 立ち絵は縦長（3:4）なので、縦長の画面では幅で大きさが決まる。幅を広く取る（2人は会話の演出で左右へ離す）。
 * 縦長は会話の演出で1.25倍に寄るので、そのぶん枠を低くしておく。
 */
function portraitWidth(count: number) {
  return count === 1 ? "72%" : count === 2 ? "50%" : "38%"
}

function portraitHeight(wide: boolean) {
  return wide ? "56%" : "46%"
}

/** 通常プレイと dev 再生の共通表示。 */
export function EventConversation() {
  const game = useGame()
  const state = useGameState()
  const script = game.queries.activeConversation(state)
  return script ? <EventConversationScene key={script.id} /> : null
}

function EventConversationScene() {
  const game = useGame()
  const state = useGameState()
  const script = game.queries.activeConversation(state)!
  return (
    <EventConversationView
      script={script}
      onDone={(picked) => {
        inPhase(game, "conversation")?.finish(picked < 0 ? undefined : picked)
      }}
    />
  )
}

export function EventConversationView({
  script,
  initialLine = 0,
  onLine,
  onDone,
}: {
  script: ConversationDefinition
  initialLine?: number
  onLine?: (index: number) => void
  onDone: (picked: number) => void
}) {
  const portraits = useAnimationControls()
  useEffect(() => () => portraits.stop(), [portraits])
  const stage = useStage()
  const wideFormation = useWideFormation()
  const wide = useWide()
  const elements = useRef<(HTMLDivElement | null)[]>([])
  const images = useRef<(HTMLImageElement | null)[]>([])
  const [ready, setReady] = useState(false)
  const [actorsReady, setActorsReady] = useState(false)
  useEffect(() => {
    if (ready) setActorsReady(true)
  }, [ready])
  useEffect(() => setReady(true), [])
  const root = stage.canvas.current?.parentElement
  if (!ready || !root) return null
  const nameOf = (person: string) =>
    conceptEntries.find((entry) => entry.id === person)?.name ?? person
  const conversationPortrait = (person: string, expression: PortraitState) =>
    portraitFor(
      person,
      expression,
      script.trigger === "inn" ? "sleepwear" : undefined
    )
  // 立ち絵は同時に2人まで。3人目が話すときは、直前に話していない方が退場して入れ替わる
  const speakersOf = (lines: ConversationDefinition["lines"]) =>
    lines.map((line) => line.speaker)
  const firstCast = openingCast(script.participants, [
    ...speakersOf(script.lines),
    ...(script.choice?.options.flatMap((option) => speakersOf(option.lines)) ??
      []),
  ])
  const main = castLines(firstCast, speakersOf(script.lines))
  const replies =
    script.choice?.options.map(
      (option) => castLines(main.end, speakersOf(option.lines)).lines
    ) ?? []
  const speakerLine = (
    line: ConversationDefinition["lines"][number],
    cast: CastLine
  ) => [cast.slot, line.text, nameOf(line.speaker)] as const
  /** 枠の立ち絵を別の人へ。下へ退場してから、次の人が下から入る。 */
  const swap = (image: HTMLImageElement, person: string, src: string) => {
    image.dataset.person = person
    image.alt = nameOf(person)
    void play(
      image,
      [
        { opacity: 1, translate: "0 0" },
        { opacity: 0, translate: "0 40%" },
      ],
      { duration: 160, easing: "ease-in", id: "cast-swap" }
    ).finished.then(() => {
      if (image.dataset.person !== person) return
      image.src = src
      play(
        image,
        [
          { opacity: 0, translate: "0 40%" },
          { opacity: 1, translate: "0 0" },
        ],
        { duration: 240, easing: "ease-out", id: "cast-swap" }
      )
    })
  }
  return createPortal(
    <div
      data-conversation-trigger={script.trigger}
      data-conversation-id={script.id}
      style={{
        ...REVERT,
        position: "absolute",
        inset: 0,
        zIndex: STAGE_LAYER.conversation,
        background: "#12141c88",
        pointerEvents: "auto",
      }}
    >
      <motion.div
        data-conversation-portraits=""
        initial={{ y: "100vh" }}
        animate={portraits}
        style={{ ...REVERT, position: "absolute", inset: 0 }}
      >
        {firstCast.map((person, slot) => (
          <div
            key={slot}
            data-conversation-slot={slot}
            ref={(element) => {
              elements.current[slot] = element
            }}
            style={{
              ...REVERT,
              position: "absolute",
              bottom: `calc(${conversationBoxHeight(wideFormation)} - 4vh)`,
              left: portraitLeft(firstCast.length, slot),
              width: portraitWidth(firstCast.length),
              height: portraitHeight(wide),
            }}
          >
            <img
              ref={(element) => {
                images.current[slot] = element
              }}
              data-person={person}
              src={conversationPortrait(
                person,
                script.trigger === "inn" ? "normal" : "talk"
              )}
              alt={nameOf(person)}
              style={{
                ...REVERT,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "bottom",
              }}
            />
          </div>
        ))}
      </motion.div>
      {actorsReady ? (
        <Conversation
          label={script.title}
          actors={firstCast.map((person, slot) => ({
            el: elements.current[slot],
            image: images.current[slot],
            name: nameOf(person),
          }))}
          script={{
            lines: script.lines.map((line, index) =>
              speakerLine(line, main.lines[index])
            ),
            choice: script.choice && {
              ask: script.choice.ask,
              options: script.choice.options.map(
                (option, picked) =>
                  [
                    option.label,
                    option.lines.map((line, index) =>
                      speakerLine(line, replies[picked][index])
                    ),
                  ] as const
              ),
            },
          }}
          initialLine={initialLine}
          onOpened={() =>
            portraits.start({
              y: 0,
              transition: { duration: seconds(420), ease: [0.22, 1, 0.36, 1] },
            })
          }
          after={() =>
            portraits.start({
              y: "100vh",
              transition: { duration: seconds(300), ease: [0.7, 0, 0.84, 0] },
            })
          }
          onLine={(index, picked) => {
            if (picked < 0) onLine?.(index)
            const line = (
              picked < 0 ? script.lines : script.choice?.options[picked]?.lines
            )?.[index]
            const cast = (picked < 0 ? main.lines : replies[picked])?.[index]
            if (!line || !cast) return
            for (const [slot, person] of cast.cast.entries()) {
              const image = images.current[slot]
              if (!image) continue
              const src =
                conversationPortrait(
                  person,
                  person === line.speaker
                    ? line.expression
                    : script.trigger === "inn"
                      ? "normal"
                      : "talk"
                ) ?? ""
              if (image.dataset.person !== person) swap(image, person, src)
              else if (person === line.speaker || script.trigger === "inn")
                image.src = src
            }
          }}
          onDone={onDone}
        />
      ) : null}
    </div>,
    root
  )
}
