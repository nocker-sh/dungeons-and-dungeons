import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { StageChrome } from "@/components/stage/chrome"
import { motion } from "motion/react"
import {
  guideLine,
  keeperOf,
  personFor,
  placeIdOf,
  placeName,
  portraitOf,
  sceneOf,
  shopLook,
  standOf,
  entranceOf,
  street,
} from "@/lib/content/looks"
import { ListView, useListBurst } from "@/components/game/list-view"
import {
  useArrival,
  useNav,
  type Place as PlaceId,
  type ShopId,
  type Move,
} from "@/components/game/nav"
import {
  playEventConversation,
  useVisitScene,
  VisitScenesContext,
} from "@/components/game/event-conversation"
import { SecretRoom } from "@/components/screens/secret"
import { EASE_OUT, pickOne } from "@/components/stage/kit"
import { Guide, SlamTitle } from "@/components/stage/guide"
import { useTakeover } from "@/components/stage/takeover"
import {
  LeavingContext,
  useLeaving,
  useStage,
} from "@/components/stage/stage-context"
import {
  EntranceLinks,
  type EntranceLink,
} from "@/components/stage/entrance-links"
import { focusMove } from "@/components/stage/focus-zoom"
import { useFx } from "@/components/stage/use-fx"
import { Word, useWide } from "@/components/stage/word"
import { useGame, useGameState } from "@/contexts/game"
import { GameCommandError, eventsOf, inPhase } from "@/lib/wiz"
import { UI_LAYER, unit } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"
import { GuildRegistration } from "@/components/game/guild-registration"
import { OnboardingNote } from "@/components/game/onboarding-note"

type WordLook = {
  size: (wide: boolean) => number
  paper?: boolean
  tilt: number
  rotate: number
  from: "left" | "right"
  wide: CSSProperties
  narrow: CSSProperties
}

/** 宿の部屋の札の置き方。部屋はデータの順に並べる。 */
const ROOM_WORDS: readonly WordLook[] = [
  {
    size: () => 8,
    tilt: 2,
    rotate: 4,
    from: "right",
    wide: { left: "8vw", bottom: "14%" },
    narrow: { left: "4vw", bottom: "12%" },
  },
  {
    size: (wide) => (wide ? 12 : 10),
    paper: true,
    tilt: -3,
    rotate: -6,
    from: "left",
    wide: { right: "5vw", bottom: "12%" },
    narrow: { right: "2vw", bottom: "30%" },
  },
  {
    size: () => 8,
    tilt: -1.5,
    rotate: -3,
    from: "right",
    wide: { right: "12vw", bottom: "46%" },
    narrow: { right: "6vw", bottom: "50%" },
  },
]

/** 施設の場面：絵の上に斜めのトーンがゆっくり流れ続ける。 */
export function Tone() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    play(
      ref.current,
      [
        { clipPath: "polygon(0 0, 0 0, -30% 100%, -30% 100%)" },
        { clipPath: "polygon(0 0, 130% 0, 100% 100%, -30% 100%)" },
      ],
      {
        duration: 500,
        easing: EASE_OUT,
        fill: "both",
      }
    )
  }, [])
  return (
    <motion.div
      ref={ref}
      aria-hidden="true"
      animate={{ backgroundPosition: ["0 0", "60px -36px"] }}
      transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundPosition: "0 0",
        backgroundImage:
          "repeating-linear-gradient(-60deg, rgb(238 235 227 / .06) 0 10px, transparent 10px 28px)",
        maskImage:
          "linear-gradient(100deg, #000, transparent 45%, transparent 70%, #000)",
        WebkitMaskImage:
          "linear-gradient(100deg, #000, transparent 45%, transparent 70%, #000)",
      }}
    />
  )
}

/**
 * 施設の奥へ踏み込んだ場面。宿は部屋、商店街は店を選ぶ。
 * ギルドはホールの絵の受付・宿・秘密の部屋へ。受付は受付嬢。
 */
export function Place({ place }: { place: PlaceId }) {
  const game = useGame()
  const state = useGameState()
  const nav = useNav()
  const stage = useStage()
  const wide = useWide()
  const rooms = game.queries.rooms(state)
  const art = sceneOf(place, wide)
  // 画面の幅が変わって絵が替わったときも、読み込んでから差し替える
  useEffect(() => void stage.art(art), [stage, art])
  const ready = useArrival(
    art,
    pickOne(["crane", "dolly", "pan", "tilt"] as const)
  )
  useVisitScene(placeIdOf(place), ready)
  const visitScenes = useContext(VisitScenesContext)
  // 会話の間と、これから必ず流れる場面が残っている間は、操作・案内・用紙を出さない（会話の後ろに残さない）
  const scene =
    !!game.queries.activeConversation(state) ||
    (visitScenes && game.queries.visitSceneAwaiting(state, placeIdOf(place)))
  if (!ready) return null
  if (scene)
    return (
      <div className="ui-layer" style={UI_LAYER}>
        <Tone />
      </div>
    )
  // 行き先を選ぶと、背景のその場所（札・吹き出しの先）へ寄ってから切り替える
  const room = (id: string, element: HTMLElement) =>
    void nav.go({ name: "room", room: id }, focusMove(stage, { element }))
  /** 受付と宿はギルドのホールへ、ホールと商店街は街へ戻る。 */
  const back: PlaceId | null =
    place === "reception" || place === "inn" ? "guild" : null
  const shop = (id: ShopId, move: Move) =>
    void nav.go({ name: "shop", shop: id }, move)
  return (
    <div className="ui-layer" style={UI_LAYER}>
      <Tone />
      {place !== "guild" && place !== "reception" ? (
        <SlamTitle
          text={placeName(place)}
          size={wide ? 13 : placeName(place).length > 3 ? 10 : 16}
        />
      ) : null}
      {place === "inn"
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
      {place === "shop" ? (
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
      {place === "guild" ? <GuildHall /> : null}
      {place === "reception" ? <Reception /> : null}
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
    </div>
  )
}

/** 冒険者ギルドのホール：絵の中の「受付」「宿」「秘密の部屋」へ。 */
function GuildHall() {
  const nav = useNav()
  const game = useGame()
  const state = useGameState()
  const wide = useWide()
  const leaving = useLeaving()
  const [secret, setSecret] = useState(false)
  useTakeover("list", secret)
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
      onClick: () => {
        setSecret(true)
      },
    },
  ]
  return (
    <>
      <LeavingContext.Provider value={leaving || secret}>
        <EntranceLinks links={links} wide={wide} />
      </LeavingContext.Provider>
      {onboarding && !secret ? (
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
      {secret ? (
        <SecretRoom
          keeper={null}
          onClose={() => {
            setSecret(false)
          }}
        />
      ) : null}
    </>
  )
}

/** ギルドの受付：受付嬢と「クエスト」「募集」「会話」。名前の登録もここ。 */
function Reception() {
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
