import { statusResistanceView } from "@/lib/wiz/queries/names"
import type { GameCatalog, StatusKind } from "@/lib/wiz/content"
import type { PartyRules } from "@/lib/wiz/rules"
import { DiscoveryRules } from "@/lib/wiz/rules/discovery-rules"
import { ExplorationRules } from "@/lib/wiz/rules/exploration-rules"
import type { Expedition, GameState } from "@/lib/wiz/state"

type Layer = NonNullable<ReturnType<GameCatalog["layer"]>>
type Station = Layer["stations"][number]

/** 選ぶ前の分岐の敵・確定報酬・代償を示す。未知の抽選は行わない。 */
export class BranchChoices {
  static readonly featureId = "W035"
  constructor(
    private readonly catalog: GameCatalog,
    private readonly party: PartyRules
  ) {}
  execute(
    state: GameState,
    expedition: Expedition,
    layer: Layer,
    here: Station
  ) {
    return here.next.map((id) => {
      const station = layer.stations.find((entry) => entry.id === id)!
      const surveyed = expedition.surveyed?.find(
        (entry) => entry.station === id
      )
      const revealedNames = {
        battle: "魔物の待ち伏せ",
        treasure: "宝箱",
        trap: "罠",
        discovery: "魔物の店",
        midboss: "強敵",
        boss: "ボス",
      }
      const details: string[] = []
      let current = station
      const seen = new Set<string>()
      while (!seen.has(current.id)) {
        seen.add(current.id)
        if (current.mystery) {
          if (surveyed) {
            details.push(`察知済み：${revealedNames[surveyed.kind]}`)
            if (surveyed.kind === "battle")
              details.push(
                "敵の種類と数は到着時に判明する。勝利で確定報酬を得る"
              )
            if (surveyed.kind === "treasure" || surveyed.kind === "battle")
              for (const reward of current.rewardGoods ?? [])
                details.push(
                  `確定報酬：${this.catalog.good(reward.good)!.name}×${reward.count}`
                )
            if (surveyed.kind === "trap")
              details.push(
                `全生存メンバーが${new ExplorationRules(this.catalog).trap(state, layer.trap[0])}〜${new ExplorationRules(this.catalog).trap(state, layer.trap[1])}の被害（倒れない）`
              )
            if (surveyed.kind === "discovery")
              details.push(current.discovery?.description ?? "取引の機会がある")
          } else {
            details.push(current.hint ?? "何かの気配がする")
            details.push("正体・品ぞろえは到着してから判明する")
          }
          break
        }
        if (current.foes) {
          details.push(
            `敵：${current.foes.map((id) => this.catalog.foe(id)!.name).join("・")}`
          )
          for (const foeId of new Set(current.foes)) {
            const foe = this.catalog.foe(foeId)!
            const resistances = Object.entries(foe.resist ?? {})
              .filter(([, value]) => value > 0)
              .map(
                ([kind, value]) =>
                  statusResistanceView(kind as StatusKind, value).label
              )
            if (resistances.length)
              details.push(`耐性（${foe.name}）：${resistances.join("・")}`)
          }
          const skills = [
            ...new Set(
              current.foes.flatMap((id) => this.catalog.foe(id)?.skills ?? [])
            ),
          ]
          if (skills.length)
            details.push(
              `敵のワザ：${skills.map((id) => this.catalog.skill(id)!.name).join("・")}`
            )
        } else if (current.event === "battle")
          details.push("戦闘：この層の敵が出現")
        if (current.rewardGoods?.length)
          details.push(
            `確定報酬${current.event === "battle" ? "（勝利時）" : ""}：${current.rewardGoods.map((entry) => `${this.catalog.good(entry.good)!.name}×${entry.count}`).join("・")}`
          )
        if (current.discovery)
          for (const choice of current.discovery.choices) {
            const rules = new DiscoveryRules(this.catalog, this.party)
            const offer = rules.offer(state, choice)
            const names = choice.blessings
              ?.map((id) => this.catalog.skill(id)!.name)
              .join("／")
            details.push(
              `選択：${DiscoveryRules.priceText(choice.label, choice.cost, offer.cost)}${names ? `（${names}）` : ""}${offer.reason ? `／今は${offer.reason}` : ""}`
            )
            details.push(
              `効果：${rules.description(state, choice, offer.cost)}`
            )
            const payments = [
              ...(offer.cost ? [`${offer.cost}G`] : []),
              ...offer.materials.map(
                (entry) => `${entry.name}×${entry.count}（所持${entry.owned}）`
              ),
              ...offer.payment.map(
                (entry) => `${entry.name} HP${entry.before}→${entry.after}`
              ),
            ]
            if (payments.length) details.push(`支払い：${payments.join("／")}`)
            if (offer.healthChanges.length)
              details.push(
                `選択後：${offer.healthChanges.map((entry) => `${entry.name} HP ${entry.before}→${entry.after}`).join("／")}`
              )
          }
        if (!current.event && !current.boss)
          details.push("未判明の出来事：戦闘・宝箱・罠のいずれか")
        if (current.next.length !== 1) break
        const next = current.next[0]
        if (
          layer.stations.filter((entry) => entry.next.includes(next)).length > 1
        )
          break
        current = layer.stations.find((entry) => entry.id === next)!
      }
      return {
        id,
        label: surveyed
          ? `察知：${revealedNames[surveyed.kind]}`
          : (station.label ?? "先へ進む"),
        surveyed: !!surveyed,
        canSurvey:
          !!station.mystery &&
          !station.event &&
          !surveyed &&
          (expedition.surveyed?.length ?? 0) < ExplorationRules.surveyLimit &&
          new ExplorationRules(this.catalog).has(state, "scout") &&
          !expedition.pending,
        hint: station.hint ?? "何があるかは着いてからのお楽しみ",
        danger: (
          { low: "低", medium: "中", high: "高", unknown: "不明" } as const
        )[
          surveyed
            ? surveyed.kind === "battle"
              ? "high"
              : surveyed.kind === "trap"
                ? "medium"
                : "low"
            : (station.danger ?? "unknown")
        ],
        details,
      }
    })
  }
}
