import { useContext, useEffect, useState } from "react"
import { StageChrome } from "@/client/components/stage/stage-chrome"
import { shopLook } from "@/content/looks/shop-look"
import { street } from "@/content/looks/street"
import { placeIdOf } from "@/content/looks/place-id-of"
import { placeName } from "@/content/looks/place-name"
import { sceneOf } from "@/content/looks/scene-of"
import { entranceOf } from "@/content/looks/entrance-of"
import { useArrival } from "@/client/components/game/use-arrival"
import { useNav } from "@/client/components/game/use-nav"
import type { Move } from "@/client/components/game/nav"
import type { Place as PlaceId, ShopId } from "@/client/game/navigation"
import {
  useVisitScene,
  VisitScenesContext,
} from "@/client/components/game/use-visit-scene"
import { SecretRoom } from "@/client/components/screens/secret-room"
import { pickOne } from "@/client/components/stage/pick-one"
import { SlamTitle } from "@/client/components/stage/slam-title"
import { useStage } from "@/client/components/stage/use-stage"
import { EntranceLinks } from "@/client/components/stage/entrance-links"
import { focusMove } from "@/client/components/stage/focus-move"
import { Word } from "@/client/components/stage/word"
import { useWide } from "@/client/components/stage/use-wide"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { UI_LAYER } from "@/client/components/canvas/tokens"
import { Tone, ROOM_WORDS } from "@/client/components/screens/tone"
import { GuildHall } from "@/client/components/screens/guild-hall"
import { Reception } from "@/client/components/screens/reception"

/**
 * 施設の奥へ踏み込んだ場面。宿は部屋、商店街は店を選ぶ。
 * ギルドはホールの絵の受付・宿・秘密の部屋へ。受付は受付嬢。
 */
type Props = { place: PlaceId }

export function Place(props: Props) {
  const [secret, setSecret] = useState(false)
  const game = useGame()
  const state = useGameState()
  const nav = useNav()
  const stage = useStage()
  const wide = useWide()
  const rooms = game.queries.rooms(state)
  const art = sceneOf(props.place, wide)
  // 画面の幅が変わって絵が替わったときも、読み込んでから差し替える
  useEffect(() => void stage.art(art), [stage, art])
  const ready = useArrival(
    art,
    pickOne(["crane", "dolly", "pan", "tilt"] as const)
  )
  useVisitScene(placeIdOf(props.place), ready)
  const visitScenes = useContext(VisitScenesContext)
  // 会話の間と、これから必ず流れる場面が残っている間は、操作・案内・用紙を出さない（会話の後ろに残さない）
  const scene =
    !!game.queries.activeConversation(state) ||
    (visitScenes &&
      game.queries.visitSceneAwaiting(state, placeIdOf(props.place)))
  if (!ready) return null
  // 行き先を選ぶと、背景のその場所（札・吹き出しの先）へ寄ってから切り替える
  const room = (id: string, element: HTMLElement) =>
    void nav.go({ name: "room", room: id }, focusMove(stage, { element }))
  /** 受付と宿はギルドのホールへ、ホールと商店街は街へ戻る。 */
  const back: PlaceId | null =
    props.place === "reception" || props.place === "inn" ? "guild" : null
  const shop = (id: ShopId, move: Move) =>
    void nav.go({ name: "shop", shop: id }, move)
  return (
    <div className="ui-layer" style={UI_LAYER}>
      <Tone />
      {!scene ? (
        <>
          {props.place !== "guild" && props.place !== "reception" ? (
            <SlamTitle
              text={placeName(props.place)}
              size={wide ? 13 : placeName(props.place).length > 3 ? 10 : 16}
            />
          ) : null}
          {props.place === "inn"
            ? rooms.map((entry, index) => {
                const look = ROOM_WORDS[index % ROOM_WORDS.length]
                return (
                  <Word
                    key={entry.id}
                    text={entry.name}
                    size={look.size(wide)}
                    paper={look.paper}
                    big
                    tilt={look.tilt}
                    rotate={look.rotate}
                    from={look.from}
                    delay={250 + index * 90}
                    style={wide ? look.wide : look.narrow}
                    onClick={(element) => room(entry.id, element)}
                  />
                )
              })
            : null}
          {props.place === "shop" ? (
            // 市場の絵の中の店の入口へ吹き出しを向ける
            <EntranceLinks
              wide={wide}
              links={street().map((id) => ({
                id,
                label: shopLook(id).name,
                anchor: entranceOf("shop", id, wide),
                onClick: (move) => shop(id, move),
              }))}
            />
          ) : null}
          {props.place === "guild" ? (
            <GuildHall secret={secret} onSecret={() => setSecret(true)} />
          ) : null}
          {props.place === "reception" ? <Reception /> : null}
          <StageChrome>
            <Word
              text="‹ 戻る"
              size={wide ? 4.4 : 4.8}
              tilt={-4}
              rotate={3}
              delay={400}
              style={{ right: "4%", top: wide ? "9%" : "8%" }}
              onClick={() =>
                void nav.go(
                  back ? { name: "place", place: back } : { name: "town" },
                  { exit: { z: 0.7, blur: 12, ms: 380 }, enter: "crane" }
                )
              }
            />
          </StageChrome>
        </>
      ) : null}
      {secret ? (
        <div
          aria-hidden={scene || undefined}
          inert={scene}
          style={{
            display: "contents",
            visibility: scene ? "hidden" : undefined,
          }}
        >
          <SecretRoom keeper={null} onClose={() => setSecret(false)} />
        </div>
      ) : null}
    </div>
  )
}
