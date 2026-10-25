import type { GameAction } from "@/lib/wiz"
import type { SeededRandom } from "../random"
import type { Session } from "../session"
import { bestPotion } from "./healing"

/**
 * 自動で遊ぶ方針。
 * - smart：倒れた仲間を起こし、弱った仲間を回復し、残りは一番効く手で一番弱った敵を狙う
 * - attack：攻撃のワザだけ（残っていなければ殴る・防御）。基準線
 * - random：使える手からでたらめに選ぶ
 */
export type BattleStyle = "smart" | "attack" | "random"

type Choice = { action: GameAction; score: number }

/** 戦闘の手番で送る操作。 */
export function battleAction(
  session: Session,
  style: BattleStyle,
  random: SeededRandom
): GameAction {
  const { state, queries, catalog } = session
  const view = queries.battle(state)
  if (!view) throw new Error("戦闘中ではない")
  if (view.current.kind === "foe") return { type: "foe-turn" }
  const id = view.current.id
  const commands = queries.commands(state, id)!
  const party = queries.party(state)
  const attack = commands.weapon?.attack ?? 1
  // 武器のワザとキャラ固有のスキルはどちらも「ワザ」として選ぶ
  const skills = [
    ...commands.weaponSkills,
    ...commands.skills,
    ...(commands.blessing ? [commands.blessing] : []),
  ]
  const foes = view.foes.filter((foe) => foe.hp > 0)
  const weakest = [...foes].sort((a, b) => a.hp - b.hp)[0]
  const alive = party.filter((member) => member.hp > 0)
  const fallen = party.filter((member) => member.hp <= 0)
  const brawl: GameAction | null = commands.brawl
    ? {
        type: "act",
        command: "brawl",
        ...(weakest ? { target: weakest.id } : {}),
      }
    : null

  const options: GameAction[] = [{ type: "act", command: "guard" }]
  if (brawl) options.push(brawl)
  for (const skill of skills.filter((entry) => entry.usable))
    options.push({ type: "act", command: "skill", skill: skill.id })
  for (const item of commands.items.filter((entry) => entry.usable))
    options.push({ type: "act", command: "item", good: item.id })

  if (style === "random")
    return options[Math.floor(random.next() * options.length)]

  const backMelee = catalog.data.balance.backRow.melee
  const expected = (power: number, targets: typeof foes) =>
    targets.reduce(
      (sum, foe) => sum + Math.min(foe.hp, Math.max(1, attack * power)),
      0
    )

  // 自分を削って放つワザ（悪魔の流派）は、払うHPの分だけ割り引く
  const costPenalty = (skill: (typeof skills)[number]) => skill.cost * 1.5

  // 一番期待できる攻撃のワザ（いちばん弱った敵を狙う）
  const bestAttack = (): Choice | null => {
    let best: Choice | null = null
    for (const skill of skills) {
      if (!skill.usable || skill.kind !== "hit") continue
      const def = catalog.skill(skill.id)
      const power = (def?.power ?? 1) * (skill.weak ? backMelee : 1)
      const many = skill.target === "foes"
      const score =
        expected(power, many ? foes : weakest ? [weakest] : []) -
        costPenalty(skill)
      if (best && best.score >= score) continue
      best = {
        action: {
          type: "act",
          command: "skill",
          skill: skill.id,
          ...(many || !weakest ? {} : { target: weakest.id }),
        },
        score,
      }
    }
    return best
  }

  if (style === "attack")
    return bestAttack()?.action ?? brawl ?? { type: "act", command: "guard" }

  // 倒れた仲間を起こす
  if (fallen.length) {
    const revive = skills.find((skill) => skill.revive && skill.usable)
    if (revive)
      return {
        type: "act",
        command: "skill",
        skill: revive.id,
        target: fallen[0].id,
      }
    const item = commands.items.find(
      (entry) => entry.effect === "revive" && entry.usable
    )
    if (item)
      return {
        type: "act",
        command: "item",
        good: item.id,
        target: fallen[0].id,
      }
  }

  // 弱った仲間を回復する
  const low = alive
    .filter((member) => member.hp / member.maxHp < 0.4)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)
  if (low.length) {
    // 防具を直すワザ（repair）はHPを戻さないので回復には数えない
    const heals = skills.filter(
      (skill) =>
        skill.kind === "heal" &&
        skill.usable &&
        !skill.revive &&
        skill.repair === null
    )
    const group = heals.find((skill) => skill.target === "allies")
    const single = heals.find(
      (skill) =>
        skill.target === "ally" || (skill.target === "self" && low[0].id === id)
    )
    if (group && low.length >= 2)
      return { type: "act", command: "skill", skill: group.id }
    if (single)
      return {
        type: "act",
        command: "skill",
        skill: single.id,
        target: low[0].id,
      }
    if (group) return { type: "act", command: "skill", skill: group.id }
    const potion = bestPotion(
      session,
      commands.items.filter((entry) => entry.effect === "heal" && entry.usable),
      low[0].maxHp - low[0].hp
    )
    if (potion && low[0].hp / low[0].maxHp < 0.3)
      return {
        type: "act",
        command: "item",
        good: potion.id,
        target: low[0].id,
      }
  }

  // 攻める：期待できる被害が一番大きい手。残りが少ないワザは少し惜しむ
  const thrift = (skill: (typeof skills)[number]) =>
    skill.uses && skill.left !== null ? 1 - skill.left / skill.uses : 0
  const choices: Choice[] = []
  if (brawl && weakest)
    choices.push({
      action: brawl,
      score: expected(
        (catalog.skill(catalog.data.brawl)?.power ?? 1) *
          (commands.brawl?.weak ? backMelee : 1),
        [weakest]
      ),
    })
  for (const skill of skills) {
    if (!skill.usable || skill.kind !== "hit") continue
    const def = catalog.skill(skill.id)
    const power =
      (def?.power ?? 1) *
      (skill.weak ? backMelee : 1) *
      (def?.bonusAgainst &&
      weakest?.status.some((entry) => entry.kind === def.bonusAgainst?.status)
        ? def.bonusAgainst.factor
        : 1)
    const many = skill.target === "foes"
    const gain = expected(power, many ? foes : weakest ? [weakest] : [])
    const missingHp = party.find((member) => member.id === id)
    const absorption =
      def?.drain && missingHp
        ? Math.min(missingHp.maxHp - missingHp.hp, gain * def.drain) * 0.7
        : 0
    choices.push({
      action: {
        type: "act",
        command: "skill",
        skill: skill.id,
        ...(many || !weakest ? {} : { target: weakest.id }),
      },
      // 残りが減ったワザは割り引く。縛りつきなら少し足し、代償のHPは引く
      score:
        gain * (1 - thrift(skill) * 0.25) +
        absorption +
        (def?.status?.kind === "bind" && weakest
          ? (def.status.chance ?? 1) *
            (1 - (catalog.foe(weakest.foe)?.resist?.bind ?? 0)) *
            attack *
            0.2
          : 0) -
        costPenalty(skill),
    })
  }
  // 補助：溜め・守り・縛り。効きそうな被害の量で点をつける
  const statusOf = (memberId: string) =>
    state.members.find((member) => member.id === memberId)?.status ?? []
  const has = (list: readonly { kind: string }[], kind: string) =>
    list.some((entry) => entry.kind === kind)
  const foeHit = (foe: (typeof foes)[number]) =>
    Math.max(1, catalog.foe(foe.foe)?.atk ?? 0)
  const incoming = foes.reduce((sum, foe) => sum + foeHit(foe), 0)
  const bestHit = Math.max(
    0,
    ...skills
      .filter((skill) => skill.kind === "hit" && skill.usable)
      .map((skill) =>
        expected(catalog.skill(skill.id)?.power ?? 1, weakest ? [weakest] : [])
      )
  )
  const toughest = [...foes].sort((a, b) => b.hp - a.hp)[0]
  for (const skill of skills) {
    if (!skill.usable || skill.kind !== "heal" || skill.repair === null)
      continue
    // 自分だけを直すワザは、ほかの仲間へ向けられない
    const recipient = alive
      .filter(
        (member) =>
          (skill.target !== "self" || member.id === id) &&
          member.armor &&
          member.armor.durability < member.armor.maxDurability
      )
      .map((member) => ({
        member,
        restored: Math.min(
          skill.repair!,
          member.armor!.maxDurability - member.armor!.durability
        ),
      }))
      .sort((left, right) => right.restored - left.restored)[0]
    if (!recipient) continue
    const armor = recipient.member.armor!
    const exposed =
      recipient.member.hp + armor.durability < incoming &&
      recipient.member.row === "front"
    if (
      exposed &&
      recipient.member.hp + armor.durability + recipient.restored >= incoming
    )
      return {
        type: "act",
        command: "skill",
        skill: skill.id,
        target: recipient.member.id,
      }
    choices.push({
      action: {
        type: "act",
        command: "skill",
        skill: skill.id,
        target: recipient.member.id,
      },
      score: recipient.restored * (recipient.member.row === "front" ? 1 : 0.35),
    })
  }
  for (const skill of skills) {
    if (!skill.usable || skill.kind !== "support") continue
    const status = catalog.skill(skill.id)?.status
    if (!status) continue
    const resist =
      status.kind === "bind" && toughest
        ? (catalog.foe(toughest.foe)?.resist?.bind ?? 0)
        : 0
    const chance = (status.chance ?? 1) * (1 - resist)
    let score = 0
    let target: string | undefined
    if (status.kind === "charge" && !has(statusOf(id), "charge"))
      // 次の一撃が倍：一撃で倒せる相手しかいなければ意味がない
      score = toughest && toughest.hp > bestHit * 1.5 ? bestHit * 0.9 : 0
    if (status.kind === "charge" && skill.target === "ally") {
      const recipient = alive
        .filter((member) => !has(statusOf(member.id), "charge"))
        .map((member) => ({
          member,
          hit:
            (queries.commands(state, member.id)?.weapon?.attack ?? 0) *
            Math.max(
              1,
              ...(queries.commands(state, member.id)?.skills ?? [])
                .concat(queries.commands(state, member.id)?.weaponSkills ?? [])
                .filter((skill) => skill.kind === "hit" && skill.usable)
                .map(
                  (skill) =>
                    (catalog.skill(skill.id)?.power ?? 1) *
                    (skill.reach === "melee" && member.row === "back"
                      ? backMelee
                      : 1)
                )
            ),
        }))
        .sort((left, right) => right.hit - left.hit)[0]
      target = recipient?.member.id
      score =
        recipient && toughest && toughest.hp > recipient.hit * 1.5
          ? recipient.hit * 0.9
          : 0
    }
    if (status.kind === "protect" || status.kind === "taunt") {
      const covered =
        skill.target === "allies"
          ? alive.filter((member) => !has(statusOf(member.id), "protect"))
              .length
          : skill.target === "self"
            ? has(statusOf(id), status.kind)
              ? 0
              : 1
            : 1
      if (skill.target === "ally") {
        const front = alive.find(
          (member) =>
            member.row === "front" && !has(statusOf(member.id), "protect")
        )
        target = front?.id
        if (!front) continue
      }
      score =
        (incoming / Math.max(1, alive.length)) *
        covered *
        chance *
        (1 - catalog.data.balance.protect) *
        0.9
      if (status.kind === "taunt") {
        const healthy = alive.find((member) => member.id === id)
        score =
          healthy &&
          healthy.hp / healthy.maxHp > 0.45 &&
          !alive.some((member) => has(statusOf(member.id), "taunt"))
            ? incoming * (1 - (catalog.data.balance.taunt ?? 0.75)) * 0.9
            : 0
      }
    }
    // 再生：仲間が減っている分だけ、戻る量を数える
    if (status.kind === "regen") {
      const per = Math.max(
        1,
        Math.floor(
          Math.min(...alive.map((member) => member.maxHp)) /
            catalog.data.balance.regenDivisor
        )
      )
      const covered =
        skill.target === "allies"
          ? alive.filter(
              (member) =>
                member.hp < member.maxHp && !has(statusOf(member.id), "regen")
            ).length
          : has(statusOf(id), "regen")
            ? 0
            : 1
      score = per * status.turns * covered * 0.6
    }
    if (status.kind === "bind" && toughest && !has(toughest.status, "bind")) {
      const many = skill.target === "foes"
      score = (many ? incoming : foeHit(toughest)) * chance * status.turns * 0.8
      target = many ? undefined : toughest.id
    }
    if (score > 0)
      choices.push({
        action: {
          type: "act",
          command: "skill",
          skill: skill.id,
          ...(target ? { target } : {}),
        },
        score: score * (1 - thrift(skill) * 0.25),
      })
  }
  const boss = view.boss
  const bomb = commands.items.find((entry) => entry.effect === "damage")
  if (bomb && boss && weakest)
    choices.push({
      action: {
        type: "act",
        command: "item",
        good: bomb.id,
        target: weakest.id,
      },
      score: 30,
    })
  choices.sort((a, b) => b.score - a.score)
  return choices[0]?.action ?? { type: "act", command: "guard" }
}
