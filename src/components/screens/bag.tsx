import { FOE_ART } from "@/lib/content/looks"
import { itemEffectDetails } from "@/components/game/item-effect-text"
import { Supplies } from "@/components/game/supplies"
import { useFormation } from "@/components/game/formation"
import {
  armorComparisonText,
  gearDesc,
  shortText,
} from "@/components/game/gear-text"
import { ListView, useListBurst, type Row } from "@/components/game/list-view"
import { useFx } from "@/components/stage/use-fx"
import { useGame, useGameState } from "@/contexts/game"
import { GameCommandError, eventsOf, inPhase } from "@/lib/wiz"
import { UI_LAYER, STAGE_LAYER } from "@/components/canvas/tokens"

/** バッグ：所持品・探索中の持ち帰り・受注した依頼。戦闘の外なら回復の道具を使える。 */
export function BagView({
  onClose,
  closeSignal,
  tab,
}: {
  onClose: () => void
  closeSignal: number
  /** 最初に開いておくタブ（見た目の確認用）。 */
  tab?: number
}) {
  const game = useGame()
  const state = useGameState()
  const fx = useFx()
  const burst = useListBurst()
  const formation = useFormation()
  const items = game.queries.items(state)
  const carried = game.queries.carried(state)
  const gear = game.queries.gear(state)
  const quests = game.queries
    .quests(state)
    .filter((quest) => quest.status === "active" || quest.status === "ready")
  const equipmentTargets = (gearId: string) =>
    game.state.phase.type === "town" && !game.state.conversation?.active
      ? game.state.party.filter((member) =>
          game.queries
            .equipOptions(game.state, member)
            .some((entry) => entry.gear === gearId)
        )
      : []
  const itemRows: Row[] = items.map((entry) => ({
    key: entry.id,
    icon: entry.id,
    name: entry.name,
    stat: entry.refill ? `各ワザの残り +${entry.refill.perSkill}` : entry.stat,
    desc: [
      entry.desc,
      ...(entry.refill
        ? [`各ワザの残りを${entry.refill.perSkill}回ずつ戻す。`]
        : []),
      ...itemEffectDetails(entry).map(
        (member) => `${member.name}：${member.summary}`
      ),
      !entry.field
        ? "バッグからは使えない。"
        : !entry.usable
          ? "今は効果のある仲間がいない。"
          : "",
    ]
      .filter(Boolean)
      .join("\n"),
    badge: `×${entry.count}`,
  }))
  const gearRows: Row[] = gear.map((entry) => ({
    key: entry.gear,
    icon: entry.id,
    name: entry.name,
    stat: `${entry.slotName}・${entry.stat}`,
    desc: [
      entry.fixed
        ? `${gearDesc(entry)}　専用の武器。付け替えられない（鍛冶屋で鍛え直す）`
        : entry.locked
          ? `${gearDesc(entry)}　固定の装備。外せない`
          : gearDesc(entry),
      entry.armor?.durability === 0 ? "耐久切れ：ダメージを防げません。" : "",
      entry.armor?.wear
        ? `鍛冶屋で修理：${entry.armor.gold}G（耐久を満タンに戻す）`
        : "",
      entry.armor?.wear && !entry.ownerId
        ? "修理するには、街で仲間に装備してから鍛冶屋へ。"
        : "",
      state.phase.type === "expedition" && !entry.locked
        ? "装備の変更は街でできます。"
        : "",
      entry.unidentified
        ? "まず武器屋で鑑定しましょう。"
        : state.phase.type === "town" && !entry.locked
          ? equipmentTargets(entry.gear).length
            ? `変更できる仲間：${equipmentTargets(entry.gear)
                .map(
                  (member) => game.queries.member(state, member)?.name ?? member
                )
                .join("・")}`
            : "今の編成に、この装備へ変更できる仲間はいません。"
          : "",
    ]
      .filter(Boolean)
      .join("\n"),
    owner: entry.owner ?? "―",
    sub: entry.fixed ? `${entry.owner ?? ""}・専用` : (entry.owner ?? ""),
    rarity: entry.rarity,
  }))
  const materialRows: Row[] = game.queries.materials(state).map((entry) => ({
    key: entry.id,
    icon: entry.id,
    name: entry.name,
    stat: entry.stat,
    desc: entry.desc,
    badge: `×${entry.count}`,
  }))
  return (
    <div
      className="ui-layer"
      style={{ ...UI_LAYER, zIndex: STAGE_LAYER.sheet }}
    >
      <Supplies placement="bag" />
      <ListView
        title="バッグ"
        kind="bag"
        closeLabel="閉じる"
        closeSignal={closeSignal}
        tab={tab}
        gold={state.gold}
        tabs={[
          { name: "アイテム", rows: itemRows },
          { name: "装備", rows: gearRows },
          { name: "素材", rows: materialRows },
          ...(quests.length
            ? [
                {
                  name: "依頼",
                  rows: quests.map((quest) => ({
                    key: `quest:${quest.id}`,
                    icon: "junk",
                    image: FOE_ART[quest.foe]?.img,
                    name: quest.name,
                    stat: `${quest.requiresBossVictory ? "再戦勝利" : "討伐"} ${quest.progress}/${quest.count}・${quest.status === "ready" ? "報告できます" : "受注中"}`,
                    desc: [
                      quest.locations.length
                        ? `対象の出現層：${quest.locations.map((layer) => `${layer.no}層・${layer.name}`).join(" ／ ")}`
                        : "",
                      quest.desc,
                      `報酬：金貨 ${quest.reward.gold}G${quest.reward.goods.map((entry) => `・${game.queries.good(entry.good)?.name ?? entry.good} ×${entry.count}`).join("")}`,
                      quest.status === "ready"
                        ? "街のギルドで報告すると報酬を受け取れます。"
                        : "街のギルドで受注した依頼。",
                    ]
                      .filter(Boolean)
                      .join("\n"),
                    sub:
                      quest.status === "ready"
                        ? "報告できます"
                        : `${quest.progress}/${quest.count}`,
                  })),
                },
              ]
            : []),
          ...(carried
            ? [
                {
                  name: "持ち帰り",
                  rows: [
                    ...(carried.gold > 0
                      ? [
                          {
                            key: "carried-gold",
                            icon: "coin",
                            name: "金貨",
                            badge: `${carried.gold}G`,
                            desc: "今回の探索で拾った金貨。帰還時の手当ては含まない。",
                          },
                        ]
                      : []),
                    ...carried.goods.map((entry) => ({
                      key: `carried-good:${entry.id}`,
                      icon: entry.id,
                      name: entry.name,
                      stat: entry.stat,
                      desc: entry.desc,
                      badge: `×${entry.count}`,
                    })),
                    ...carried.gear.map((entry) => ({
                      key: `carried-gear:${entry.gear}`,
                      icon: entry.id,
                      name: entry.name,
                      stat: entry.stat,
                      desc: gearDesc(entry),
                      sub: entry.owner ?? "",
                      rarity: entry.rarity,
                    })),
                  ],
                },
              ]
            : []),
        ]}
        action={(row) => {
          const item = items.find((entry) => entry.id === row.key)
          if (item?.field && item.usable) return "使う"
          return equipmentTargets(row.key).length ? "仲間に装備" : null
        }}
        onAction={(row, at) => {
          const equipment = gear.find((entry) => entry.gear === row.key)
          if (equipment) {
            const eligible = equipmentTargets(equipment.gear)
            if (!eligible.length) return fx.shake(0.6)
            formation.requestTarget({
              eligible,
              label: `${equipment.name}を誰に装備する？`,
              detailLabel: "装備後の比較",
              details: eligible.map((member) => {
                const currentWeapon = game.queries.weapon(
                  game.state,
                  game.state.members.find((entry) => entry.id === member)!
                )
                const fit = equipment.weapon
                  ? game.queries.weaponFit(
                      game.state,
                      member,
                      equipment.id,
                      equipment.plus,
                      equipment.weapon.extraPower
                    )
                  : null
                return {
                  member,
                  name: game.queries.member(game.state, member)!.name,
                  description: equipment.armor
                    ? armorComparisonText(
                        game.queries.armorComparison(
                          game.state,
                          member,
                          equipment.gear
                        )
                      )
                    : [
                        fit
                          ? currentWeapon
                            ? `攻撃力 ${currentWeapon.attack} → ${fit.attack}`
                            : `現在は武器なし。装備後の攻撃力 ${fit.attack}`
                          : "",
                        fit ? shortText(fit.short) : "",
                        equipment.owner
                          ? `${equipment.owner}から受け取る（${equipment.owner}は武器なしになる）`
                          : "",
                      ]
                        .filter(Boolean)
                        .join("。"),
                }
              }),
              onPick: (member) => {
                const sent = eventsOf(
                  inPhase(game, "town")?.equip(equipment.gear, member)
                )
                if (Array.isArray(sent)) burst(at, "")
                else fx.shake(0.6)
              },
              onCancel: () => {},
            })
            return
          }
          const item = items.find((entry) => entry.id === row.key)
          if (!item) return
          const use = (member?: string) => {
            const events = eventsOf(
              (inPhase(game, "town") ?? inPhase(game, "expedition"))?.use(
                row.key,
                member
              )
            )
            if (events instanceof GameCommandError) return fx.shake(0.6)
            const used = events.find((event) => event.type === "used")
            if (used?.type !== "used") return
            burst(at, "", false)
            // 誰がどれだけ回復したかを、下の札の上に出す
            for (const result of used.results) {
              const c = formation.cards.center(
                fx,
                game.state.party,
                result.target.id
              )
              const text = result.revived
                ? "復活！"
                : result.heal
                  ? `+${result.heal}`
                  : result.refill
                    ? `残り+${result.refill}`
                    : result.cured?.length
                      ? "治った！"
                      : ""
              if (text)
                fx.numberAt(c.x, c.y - c.h * 0.4, text, {
                  size: 9,
                  color: "#c3dbc8",
                })
            }
          }
          if (item.target !== "ally") return use()
          // 効く相手はエンジンが決める（回復しきっている相手などは選べない）
          const eligible = item.targets
          if (!eligible.length) return fx.shake(0.6)
          formation.requestTarget({
            eligible,
            label: `${item.name}を誰に使う？`,
            detailLabel: "道具の効果",
            details: itemEffectDetails(item).filter((member) =>
              eligible.includes(member.member)
            ),
            onPick: (member) => use(member),
            onCancel: () => {},
          })
        }}
        onClose={onClose}
      />
    </div>
  )
}
