import { ListView } from "@/client/components/game/list-view/list-view"
import { useListBurst } from "@/client/components/game/list-view/use-list-burst"
import { COLOR } from "@/client/components/stage/kit"
import { useFx } from "@/client/components/stage/use-fx"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { eventsOf } from "@/lib/wiz/phases/events-of"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { reforgeKey } from "@/client/components/screens/shop/reforge-key"

export type Props = {
  menu: string | null
  notice: string
  onNotice: (notice: string) => void
  onClose: () => void
}

export function SmithyMenus(props: Props) {
  const game = useGame()
  const state = useGameState()
  const fx = useFx()
  const burst = useListBurst()
  if (
    !props.menu ||
    !["upgrade", "reforge", "repair", "craft"].includes(props.menu)
  )
    return null
  const upgrades =
    props.menu === "upgrade" ? game.queries.smithyUpgrades(state) : null
  const recipes =
    props.menu === "craft" ? game.queries.smithyRecipes(state) : null
  const repairs = props.menu === "repair" ? game.queries.repairs(state) : null
  const reforges = props.menu === "reforge" ? game.queries.reforges(state) : []
  // 個体IDに区切り文字が含まれていても、選んだ武器と素材をそのまま渡す。
  const reforgeChoices = new Map(
    reforges.flatMap((entry) =>
      entry.materials.map(
        (item) =>
          [
            reforgeKey(entry.gear, item.gear),
            { entry, material: item.gear },
          ] as const
      )
    )
  )
  const message = props.notice ? (
    <span
      role="status"
      style={{
        display: "block",
        color: COLOR.paper,
        background: COLOR.ink,
        padding: "8px 12px",
        fontSize: "max(14px, calc(var(--u)*2.6))",
        lineHeight: 1.5,
      }}
    >
      {props.notice}
    </span>
  ) : null
  return (
    <>
      {props.menu === "upgrade" && upgrades ? (
        <ListView
          title="強化"
          notice={message}
          gold={state.gold}
          tabs={[
            {
              name: "装備",
              rows: upgrades.map((entry) => ({
                key: entry.gear,
                icon: entry.id,
                name: entry.name,
                stat: entry.next
                  ? `${entry.stat} → ${entry.next.stat}`
                  : entry.stat,
                desc: entry.max
                  ? "これ以上は強化できない。"
                  : `${entry.gold}G・${entry.materials.map((item) => `${item.name} ${item.have}/${item.count}`).join("・")}`,
                badge: entry.max ? "最大" : `${entry.gold}G`,
                sub: entry.owner ?? "",
                rarity: entry.rarity,
              })),
            },
          ]}
          action={(row) => {
            const entry = upgrades.find((item) => item.gear === row.key)
            if (!entry || entry.max) return null
            return entry.ready
              ? `${entry.next?.name}にする`
              : entry.missingGold && entry.missingMaterials
                ? "素材とお金が足りない"
                : entry.missingGold
                  ? "お金が足りない"
                  : "素材が足りない"
          }}
          onAction={(row, at) => {
            props.onNotice("")
            if (
              eventsOf(inPhase(game, "town")?.upgrade(row.key)) instanceof
              GameCommandError
            )
              return fx.shake(0.6)
            const upgraded = game.queries
              .smithyUpgrades(game.state)
              ?.find((entry) => entry.gear === row.key)
            props.onNotice(`${upgraded?.name ?? row.name}に強化しました。`)
            burst(at, "")
            fx.shake(1)
          }}
          onClose={props.onClose}
        />
      ) : null}
      {props.menu === "reforge" && reforges.length ? (
        <ListView
          title={
            reforges.length === 1
              ? `鍛え直し：${reforges[0].memberName}`
              : "鍛え直し"
          }
          gold={state.gold}
          tabs={reforges.map((entry) => ({
            name: `${entry.memberName}の${entry.name}`,
            rows: entry.max
              ? []
              : entry.materials.map((item) => ({
                  key: reforgeKey(entry.gear, item.gear),
                  icon: item.id,
                  name: item.name,
                  stat: item.stat,
                  desc: `素材にすると手応え +${item.progress}。いまの${entry.name}は ${entry.plus}段・手応え ${entry.progress}/${entry.need}（上限 ${entry.maxPlus}段）。次の段で ${entry.next?.stat ?? ""}`,
                  badge: `+${item.progress}`,
                  sub: `${entry.gold}G → ${entry.name}`,
                  rarity: item.rarity,
                })),
          }))}
          action={(row) => {
            const entry = reforgeChoices.get(row.key)?.entry
            if (!entry) return null
            if (entry.max) return null
            return entry.ready ? "素材にして打ち直す" : "お金が足りない"
          }}
          onAction={(row, at) => {
            const choice = reforgeChoices.get(row.key)
            if (!choice) return
            if (
              eventsOf(
                inPhase(game, "town")?.reforge(
                  choice.entry.gear,
                  choice.material
                )
              ) instanceof GameCommandError
            )
              return fx.shake(0.6)
            burst(at, "")
            fx.shake(1.2)
          }}
          onClose={props.onClose}
        />
      ) : null}
      {props.menu === "repair" && repairs ? (
        <ListView
          title="修理"
          notice={message}
          gold={state.gold}
          tabs={[
            {
              name: "防具",
              rows: [
                ...(repairs.all.wear > 0
                  ? [
                      {
                        key: "all",
                        icon: repairs.rows[0]?.good ?? "",
                        name: "全部直す",
                        stat: `耐久 ${repairs.all.wear} 分`,
                        desc: "着けている防具をまとめて満タンにする。",
                        badge: `${repairs.all.gold}G`,
                      },
                    ]
                  : []),
                ...repairs.rows.map((entry) => ({
                  key: entry.member,
                  icon: entry.good,
                  name: entry.name,
                  stat: `耐久 ${entry.durability}/${entry.maxDurability}`,
                  desc: entry.full
                    ? "傷んでいない。"
                    : `減った耐久 ${entry.wear}。鍛冶屋で満タンに戻す。`,
                  badge: entry.full ? "満タン" : `${entry.gold}G`,
                  sub: entry.memberName,
                })),
              ],
            },
          ]}
          action={(row) => {
            if (row.key === "all")
              return repairs.all.ready
                ? `${repairs.all.gold}G で全部直す`
                : "お金が足りない"
            const entry = repairs.rows.find((item) => item.member === row.key)
            if (!entry || entry.full) return null
            return entry.ready ? `${entry.gold}G で直す` : "お金が足りない"
          }}
          onAction={(row, at) => {
            props.onNotice("")
            const sent = eventsOf(
              inPhase(game, "town")?.repair(
                row.key === "all" ? undefined : row.key
              )
            )
            if (sent instanceof GameCommandError) return fx.shake(0.6)
            props.onNotice(
              row.key === "all"
                ? "着けている防具を全部修理しました。"
                : `${row.name}を修理しました。`
            )
            burst(at, "")
            fx.shake(1)
          }}
          onClose={props.onClose}
        />
      ) : null}
      {props.menu === "craft" && recipes ? (
        <ListView
          title="生産"
          notice={message}
          gold={state.gold}
          tabs={[
            {
              name: "作れる物",
              rows: recipes.map((entry) => ({
                key: entry.recipe,
                icon: entry.id,
                name: entry.name,
                stat: entry.stat,
                desc: `${entry.desc} 必要：${entry.gold}G・${entry.materials.map((item) => `${item.name} ${item.have}/${item.count}`).join("・")}`,
                badge: `${entry.gold}G`,
              })),
            },
          ]}
          action={(row) => {
            const entry = recipes.find((item) => item.recipe === row.key)
            if (!entry) return null
            return entry.ready
              ? "作る"
              : entry.missingGold && entry.missingMaterials
                ? "素材とお金が足りない"
                : entry.missingGold
                  ? "お金が足りない"
                  : "素材が足りない"
          }}
          onAction={(row, at) => {
            props.onNotice("")
            if (
              eventsOf(inPhase(game, "town")?.craft(row.key)) instanceof
              GameCommandError
            )
              return fx.shake(0.6)
            props.onNotice(`${row.name}を作りました。バッグから装備できます。`)
            burst(at, "")
            fx.shake(1)
          }}
          onClose={props.onClose}
        />
      ) : null}
    </>
  )
}
