import { motion, useAnimationControls } from "motion/react"
import { seconds } from "@/client/components/stage/seconds"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useStage } from "@/client/components/stage/use-stage"
import { useWide } from "@/client/components/stage/use-wide"
import { useWideFormation } from "@/client/components/stage/use-wide-formation"
import { Conversation } from "@/client/components/game/conversation"
import { conversationBoxHeight } from "@/client/components/game/conversation-box-height"
import { castLines } from "@/client/components/game/cast-lines"
import { openingCast } from "@/client/components/game/opening-cast"
import type { CastLine } from "@/client/components/game/cast-lines"
import { play } from "@/client/components/canvas/play"
import { conceptEntries } from "@/concept/database"
import { portraitFor } from "@/concept/portraits"
import type { PortraitState } from "@/concept/portrait-types"
import { REVERT, STAGE_LAYER } from "@/client/components/canvas/tokens"
import type { ConversationDefinition } from "@/lib/wiz/conversations/schema"
import { portraitLeft } from "@/client/components/game/portrait-left"
import { portraitWidth } from "@/client/components/game/portrait-width"
import { portraitHeight } from "@/client/components/game/portrait-height"

export type Props = {
  script: ConversationDefinition
  initialLine?: number
  onLine?: (index: number) => void
  onDone: (picked: number) => void
}

export function EventConversationView(props: Props) {
  const initialLine = props.initialLine === undefined ? 0 : props.initialLine

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
      props.script.trigger === "inn" ? "sleepwear" : undefined
    )
  // 立ち絵は同時に2人まで。3人目が話すときは、直前に話していない方が退場して入れ替わる
  const speakersOf = (lines: ConversationDefinition["lines"]) =>
    lines.map((line) => line.speaker)
  const firstCast = openingCast(props.script.participants, [
    ...speakersOf(props.script.lines),
    ...(props.script.choice?.options.flatMap((option) =>
      speakersOf(option.lines)
    ) ?? []),
  ])
  const main = castLines(firstCast, speakersOf(props.script.lines))
  const replies =
    props.script.choice?.options.map(
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
      data-conversation-trigger={props.script.trigger}
      data-conversation-id={props.script.id}
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
                props.script.trigger === "inn" ? "normal" : "talk"
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
          label={props.script.title}
          actors={firstCast.map((person, slot) => ({
            el: elements.current[slot],
            image: images.current[slot],
            name: nameOf(person),
          }))}
          script={{
            lines: props.script.lines.map((line, index) =>
              speakerLine(line, main.lines[index])
            ),
            choice: props.script.choice && {
              ask: props.script.choice.ask,
              options: props.script.choice.options.map(
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
            if (picked < 0) props.onLine?.(index)
            const line = (
              picked < 0
                ? props.script.lines
                : props.script.choice?.options[picked]?.lines
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
                    : props.script.trigger === "inn"
                      ? "normal"
                      : "talk"
                ) ?? ""
              if (image.dataset.person !== person) swap(image, person, src)
              else if (
                person === line.speaker ||
                props.script.trigger === "inn"
              )
                image.src = src
            }
          }}
          onDone={props.onDone}
        />
      ) : null}
    </div>,
    root
  )
}
