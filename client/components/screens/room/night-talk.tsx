import { after } from "@/client/components/canvas/after"
import { parallel } from "@/client/components/canvas/parallel"
import { useAnimationEffect } from "@/client/components/canvas/use-animation-effect"
import { useRef, useState } from "react"
import type { CSSProperties } from "react"
import { portraitOf } from "@/content/looks/portrait-of"
import type { NightTalk as NightScript } from "@/content/looks/types"
import { Conversation } from "@/client/components/game/conversation"
import { portraitFor } from "@/concept/portraits"
import { COLOR, EASE_OUT } from "@/client/components/stage/kit"
import { GUIDE_BOX, GUIDE_IMAGE } from "@/client/components/stage/guide"
import { SlantPanel } from "@/client/components/stage/slant-panel"
import type { PanelHandle } from "@/client/components/stage/slant-panel"
import { useFx } from "@/client/components/stage/use-fx"
import { useWide } from "@/client/components/stage/use-wide"
import { useGame } from "@/client/contexts/use-game"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { play } from "@/client/components/canvas/play"

/** 夜の会話。二人が左右から入り、吹き出しで話し、最後に選んだ相手の親しみが上がる。 */
type Props = {
  talk: NightScript
  onDone: () => void
}

export function NightTalk(props: Props) {
  const game = useGame()
  const fx = useFx()
  const wide = useWide()
  const panel = useRef<PanelHandle>(null)
  const left = useRef<HTMLDivElement>(null)
  const right = useRef<HTMLDivElement>(null)
  const leftImage = useRef<HTMLImageElement>(null)
  const rightImage = useRef<HTMLImageElement>(null)
  const [ready, setReady] = useState(false)
  const [leftMemberId, rightMemberId] = props.talk.pair
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
            lines: props.talk.lines.map(
              ([id, text]) => [actorIndex(id), text] as const
            ),
            choice: {
              ask: props.talk.choice.ask,
              options: props.talk.choice.options.map(
                ([label, id, reply]) =>
                  [label, [[actorIndex(id), reply] as const]] as const
              ),
            },
          }}
          onLine={(index, picked) => {
            const line = props.talk.lines[index]
            const reply = props.talk.choice.options[picked]
            const speaker = picked < 0 ? line?.[0] : reply?.[1]
            const expression =
              picked < 0 ? (line?.[2] ?? "talk") : (reply?.[3] ?? "happy")
            for (const person of props.talk.pair) {
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
            const liked = props.talk.choice.options[picked]?.[1]
            if (!liked) return
            inPhase(game, "town")?.chat(liked)
            const image = (actorIndex(liked) ? rightImage : leftImage).current
            const q = fx.center(image, 0.3)
            const { width, height } = fx.size()
            await parallel(() => {
              // 立ち絵は画面外へはみ出す。通知は画面中央に、幅にも収まる大きさで出す。
              fx.burst(
                width / 2,
                height * 0.3,
                Math.min(width * 0.5, height * 0.3),
                "親しさ +1",
                {
                  fill: COLOR.blood,
                  ink: COLOR.paper,
                  hold: 1000,
                }
              )
              fx.shards(q.x, q.y, {
                n: 16,
                colors: [COLOR.paper, COLOR.blood],
                power: 1.2,
              })
            })
          }}
          onDone={async () => {
            await panel.current?.close()
            props.onDone()
          }}
        />
      ) : null}
    </SlantPanel>
  )
}
