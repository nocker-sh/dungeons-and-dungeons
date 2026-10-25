import { after, parallel } from "@/components/canvas/animation"
import { useAnimationEffect } from "@/components/canvas/use-animation"
import { useRef, useState, type CSSProperties } from "react"
import { portraitOf, type NightTalk as NightScript } from "@/lib/content/looks"
import { Conversation } from "@/components/game/talk"
import { portraitFor } from "@/lib/concept/portraits"
import { COLOR, EASE_OUT } from "@/components/stage/kit"
import { GUIDE_BOX, GUIDE_IMAGE } from "@/components/stage/guide"
import { SlantPanel, type PanelHandle } from "@/components/stage/panel"
import { LeavingContext } from "@/components/stage/stage-context"
import { useFx } from "@/components/stage/use-fx"
import { Word, useWide } from "@/components/stage/word"
import { useGame } from "@/contexts/game"
import { inPhase } from "@/lib/wiz"
import { play } from "@/components/canvas/play"

/** 「〇〇たちが、まだ起きて話している……」 */
export function AskPanel({
  onChat,
  onSleep,
}: {
  onChat: () => void
  onSleep: () => void
}) {
  const wide = useWide()
  const panel = useRef<PanelHandle>(null)
  const [closing, setClosing] = useState(false)
  const pick = (then: () => void) => async () => {
    setClosing(true)
    await panel.current?.close()
    then()
  }
  return (
    <LeavingContext.Provider value={closing}>
      <SlantPanel
        ref={panel}
        z={33}
        tone="#12101a"
        inset={{ top: "4%", bottom: "2%" }}
        rotate={-3}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            top: "30%",
            textAlign: "center",
            color: COLOR.paper,
            fontSize: "calc(var(--u)*4)",
            fontWeight: 900,
            rotate: "-3deg",
            textShadow: `0 0 8px ${COLOR.ink}`,
          }}
        >
          まだ起きている人の話し声が聞こえる……
        </div>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <Word
            text="雑談する"
            size={wide ? 13 : 12}
            paper
            big
            tilt={-4}
            rotate={-6}
            style={{
              pointerEvents: "auto",
              ...(wide
                ? { right: "8vw", bottom: "16%" }
                : { right: "3vw", bottom: "14%" }),
            }}
            onClick={pick(onChat)}
          />
          <Word
            text="寝る"
            size={8}
            big
            tilt={3}
            rotate={4}
            from="left"
            delay={90}
            style={{
              pointerEvents: "auto",
              ...(wide
                ? { left: "10vw", bottom: "18%" }
                : { left: "4vw", bottom: "30%" }),
            }}
            onClick={pick(onSleep)}
          />
        </div>
      </SlantPanel>
    </LeavingContext.Provider>
  )
}

/** 夜の会話。二人が左右から入り、吹き出しで話し、最後に選んだ相手の親しみが上がる。 */
export function NightTalk({
  talk,
  onDone,
}: {
  talk: NightScript
  onDone: () => void
}) {
  const game = useGame()
  const fx = useFx()
  const wide = useWide()
  const panel = useRef<PanelHandle>(null)
  const left = useRef<HTMLDivElement>(null)
  const right = useRef<HTMLDivElement>(null)
  const leftImage = useRef<HTMLImageElement>(null)
  const rightImage = useRef<HTMLImageElement>(null)
  const [ready, setReady] = useState(false)
  const [leftMemberId, rightMemberId] = talk.pair
  const actorIndex = (id: string) => (id === leftMemberId ? 0 : 1)
  useAnimationEffect(() => {
    const entrance = parallel(() => {
      play(
        left.current,
        [{ transform: "translateX(-60vw)" }, { transform: "none" }],
        { duration: 520, easing: EASE_OUT }
      )
      play(
        right.current,
        [{ transform: "translateX(60vw)" }, { transform: "none" }],
        { duration: 520, easing: EASE_OUT }
      )
    })
    after(entrance, () => setReady(true))
  }, [])
  const leftMember = game.queries.member(game.state, leftMemberId)
  const rightMember = game.queries.member(game.state, rightMemberId)
  const actor = (
    id: string,
    side: "left" | "right",
    ref: React.RefObject<HTMLDivElement | null>,
    imageRef: React.RefObject<HTMLImageElement | null>
  ) => (
    <div
      ref={ref}
      className="guide talker"
      aria-hidden="true"
      style={
        {
          ...GUIDE_BOX,
          [side]: `${wide ? 4 : -16}%`,
          ...(side === "right" ? { left: "auto" } : {}),
          height: `${wide ? 92 : 62}%`,
        } as CSSProperties
      }
    >
      <img
        ref={imageRef}
        src={
          portraitFor(
            game.queries.look(game.state, id),
            "normal",
            "sleepwear"
          ) ?? portraitOf(game.queries.look(game.state, id), "normal")
        }
        alt=""
        style={{
          ...GUIDE_IMAGE,
          ...(side === "right" ? { transform: "scaleX(-1)" } : {}),
        }}
      />
    </div>
  )
  return (
    <SlantPanel
      ref={panel}
      z={33}
      tone="#12101a"
      inset={{ top: "4%", bottom: "2%" }}
      rotate={-3}
    >
      {actor(leftMemberId, "left", left, leftImage)}
      {actor(rightMemberId, "right", right, rightImage)}
      {ready ? (
        <Conversation
          actors={[
            {
              el: left.current,
              image: leftImage.current,
              name: leftMember?.name,
            },
            {
              el: right.current,
              image: rightImage.current,
              name: rightMember?.name,
            },
          ]}
          script={{
            lines: talk.lines.map(
              ([id, text]) => [actorIndex(id), text] as const
            ),
            choice: {
              ask: talk.choice.ask,
              options: talk.choice.options.map(
                ([label, id, reply]) =>
                  [label, [[actorIndex(id), reply] as const]] as const
              ),
            },
          }}
          onLine={(index, picked) => {
            const line = talk.lines[index]
            const reply = talk.choice.options[picked]
            const speaker = picked < 0 ? line?.[0] : reply?.[1]
            const expression =
              picked < 0 ? (line?.[2] ?? "talk") : (reply?.[3] ?? "happy")
            for (const person of talk.pair) {
              const image = (actorIndex(person) ? rightImage : leftImage)
                .current
              if (!image) continue
              const look = game.queries.look(game.state, person)
              const state = person === speaker ? expression : "normal"
              image.src =
                portraitFor(look, state, "sleepwear") ?? portraitOf(look, state)
            }
          }}
          after={async (picked) => {
            const liked = talk.choice.options[picked]?.[1]
            if (!liked) return
            inPhase(game, "town")?.chat(liked)
            const image = (actorIndex(liked) ? rightImage : leftImage).current
            const q = fx.center(image, 0.3)
            await parallel(() => {
              fx.burst(q.x, q.y, fx.size().height * 0.3, "親しさ +1", {
                fill: COLOR.blood,
                ink: COLOR.paper,
                hold: 1000,
              })
              fx.shards(q.x, q.y, {
                n: 16,
                colors: [COLOR.paper, COLOR.blood],
                power: 1.2,
              })
            })
          }}
          onDone={async () => {
            await panel.current?.close()
            onDone()
          }}
        />
      ) : null}
    </SlantPanel>
  )
}
