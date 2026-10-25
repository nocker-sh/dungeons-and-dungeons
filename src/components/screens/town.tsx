import { useEffect } from "react"
import { OnboardingNote } from "@/components/game/onboarding-note"
import { Settings } from "@/components/game/settings"
import { animationTiming } from "@/components/stage/timing"
import { entranceOf, placeIdOf, sceneOf } from "@/lib/content/looks"
import {
  playEventConversation,
  useVisitScene,
} from "@/components/game/event-conversation"
import { useFormation } from "@/components/game/formation"
import { useArrival, useNav, type Move } from "@/components/game/nav"
import { ease } from "@/components/stage/camera"
import { useStage } from "@/components/stage/stage-context"
import { Word, useWide } from "@/components/stage/word"
import {
  EntranceLinks,
  type EntranceLink,
} from "@/components/stage/entrance-links"
import { PALETTE, REVERT, UI_LAYER, unit } from "@/components/canvas/tokens"
import { useGame, useGameState } from "@/contexts/game"

/** ギルドの入口・市場への脇道・奥の門（ダンジョン）へ。 */
export function Town({ intro = false }: { intro?: boolean }) {
  const game = useGame()
  const state = useGameState()
  const stage = useStage()
  const nav = useNav()
  const formation = useFormation()
  const wide = useWide()
  const art = sceneOf("town", wide)
  // 画面の幅が変わって絵が替わったときも、読み込んでから差し替える
  useEffect(() => void stage.art(art), [stage, art])
  const ready = useArrival(art, intro ? "none" : "pan", 4, async () => {
    if (!intro) return
    stage.bars(18)
    stage.camera.cut({ x: -120, y: -220, z: 1.3, r: -3, blur: 0 })
    await stage.camera.to(
      { x: 0, y: 0, z: 1, r: 0 },
      animationTiming.opening,
      ease.inOut
    )
    stage.bars(4)
  })
  useVisitScene(placeIdOf("town"), ready)
  if (!ready || game.queries.result(state)) return null
  const leave = () => formation.lift(null)
  const readiness = game.queries.readiness(state)
  const companion = game.queries.hero(state).companion
  const onboarding = game.queries.onboarding(state)
  const gathering = !!onboarding && onboarding.step !== "depart"
  // 行き先の吹き出しを押すと、背景のその場所へ寄ってから切り替える（move は EntranceLinks が作る）
  const toDungeon = (move: Move) => {
    leave()
    stage.bars(9)
    void nav.go({ name: "outskirts" }, move)
  }
  const enterPlace = (place: "guild" | "shop", move: Move) => {
    leave()
    void nav.go({ name: "place", place }, move)
  }
  const entrances: EntranceLink[] = [
    {
      id: "guild",
      label: "冒険者ギルド",
      lines: ["冒険者", "ギルド"],
      primary: gathering,
      anchor: entranceOf("town", "guild", wide),
      onClick: (move) => enterPlace("guild", move),
    },
    {
      // 画像の奥の門。ダンジョン（街はずれの乗り場）へ。登録前は行けない
      id: "dungeon",
      label: "ダンジョン",
      primary: !gathering && onboarding?.step === "depart",
      disabled: gathering || readiness.unregistered,
      anchor: entranceOf("town", "dungeon", wide),
      onClick: toDungeon,
    },
    {
      id: "shop",
      label: "商店街",
      disabled: gathering,
      anchor: entranceOf("town", "shop", wide),
      onClick: (move) => enterPlace("shop", move),
    },
  ]
  return (
    <div className="ui-layer" style={UI_LAYER}>
      {onboarding ? (
        <OnboardingNote
          className={gathering ? "short-party" : ""}
          title={
            onboarding.step === "register"
              ? "まずは冒険者ギルドへ"
              : onboarding.step === "recruit"
                ? `仲間をあと${onboarding.remaining}人集めよう`
                : "3人そろった！ ダンジョンへ"
          }
          style={{
            position: "absolute",
            top: "6%",
            left: "4%",
            right: "4%",
            maxWidth: 620,
            margin: "0 auto",
            zIndex: 22,
          }}
        >
          {onboarding.step === "register"
            ? "光っているギルドで名前を登録しよう。"
            : onboarding.step === "recruit"
              ? "ギルドの「募集」で契約すると、仲間が隊列に加わる。"
              : "奥の門の「ダンジョン」から、最初の探索に出かけよう。"}
        </OnboardingNote>
      ) : readiness.short ? (
        <div
          className="short-party"
          role="status"
          style={{
            ...REVERT,
            display: "block",
            position: "absolute",
            zIndex: 22,
            left: "4%",
            right: "4%",
            top: "6%",
            padding: `${unit(0.8)} ${unit(1.6)}`,
            background: PALETTE.blood,
            color: PALETTE.paper,
            fontSize: unit(2.6),
            fontWeight: 700,
            textAlign: "center",
            clipPath: "polygon(0.5% 8%, 100% 0, 99.5% 94%, 0 100%)",
          }}
        >
          仲間が3人そろっていない（あと{readiness.short}
          人）。冒険者ギルドの募集で集める。
        </div>
      ) : null}
      <EntranceLinks links={entrances} wide={wide} />
      <Settings onOpen={leave} />
      {companion ? (
        <Word
          text="ロクスと話す"
          size={wide ? 5 : 5.5}
          paper
          tilt={-2}
          style={{
            position: "absolute",
            left: "4%",
            // 横長ではギルドの吹き出しの尾と重ならないよう、下の石段の前へ
            bottom: wide ? "22%" : "38%",
            zIndex: 22,
          }}
          disabled={!companion.canTalk}
          onClick={() => {
            leave()
            void playEventConversation(game, "talk", undefined, {
              resident: companion.id,
            })
          }}
        />
      ) : null}
    </div>
  )
}
