import { entranceOf } from "@/content/looks/entrance-of"
import { useNav } from "@/client/components/game/use-nav"
import type { Move } from "@/client/components/game/nav"
import type { Place as PlaceId } from "@/client/game/navigation"
import {
  LeavingContext,
  useLeaving,
} from "@/client/components/stage/use-leaving"
import { EntranceLinks } from "@/client/components/stage/entrance-links"
import type { EntranceLink } from "@/client/components/stage/entrance-links-shared"
import { useWide } from "@/client/components/stage/use-wide"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { OnboardingNote } from "@/client/components/game/onboarding-note"

/** 冒険者ギルドのホール：絵の中の「受付」「宿」「秘密の部屋」へ。 */
type Props = {
  secret: boolean
  onSecret: () => void
}

export function GuildHall(props: Props) {
  const nav = useNav()
  const game = useGame()
  const state = useGameState()
  const wide = useWide()
  const leaving = useLeaving()
  const onboarding = game.queries.onboarding(state)
  const gathering = !!onboarding && onboarding.step !== "depart"
  const enter = (place: PlaceId, move: Move) =>
    void nav.go({ name: "place", place }, move)
  const anchor = (key: string) => entranceOf("guild", key, wide)
  const links: EntranceLink[] = [
    {
      id: "reception",
      label: "受付",
      primary: gathering,
      anchor: anchor("reception"),
      onClick: (move) => enter("reception", move),
    },
    {
      id: "inn",
      label: "宿",
      disabled: gathering,
      anchor: anchor("inn"),
      onClick: (move) => enter("inn", move),
    },
    {
      id: "secret",
      label: "秘密の部屋",
      lines: ["秘密の", "部屋"],
      disabled: gathering,
      anchor: anchor("secret"),
      onClick: props.onSecret,
    },
  ]
  return (
    <>
      <LeavingContext.Provider value={leaving || props.secret}>
        <EntranceLinks links={links} wide={wide} />
      </LeavingContext.Provider>
      {onboarding && !props.secret ? (
        <OnboardingNote
          title={
            onboarding.step === "register"
              ? "受付で名前を登録しよう"
              : gathering
                ? `仲間をあと${onboarding.remaining}人`
                : "3人の隊列が完成！"
          }
          style={{
            position: "absolute",
            left: "5%",
            right: "5%",
            top: wide ? "16%" : "15%",
            maxWidth: 620,
            margin: "0 auto",
            zIndex: 23,
          }}
        >
          {gathering
            ? "光っている「受付」へ。受付嬢が登録と募集を受け付ける。"
            : "「戻る」で街へ。ダンジョンに出発しよう。"}
        </OnboardingNote>
      ) : null}
    </>
  )
}
