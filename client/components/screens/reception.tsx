import { useState } from "react"
import { guideLine } from "@/content/looks/guide-line"
import { keeperOf } from "@/content/looks/keeper-of"
import { personFor } from "@/content/looks/person-for"
import { standOf } from "@/content/looks/stand-of"
import { portraitOf } from "@/content/looks/portrait-of"
import { ListView } from "@/client/components/game/list-view/list-view"
import { useListBurst } from "@/client/components/game/list-view/use-list-burst"
import { useNav } from "@/client/components/game/use-nav"
import { playEventConversation } from "@/client/components/game/play-event-conversation"
import { pickOne } from "@/client/components/stage/pick-one"
import { Guide } from "@/client/components/stage/guide"
import { useTakeover } from "@/client/components/stage/use-takeover"
import {
  LeavingContext,
  useLeaving,
} from "@/client/components/stage/use-leaving"
import { useFx } from "@/client/components/stage/use-fx"
import { Word } from "@/client/components/stage/word"
import { useWide } from "@/client/components/stage/use-wide"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { eventsOf } from "@/lib/wiz/phases/events-of"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { unit } from "@/client/components/canvas/tokens"
import { GuildRegistration } from "@/client/components/game/guild-registration"
import { OnboardingNote } from "@/client/components/game/onboarding-note"

/** ギルドの受付：受付嬢と「クエスト」「募集」「会話」。名前の登録もここ。 */
export function Reception() {
  const nav = useNav()
  const game = useGame()
  const state = useGameState()
  const fx = useFx()
  const wide = useWide()
  const leaving = useLeaving()
  const burst = useListBurst()
  const keeper = keeperOf(personFor("guild"))
  const [say, setSay] = useState<string>(keeper.lines[0])
  const [overlay, setOverlay] = useState<"recruits" | "talk" | null>(null)
  useTakeover("list", !!overlay)
  const [menuKey, setMenuKey] = useState(0)
  /** 話しかける。台本の選択・既読・フラグは Game が持つ。 */
  const talk = () => {
    open("talk")
    void playEventConversation(game, "talk", undefined, {
      resident: personFor("guild"),
    }).then(close)
  }
  const open = (next: NonNullable<typeof overlay>) => {
    setOverlay(next)
  }
  const close = () => {
    setOverlay(null)
    setMenuKey((key) => key + 1)
    setSay(pickOne(keeper.lines))
  }
  const recruits = game.queries.recruits(state)
  const reroll = game.queries.reroll(state)
  const onboarding = game.queries.onboarding(state)
  const gathering = onboarding?.step === "recruit"
  if (game.queries.hero(state).registrationPending) {
    return <GuildRegistration />
  }
  return (
    <>
      <Guide
        img={portraitOf(
          personFor("guild"),
          overlay === "talk" ? "talk" : "normal"
        )}
        say={
          onboarding
            ? guideLine(gathering ? "guild-recruit" : "guild-ready")
            : say
        }
        className="keeper"
        style={standOf("reception", wide)}
      />
      <LeavingContext.Provider value={leaving || !!overlay}>
        <div
          key={menuKey}
          style={{
            display: "contents",
          }}
        >
          {!gathering ? (
            <Word
              text="クエスト"
              size={wide ? 14 : 12}
              paper
              big
              tilt={-3}
              rotate={-6}
              delay={300}
              style={
                wide
                  ? { right: "4vw", bottom: "10%" }
                  : { right: "2vw", bottom: "8%" }
              }
              onClick={() => void nav.go({ name: "quests" }, { enter: "none" })}
            />
          ) : null}
          <Word
            text="募集"
            size={gathering ? 13 : 9}
            paper={gathering}
            big
            tilt={2}
            rotate={4}
            delay={380}
            style={
              gathering
                ? { right: "8vw", bottom: "12%" }
                : wide
                  ? // 「クエスト」の幅は画面の短い辺で決まるので、その左へ同じ単位で置く
                    { right: `calc(4vw + ${unit(64)})`, bottom: "12%" }
                  : { right: "4vw", bottom: "28%" }
            }
            onClick={() => open("recruits")}
          />
          {!gathering ? (
            <Word
              text="会話"
              size={8}
              big
              tilt={-1.5}
              rotate={-3}
              delay={460}
              style={
                wide
                  ? { right: "30vw", bottom: "34%" }
                  : { right: "36vw", bottom: "40%" }
              }
              onClick={talk}
            />
          ) : null}
        </div>
      </LeavingContext.Provider>
      {onboarding && !overlay ? (
        <OnboardingNote
          title={
            gathering
              ? `仲間をあと${onboarding.remaining}人`
              : "3人の隊列が完成！"
          }
          style={{
            position: "absolute",
            left: wide ? "52%" : "40%",
            right: "5%",
            bottom: "34%",
            zIndex: 23,
          }}
        >
          {gathering
            ? "「募集」を開いて、冒険者を選び契約しよう。"
            : "「戻る」でホール、もう一度「戻る」で街へ。"}
        </OnboardingNote>
      ) : null}
      {overlay === "recruits" ? (
        <ListView
          title="募集"
          gold={state.gold}
          notice={
            onboarding ? (
              <OnboardingNote
                title={
                  gathering
                    ? `仲間を集めよう　${onboarding.count}/${onboarding.total}人`
                    : "3人そろった！"
                }
                style={{ padding: "6px 12px" }}
              >
                {gathering
                  ? `冒険者を選んで「契約する」。あと${onboarding.remaining}人で出発できる。`
                  : "「戻る」で街へ戻り、ダンジョンへ出発しよう。"}
              </OnboardingNote>
            ) : undefined
          }
          extra={
            gathering
              ? undefined
              : {
                  label: `${reroll.price}G で募集を入れ替える`,
                  onClick: () => {
                    if (
                      eventsOf(inPhase(game, "town")?.reroll()) instanceof
                      GameCommandError
                    )
                      fx.shake(0.6)
                    else fx.shake(0.4)
                  },
                }
          }
          tabs={[
            {
              name: "冒険者",
              rows: recruits.map((recruit) => ({
                key: recruit.id,
                icon: "sword",
                name: recruit.name,
                stat: `${recruit.rank ? `${recruit.rank}・` : ""}${recruit.roleName}・${recruit.job}・Lv${recruit.lv}・成長 ${recruit.growthTypeName}・流派 ${recruit.schoolNames.length ? recruit.schoolNames.join("・") : "なし"}`,
                desc: [
                  recruit.joins
                    ? "契約するとすぐ隊列に入る。"
                    : "契約すると控えに入る。",
                  recruit.fixedArmor
                    ? "ユニークの仲間は装備を変えられない代わりに、加入時から強い。固有の武器は鍛冶屋で鍛え直す。"
                    : recruit.unique
                      ? "専用の武器を持つ。武器は付け替えられず、鍛冶屋で鍛え直す。防具は着替えられる。"
                      : "",
                ]
                  .filter(Boolean)
                  .join(""),
                badge: recruit.hired ? "" : `${recruit.price}G`,
                sub: recruit.hired ? "契約済み" : undefined,
              })),
            },
          ]}
          action={(row) => {
            const recruit = recruits.find((entry) => entry.id === row.key)
            if (!recruit || recruit.hired) return null
            return recruit.affordable
              ? `${recruit.price}G で契約する`
              : "お金が足りない"
          }}
          onAction={(row, at) => {
            if (
              Array.isArray(eventsOf(inPhase(game, "town")?.recruit(row.key)))
            )
              burst(at, "")
            else fx.shake(0.6)
          }}
          onClose={close}
        />
      ) : null}
    </>
  )
}
