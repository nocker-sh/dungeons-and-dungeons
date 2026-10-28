/**
 * `look`：画面で見える情報を、AIが読めるテキストで出す。
 * 値はすべてエンジンの Query から受け取る（画面と同じ判断材料）。id は slug で出す。
 */
import type { Session } from "@/builder/lib/session"

const yen = (value: number) => `${value}G`

export const LOOK_TOPICS = [
  "shops",
  "shop <店slug>",
  "recruits",
  "quests",
  "rooms",
  "smithy",
  "gear",
  "member <仲間slug>",
  "skill <ワザslug>",
  "foe <敵slug>",
] as const

export function look(session: Session, args: readonly string[]): string[] {
  const { state, queries, catalog } = session
  const [topic, key] = args
  const slug = (id: string) => session.slug(id)
  if (topic === "shops")
    return catalog.data.shops.map((shop) => {
      const view = queries.shop(state, shop.id)
      return `${slug(shop.id)}：品${view?.goods.length ?? 0}${view?.appraise ? "・鑑定できる" : ""}${view?.appraiseRare ? "（光るガラクタも）" : ""}`
    })
  if (topic === "shop") {
    const id = session.id(key ?? "", "shops")
    const view = queries.shop(state, id)
    if (!view) return [`店 ${key} がない`]
    return view.goods.map((good) => {
      const best = good.weapon
        ? queries.upgradesForGood(state, good.id)[0]
        : undefined
      return `${good.affordable ? "○" : "×"} ${slug(good.id)}：${good.name} ${yen(good.price)}  ${good.stat}${best ? `  ${best.name}が持つと攻撃力 ${best.before}→${best.after}` : ""}  所持${good.own}`
    })
  }
  if (topic === "recruits")
    return queries
      .recruits(state)
      .map(
        (entry) =>
          `${entry.hired ? "契約済み" : entry.affordable ? "○" : "×"} ${slug(entry.id)}：${entry.name}（${entry.rank ?? "N"}・${entry.job}・${entry.roleName}）${yen(entry.price)}`
      )
  if (topic === "quests")
    return queries
      .quests(state)
      .map(
        (quest) =>
          `[${quest.status}] ${slug(quest.id)}：${quest.name} ${quest.progress}/${quest.count}  ${quest.desc}`
      )
  if (topic === "rooms")
    return queries
      .rooms(state)
      .map(
        (room) =>
          `${room.affordable ? "○" : "×"} ${slug(room.id)}：${room.name} ${yen(room.price)}${room.levelUp ? "・レベルが上がる" : ""}`
      )
  if (topic === "smithy") {
    const overview = queries.smithyOverview(state)
    if (!overview) return ["鍛冶屋がない"]
    const upgrades = queries.smithyUpgrades(state)!
    return [
      `スキルの書 ${overview.books}冊`,
      ...upgrades.map(
        (entry) =>
          `${entry.ready ? "○" : "×"} 強化 ${entry.gear}：${entry.name}${entry.owner ? `（${entry.owner}）` : ""} ${entry.max ? "上限" : yen(entry.gold)}`
      ),
      ...queries
        .repairs(state)
        .rows.filter((row) => row.wear > 0)
        .map(
          (row) => `修理 ${slug(row.member)}：減り${row.wear} ${yen(row.gold)}`
        ),
    ]
  }
  if (topic === "gear")
    return queries.gear(state).map((entry) => {
      const best = entry.gear
        ? queries.upgrades(state, entry.gear)[0]
        : undefined
      return `${entry.gear}：${entry.rarity ? `${entry.rarity} ` : ""}${entry.name}  ${entry.stat}${entry.owner ? `  [${entry.owner}]` : ""}${best ? `  ${best.name}が持つと攻撃力 ${best.before}→${best.after}` : ""}${entry.weapon ? `  ワザ：${entry.weapon.skills.map((skill) => `${skill.random ? "＊" : ""}${slug(skill.id)}=${skill.name}`).join("・")}` : ""}`
    })
  if (topic === "member") {
    const id = session.id(key ?? "", "party")
    const member = state.members.find((entry) => entry.id === id)
    const view = queries.member(state, id)
    if (!member || !view) return [`仲間 ${key} がいない`]
    const weapon = queries.weapon(state, member)
    return [
      `${view.name} Lv${view.lv} HP${view.hp}/${view.maxHp} 筋力${view.str} 技量${view.tec} 速さ${view.spd}`,
      weapon
        ? `武器：${weapon.rarity} ${weapon.name} 攻撃力${weapon.attack}${weapon.met ? "" : "（条件不足）"}`
        : "武器なし",
      ...(weapon?.skills ?? []).map(
        (skill) =>
          `  ${slug(skill.id)}=${skill.name}（${skill.uses ?? "∞"}回）${skill.desc}`
      ),
    ]
  }
  if (topic === "skill") {
    const skill = catalog.skill(session.id(key ?? "", "skills"))
    if (!skill) return [`ワザ ${key} がない`]
    return [
      `${skill.name}：${skill.desc}  種類${skill.kind}${skill.reach ? `・${skill.reach}` : ""}${skill.power ? `・威力${skill.power}` : ""}${skill.target ? `・対象${skill.target}` : ""}${skill.uses ? `・${skill.uses}回` : ""}`,
    ]
  }
  if (topic === "foe") {
    const foe = catalog.foe(session.id(key ?? "", "foes"))
    if (!foe) return [`敵 ${key} がいない`]
    return [
      `${foe.name}：HP${foe.hp} 攻撃${foe.atk} 速さ${foe.spd} 経験値${foe.exp}`,
      ...(foe.skills ?? []).map((id) => {
        const skill = catalog.skill(id)
        return `  ワザ ${slug(id)}=${skill?.name ?? id}：${skill?.desc ?? ""}`
      }),
    ]
  }
  return [`look の話題：${LOOK_TOPICS.join(" | ")}`]
}
