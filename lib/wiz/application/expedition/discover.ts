import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"
import { updateMembers } from "@/lib/wiz/application/update-members"
import { Bag } from "@/lib/wiz/rules/bag"
import { DiscoveryRules } from "@/lib/wiz/rules/discovery-rules"
import { ExplorationRules } from "@/lib/wiz/rules/exploration-rules"
import type { GameState } from "@/lib/wiz/state/state-schema"

/** 探索の発見で、回復か戦利品かを選ぶ。一度だけ精算する。 */
export class Discover {
  static readonly featureId = "W033"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "party">
  ) {}
  execute(state: GameState, input: GameActionOf<"discover">): Transition {
    if (state.phase.type !== "expedition") return reject("WRONG_PHASE")
    const expedition = state.phase.expedition
    if (expedition.pending?.kind !== "discovery") return reject("NOT_READY")
    const station = this.deps.catalog.station(expedition.layer, expedition.at)
    const choice = station?.discovery?.choices.find(
      (entry) => entry.id === input.choice
    )
    if (!choice) return reject("UNKNOWN")
    const rules = new DiscoveryRules(this.deps.catalog, this.deps.party)
    const offer = rules.offer(state, choice)
    const cost = offer.cost
    if (state.gold < cost) return reject("NO_GOLD")
    if (!offer.available) return reject("UNAVAILABLE")
    const paidBag = Bag.pay(state.bag, choice.costGoods ?? [])!
    // 交換品と同じく今回の戦利品から先に払い、手当て・全滅で二重に精算しない。
    const paidGold = Math.max(0, expedition.loot.gold - cost)
    let paidLoot = [...expedition.loot.goods]
    for (const material of choice.costGoods ?? [])
      paidLoot = Bag.remove(
        paidLoot,
        material.good,
        Math.min(material.count, Bag.count(paidLoot, material.good))
      )!
    const paidMembers = state.members.map((member) => {
      const payment = offer.payment.find((entry) => entry.id === member.id)
      return payment ? { ...member, hp: payment.after } : member
    })
    if (choice.blessings) {
      if (
        !input.skill ||
        !choice.blessings.includes(input.skill) ||
        !this.deps.catalog.skill(input.skill)?.blessing
      )
        return reject("UNAVAILABLE")
      const recipient = state.members.find(
        (member) =>
          member.id === input.member && state.party.includes(member.id)
      )
      if (!recipient) return reject("UNKNOWN")
      const name = this.deps.catalog.skill(input.skill)!.name
      const memberName = this.deps.catalog.member(recipient.id)?.hero
        ? state.hero.name
        : this.deps.catalog.member(recipient.id)?.name
      return accept(
        {
          ...state,
          gold: state.gold - cost,
          bag: paidBag,
          members: paidMembers.map((member) =>
            member.id === recipient.id
              ? {
                  ...member,
                  blessing: input.skill,
                  used: member.used.filter(
                    (entry) => !this.deps.catalog.skill(entry.skill)?.blessing
                  ),
                }
              : member
          ),
          phase: {
            type: "expedition",
            expedition: {
              ...expedition,
              loot: { ...expedition.loot, gold: paidGold, goods: paidLoot },
              pending: {
                kind: "treasure",
                gold: 0,
                goods: [],
                note: `${memberName}に「${name}」の祝福を授けた。${recipient.blessing ? "以前の祝福は上書きされた。" : ""}${offer.payment.length ? ` HPを合計${offer.payment.reduce((sum, entry) => sum + entry.cost, 0)}捧げた。` : ""}`,
              },
            },
          },
        },
        { type: "discovered", choice: choice.id }
      )
    }
    if (input.skill || input.member) return reject("UNAVAILABLE")
    const goods = choice.goods ?? []
    let recovered = 0,
      damage = 0,
      restoredUses = 0
    const members = updateMembers(
      { ...state, members: paidMembers },
      (member) => {
        if (member.hp <= 0) return member
        const maximum = this.deps.party.stats(member, state).maxHp
        const health = DiscoveryRules.healthChange(member.hp, maximum, choice)
        recovered += health.healed
        damage += health.hurt
        const refill = choice.refill
          ? this.deps.party.skills.refillUses(
              member,
              new ExplorationRules(this.deps.catalog).refill(
                state,
                choice.refill
              )
            )
          : null
        restoredUses += refill?.restored ?? 0
        return {
          ...member,
          hp: health.after,
          fatigue: Math.max(0, member.fatigue - (choice.fatigue ?? 0)),
          used: refill?.used ?? member.used,
        }
      }
    )
    const description = rules.description(state, choice, cost)
    const note = [
      description,
      recovered ? `合計${recovered}回復。` : "",
      choice.refill
        ? restoredUses
          ? `ワザの残りを合計${restoredUses}回戻した。`
          : "ワザの回数は変わらなかった。"
        : "",
      damage ? `合計${damage}の被害。` : "",
      cost && !description.includes(`金貨${cost}を支払`)
        ? `金貨${cost}を支払った。`
        : "",
      offer.materials.length
        ? `${offer.materials.map((entry) => `${entry.name}×${entry.count}`).join("・")}を渡した。`
        : "",
    ]
      .filter(Boolean)
      .join(" ")
    return accept(
      {
        ...state,
        members,
        gold: state.gold - cost,
        bag: Bag.add(paidBag, goods),
        phase: {
          type: "expedition",
          expedition: {
            ...expedition,
            pending: { kind: "treasure", gold: 0, goods, note },
            loot: {
              ...expedition.loot,
              gold: paidGold,
              goods: Bag.add(paidLoot, goods),
            },
          },
        },
      },
      { type: "discovered", choice: choice.id }
    )
  }
}
