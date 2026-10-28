import { useEffect, useRef, useState } from "react"
import { useWide } from "@/client/components/stage/use-wide"
import { ListView } from "@/client/components/game/list-view/list-view"
import { useArrival } from "@/client/components/game/use-arrival"
import { useNav } from "@/client/components/game/use-nav"
import { Battle } from "@/client/components/screens/battle/battle"
import { useStage } from "@/client/components/stage/use-stage"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { battleSceneOf } from "@/content/looks/battle-scene-of"
import { placeName } from "@/content/looks/place-name"
import { sceneOf } from "@/content/looks/scene-of"
import { FOE_ART } from "@/content/looks/combat-art"

/** 依頼一覧のタブ。街の中で戦う場所と、門や柵の外で戦う場所に分ける。 */
export const INSIDE_TOWN: readonly string[] = [
  "town",
  "shop-street",
  "back-alley",
]

/** ギルドの依頼一覧。探索の討伐依頼と、街なか・街の外で戦う依頼をまとめる。 */
export function Quests() {
  const nav = useNav()
  const game = useGame()
  const state = useGameState()
  const stage = useStage()
  const wide = useWide()
  const quests = game.queries.quests(state)
  const initial = state.phase.type === "battle" ? state.phase.townQuest : null
  const [selected, setSelected] = useState<string | null>(initial ?? null)
  const [fighting, setFighting] = useState(!!initial)
  const [result, setResult] = useState<"victory" | "defeat" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const selectedQuest = quests.find((quest) => quest.id === selected)
  // 戦う場所はエンジンの Query から。勝敗の演出中（戦闘が終わった後）も同じ場所の絵を保つ
  const battlePlace = useRef<string | null>(null)
  const battle = game.queries.battle(state)
  if (battle) battlePlace.current = battle.place
  const background =
    fighting && battlePlace.current
      ? battleSceneOf(battlePlace.current, wide)
      : sceneOf("reception", wide)
  const ready = useArrival(background, "none", 4)
  useEffect(() => {
    void stage.art(background)
  }, [background, stage])
  if (!ready) return null
  if (fighting)
    return (
      <Battle
        onEnd={(outcome) => {
          void stage.art(sceneOf("reception", wide))
          setResult(outcome)
          setFighting(false)
          busy.current = false
        }}
      />
    )
  const notice =
    error ??
    (result === "victory" && selectedQuest
      ? `${selectedQuest.name}を達成！ 報酬の${selectedQuest.reward.gold}Gと戦闘の戦利品を受け取った。`
      : result === "defeat"
        ? "敗北。報酬はなし。持ち物と所持金は失わない。宿で回復して再挑戦しよう。"
        : "依頼を選ぼう。")
  return (
    <ListView
      title="クエスト"
      kind="quests"
      tab={
        selectedQuest?.encounter
          ? INSIDE_TOWN.includes(selectedQuest.encounter.place)
            ? 1
            : 2
          : 0
      }
      gold={state.gold}
      notice={<span role="status">{notice}</span>}
      tabs={[
        {
          name: "依頼",
          quests: quests.filter(
            (quest) => !quest.encounter && !quest.requiresCleared
          ),
        },
        {
          name: "街なか",
          quests: quests.filter(
            (quest) =>
              quest.encounter && INSIDE_TOWN.includes(quest.encounter.place)
          ),
        },
        {
          name: "街の外",
          quests: quests.filter(
            (quest) =>
              quest.encounter && !INSIDE_TOWN.includes(quest.encounter.place)
          ),
        },
        ...(quests.some((quest) => quest.requiresCleared)
          ? [
              {
                name: "再挑戦",
                quests: quests.filter((quest) => quest.requiresCleared),
              },
            ]
          : []),
      ].map((tab) => ({
        name: tab.name,
        rows: tab.quests.map((quest) => ({
          key: quest.id,
          icon: "junk",
          image: FOE_ART[quest.foe]?.img,
          name: quest.name,
          stat: `報酬：金貨 ${quest.reward.gold}${quest.reward.goods.map((entry) => `・${game.queries.good(entry.good)?.name ?? entry.good}×${entry.count}`).join("")}`,
          desc: [
            quest.desc,
            quest.encounter
              ? `場所：${placeName(quest.encounter.place)}\n敵：${quest.enemyNames.join("・")}\n移動なし・1戦で達成`
              : quest.locations.length
                ? `対象の出現層：${quest.locations.map((layer) => `${layer.no}層・${layer.name}`).join(" ／ ")}`
                : "",
          ]
            .filter(Boolean)
            .join("\n"),
          sub: quest.encounter
            ? quest.status === "done"
              ? "達成済み"
              : (quest.battleBlock ?? "討伐に向かう")
            : quest.status === "active"
              ? `受注中 ${quest.progress}/${quest.count}`
              : (
                  { open: "未受注", ready: "報告できる", done: "達成" } as const
                )[quest.status],
        })),
      }))}
      action={(row) => {
        const quest = quests.find((quest) => quest.id === row.key)
        if (quest?.encounter) return quest.canFight ? "戦う" : null
        return quest?.canAccept
          ? "引き受ける"
          : quest?.status === "ready"
            ? "報告する"
            : null
      }}
      onAction={async (row) => {
        if (busy.current) return
        busy.current = true
        const quest = quests.find((entry) => entry.id === row.key)!
        if (!quest.encounter) {
          const town = inPhase(game, "town")
          const result = quest.canAccept
            ? town?.acceptQuest(quest.id)
            : town?.claimQuest(quest.id)
          setError(
            !result || result instanceof GameCommandError
              ? "今はこの依頼を操作できない。"
              : null
          )
          busy.current = false
          return
        }
        const fight = inPhase(game, "town")?.fightQuest(row.key)
        if (!fight || fight instanceof GameCommandError) {
          setError("今は戦えない。編成と宿での回復を確認しよう。")
          busy.current = false
          return
        }
        const place = game.queries.battle(game.state)?.place
        if (place) await stage.art(battleSceneOf(place, wide))
        setSelected(row.key)
        setResult(null)
        setError(null)
        setFighting(true)
      }}
      onClose={() => {
        if (busy.current) return
        void stage.art(sceneOf("reception", wide))
        void nav.go({ name: "place", place: "reception" }, { enter: "none" })
      }}
    />
  )
}
