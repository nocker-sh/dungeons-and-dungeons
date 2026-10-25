import { buildContent } from "../lib/content"
import type { CliOptions } from "./options"

export function commandInspect(options: CliOptions) {
  const { source, slugs } = buildContent(options.overrides)
  type Row = Record<string, unknown>
  const list = (name: string) => source[name] as Row[]
  /** 表に出す文字。文字列はそのまま、ほかは JSON。 */
  const show = (value: unknown): string =>
    value === undefined
      ? "-"
      : typeof value === "string"
        ? (slugs.get(value) ?? value)
        : typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value, (_key, entry: unknown) =>
              typeof entry === "string" ? (slugs.get(entry) ?? entry) : entry
            )
  const ids = (value: unknown) =>
    Array.isArray(value) ? value.map(show).join(",") : show(value)
  const lines: string[] = []
  lines.push(`balance ${show(source.balance)}`)
  lines.push(`summon ${show(source.summon)}`)
  lines.push("party（出撃の並び。左2人が前衛）/ 募集")
  const members: Row[] = [
    ...list("party"),
    ...list("recruits").map((entry) => ({
      ...(entry.member as Row),
      price: entry.price,
    })),
  ]
  for (const member of members)
    lines.push(
      `  ${show(member.slug)} ${show(member.name)} Lv${show(member.lv)} ${show(member.stats)} skills=${ids(member.skills)} 得意${show(member.favorite)} 素${show(member.defaultWeapon)} weapon=${show(member.weapon)}${member.growth ? ` growth=${show(member.growth)}` : ""}${member.price ? ` 雇う${show(member.price)}G` : ""}`
    )
  lines.push("skills")
  for (const skill of list("skills"))
    lines.push(
      `  ${show(skill.slug)} ${show(skill.name)} ${show(skill.kind)} 残り${show(skill.uses ?? "無制限")} 威力${show(skill.power ?? 1)} 対象${show(skill.target)}${skill.status ? ` 状態${show(skill.status)}` : ""}`
    )
  lines.push("foes")
  for (const foe of list("foes"))
    lines.push(
      `  ${show(foe.slug)} ${show(foe.name)} HP${show(foe.hp)} atk${show(foe.atk)} spd${show(foe.spd)} exp${show(foe.exp)} gold${show(foe.gold)}${foe.skills ? ` skills=${ids(foe.skills)} rate${show(foe.skillRate)}` : ""}${foe.resist ? ` 耐性${show(foe.resist)}` : ""}`
    )
  lines.push("layers")
  for (const layer of list("layers"))
    lines.push(
      `  ${show(layer.slug)} ${show(layer.name)} foes=${ids(layer.foes)} group=${show(layer.group ?? [1, 1])} boss=${show(layer.boss)} weights=${show(layer.weights)} trap=${show(layer.trap)} 地点${show((layer.stations as unknown[]).length)}`
    )
  lines.push("goods（装備）")
  for (const good of list("goods").filter(
    (entry) => entry.kind === "weapon" || entry.kind === "armor"
  ))
    lines.push(
      `  ${show(good.slug)} ${show(good.name)} ${show(good.kind)} ${show(good.price)}G ${show(good.slot ?? good.kind)}${good.kind === "weapon" ? ` ${show(good.weaponType)} 攻撃力${show(good.power)} 必要${show(good.need)} skills=${ids(good.skills as string[])}` : ` 耐久${show(good.durability)} ${show(good.bonus ?? {})}`}`
    )
  lines.push("rooms")
  for (const room of list("rooms"))
    lines.push(
      `  ${show(room.slug)} ${show(room.name)} ${show(room.price)}G ${show(room.heal)} 疲れ${show(room.fatigue)} レベルアップ${show(room.levelUp)}`
    )
  console.log(lines.join("\n"))
}
