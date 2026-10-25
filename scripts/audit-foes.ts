/// <reference types="node" />
import { GameCatalog } from "../src/lib/wiz/content/game-catalog"
import { contentSource, toGameContent } from "../src/lib/content/game-content"
import foes from "../src/lib/content/data/foes.json"
import world from "../src/lib/concept/data/world.json"

type Foe = { id: string; slug: string }
type Artwork = {
  id: string
  category?: string
  image?: string
  appearances?: readonly { image: string }[]
}
type Layer = {
  foes: readonly string[]
  boss: string
  weights: { battle: number; treasure: number }
  treasure?: { mimic?: { foe: string; chance: number } }
  stations: readonly {
    foes?: readonly string[]
    event?: string
    boss?: boolean
    weights?: { battle: number; treasure: number }
    rewardGoods?: readonly unknown[]
  }[]
}

/** 実際の層と外見候補から出番を導く。不採用は登場経路があっても合格にしない。 */
export function auditFoes(
  definitions: readonly Foe[],
  artwork: readonly Artwork[],
  layers: readonly Layer[]
) {
  const active = new Set<string>()
  for (const layer of layers) {
    active.add(layer.boss)
    for (const station of layer.stations) {
      if (station.boss) continue
      const weights = station.weights ?? layer.weights
      const battle =
        station.event === "battle" ||
        station.event === "midboss" ||
        (!station.event && weights.battle > 0)
      if (battle) for (const foe of station.foes ?? layer.foes) active.add(foe)
      if (
        !station.event &&
        !station.rewardGoods?.length &&
        weights.treasure > 0 &&
        layer.treasure?.mimic &&
        layer.treasure.mimic.chance > 0
      )
        active.add(layer.treasure.mimic.foe)
    }
  }
  const artById = new Map(artwork.map((entry) => [entry.id, entry]))
  const problems: string[] = []
  const entries = definitions.map((foe) => {
    const art = artById.get(foe.id)
    const parents = art?.image
      ? definitions
          .filter(
            (parent) =>
              active.has(parent.id) &&
              parent.id !== foe.id &&
              artById
                .get(parent.id)
                ?.appearances?.some(
                  (appearance) => appearance.image === art.image
                )
          )
          .map((parent) => parent.slug)
      : []
    const rejected = art?.category === "不採用"
    if (rejected && (active.has(foe.id) || parents.length))
      problems.push(`${foe.slug}: 不採用の敵が登場候補に入っています`)
    const status = rejected
      ? "不採用"
      : active.has(foe.id)
        ? "直接登場"
        : parents.length
          ? "外見候補"
          : "未使用"
    if (status === "未使用")
      problems.push(`${foe.slug}: 敵定義に登場経路がありません`)
    return { slug: foe.slug, status, parents }
  })
  return { entries, problems }
}

if (process.argv[1]?.endsWith("/audit-foes.ts")) {
  const catalog = new GameCatalog(toGameContent(contentSource))
  const result = auditFoes(foes, world, catalog.data.layers)
  if (process.argv.includes("--json"))
    console.log(JSON.stringify(result, null, 2))
  else {
    for (const status of ["直接登場", "外見候補", "不採用", "未使用"])
      console.log(
        `${status}: ${result.entries.filter((entry) => entry.status === status).length}件`
      )
    for (const problem of result.problems) console.error(problem)
  }
  if (result.problems.length) process.exitCode = 1
}
