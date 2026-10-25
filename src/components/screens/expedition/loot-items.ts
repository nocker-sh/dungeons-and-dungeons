import type { Game } from "@/lib/wiz"
import { type LootItem } from "@/components/game/loot"
import { gearDesc } from "@/components/game/gear-text"

type Pending = NonNullable<ReturnType<Game["queries"]["route"]>>["pending"]

export function lootItems(
  game: Game,
  pending: NonNullable<Pending>
): LootItem[] {
  if (pending.kind === "discovery") return []
  if (pending.kind === "treasure" && pending.note)
    return [
      {
        key: "discovery",
        icon: "treasure",
        name: "探索の成果",
        n: "",
        desc: pending.note,
      },
      ...pending.goods.map((entry) => ({
        key: entry.good,
        icon: entry.good,
        name: game.queries.good(entry.good)?.name ?? entry.good,
        n: `×${entry.count}`,
        desc: game.queries.good(entry.good)?.desc ?? "",
      })),
    ]
  if (pending.kind === "trap")
    return [
      {
        key: "hurt",
        icon: "hurt",
        name: "全員にダメージ",
        n: `−${pending.damage}`,
        desc: "床のトゲが飛び出した。前衛も後衛も、全員が少しずつ傷を負った。",
      },
    ]
  const goods = pending.goods.map((entry) => {
    const good = game.queries.good(entry.good)
    return {
      key: entry.good,
      icon: entry.good,
      name: good?.name ?? entry.good,
      n: `×${entry.count}`,
      desc: good?.desc ?? "",
    }
  })
  // 中ボス・ボスは契約石を落とす
  const stones =
    pending.kind === "loot" && pending.stones > 0
      ? [
          {
            key: "stones",
            icon: "crystal",
            name: "契約石",
            n: `+${pending.stones}`,
            desc: "谷で拾った不思議な石。",
          },
        ]
      : []
  // 敵が落とした武器と光るガラクタは当たりなので、金貨より先に見せる（3枚までしか出さない）
  const gear = game.queries.gear(game.state)
  const weapons = (
    pending.kind === "loot" ? (pending.weapons ?? []) : []
  ).flatMap((id) => {
    const entry = gear.find((item) => item.gear === id)
    if (!entry) return []
    const best = game.queries.upgrades(game.state, id)[0]
    return [
      {
        key: id,
        icon: entry.id,
        name: entry.rarity ? `${entry.rarity} ${entry.name}` : entry.name,
        n: "×1",
        desc: [
          best
            ? `${best.name}が持つと 攻撃力 ${best.before} → ${best.after}`
            : "",
          entry.stat,
          gearDesc(entry),
          entry.unidentified
            ? "武器屋で鑑定してから装備できます。"
            : "装備の変更は街でできます。",
        ]
          .filter(Boolean)
          .join("\n"),
        rare: entry.rarity === "R" || entry.rarity === "SR",
      },
    ]
  })
  const rareId = game.queries.rareJunk(game.state)?.id
  const shiny = goods
    .filter((entry) => entry.key === rareId)
    .map((entry) => ({ ...entry, rare: true }))
  return [
    ...weapons,
    ...shiny,
    {
      key: "gold",
      icon: "coin",
      name: "金貨",
      n: `+${pending.gold}`,
      desc:
        pending.kind === "loot"
          ? "街で使えるお金。宿代や買い物に。"
          : "宝箱の底に転がっていた金貨。",
    },
    ...stones,
    ...goods.filter((entry) => entry.key !== rareId),
  ]
}
