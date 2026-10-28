import { phaseOf } from "@/lib/wiz/phases/phase-of"
import type { Session } from "@/builder/lib/session"
import { hints } from "@/builder/lib/hints"

/** 今の状態を、AIが読める短い文にする。id は slug で出す。 */
export function describe(session: Session): string {
  const { state, queries } = session
  const lines: string[] = []
  lines.push(
    `phase=${phaseOf(session.game).kind} gold=${state.gold} stones=${state.stones} reached=${state.reached} nights=${state.nights}`
  )
  const party = queries.party(state)
  lines.push("party:")
  for (const member of party)
    lines.push(
      `  ${member.name}(${session.slug(member.id)}) ${member.row} Lv${member.lv} exp=${member.exp}/${member.next} HP${member.hp}/${member.maxHp} str${member.str} tec${member.tec} spd${member.spd} 疲れ${member.fatigue} 汚れ${member.dirt}${member.weapon ? ` 武器:${member.weapon.name}(${member.weapon.rarity}・攻撃力${member.weapon.attack}${member.weapon.extraPower ? `・上振れ+${member.weapon.extraPower}` : ""}${member.weapon.met ? "" : "・条件不足"})` : ""}${member.armor ? ` 防具:${member.armor.name}(耐久${member.armor.durability}/${member.armor.maxDurability})` : ""}`
    )
  const reserve = queries.reserve(state)
  if (reserve.length)
    lines.push(
      `reserve: ${reserve.map((member) => `${member.name}(${session.slug(member.id)}) Lv${member.lv}`).join(", ")}`
    )
  lines.push(
    `bag: ${state.bag.map((entry) => `${session.label(entry.good)}×${entry.count}`).join(", ") || "なし"}`
  )
  const loose = queries.gear(state).filter((entry) => !entry.ownerId)
  if (loose.length)
    lines.push(
      `gear(未装備): ${loose.map((entry) => `${entry.name}${entry.rarity ? `(${entry.rarity})` : ""}[${entry.gear}]`).join(", ")}`
    )
  lines.push(
    `demon: ${queries.demon(state)?.name ?? "なし"} / 契約: ${queries
      .demons(state)
      .map((demon) => `${demon.name}(${session.slug(demon.id)}) Lv${demon.lv}`)
      .join(", ")}`
  )
  const route = queries.route(state)
  const expedition = queries.expedition(state)
  if (route && expedition) {
    lines.push(
      `route: ${route.layer.name} at=${route.at} next=[${route.choices.join(",")}] 終点まで${route.stepsLeft}地点${route.atEnd ? " (終点)" : ""}${expedition.cleared ? " 突破済み" : ""}`
    )
    if (expedition.pending)
      lines.push(
        `pending: ${JSON.stringify(expedition.pending, (key, value) => (key === "good" ? session.slug(value) : value))}`
      )
    // 手で遊ぶときに選べるよう、分かれ目の行き先と祭壇の選択肢を画面と同じ言葉で出す
    if (route.paths.length > 1 && !expedition.pending)
      for (const path of route.paths)
        lines.push(
          `  行き先 ${path.id}：${path.label}（危険度 ${path.danger}）${path.hint}${path.details
            .filter((line) => line !== path.hint)
            .map((line) => ` ／ ${line}`)
            .join("")}`
        )
    if (route.discovery)
      for (const choice of route.discovery.choices)
        lines.push(
          `  選択 ${session.slug(choice.id)}：${choice.label}${choice.blessings?.length ? `（${choice.blessings.map((skill) => `${session.slug(skill.id)}=${skill.name}`).join("／")}）` : ""}${choice.available ? "" : `［今は選べない：${choice.reason ?? ""}］`} ${choice.description}`
        )
  }
  const battle = queries.battle(state)
  if (battle) {
    lines.push(`battle${battle.boss ? "(ボス)" : ""}:`)
    for (const foe of battle.foes)
      lines.push(
        `  ${foe.id} ${foe.name}(${session.slug(foe.foe)}) HP${foe.hp}/${foe.maxHp}${foe.status.length ? ` [${foe.status.map((entry) => `${entry.name}${entry.turns}`).join(",")}]` : ""}`
      )
    lines.push(
      `  order: ${battle.order
        .map(
          (entry, index) =>
            `${index === battle.turn % battle.order.length ? "▶" : ""}${entry.name}${entry.alive ? "" : "×"}`
        )
        .join(" → ")}`
    )
    if (battle.current.kind === "member") {
      const commands = queries.commands(state, battle.current.id)!
      // ランダムに入った武器のワザには * を付ける
      const skillText = (
        skill: (typeof commands.skills)[number] & { random?: boolean }
      ) =>
        `${skill.random ? "*" : ""}${session.slug(skill.id)}:残り${skill.left}/${skill.uses}:${skill.target}${skill.usable ? "" : "(不可)"}`
      lines.push(
        `  commands: weapon=[${commands.weaponSkills
          .map(skillText)
          .join(", ")}] skills=[${commands.skills
          .map(skillText)
          .join(
            ", "
          )}]${commands.brawl ? ` ${commands.brawl.name}` : ""} items=[${commands.items.map((item) => `${session.slug(item.id)}×${item.count}:${item.target}`).join(", ")}]`
      )
    }
  }
  lines.push(`actions: ${hints(session).join(" | ")}`)
  return lines.join("\n")
}
