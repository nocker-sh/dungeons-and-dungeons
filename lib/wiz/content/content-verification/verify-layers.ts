import { byId } from "@/lib/wiz/content/by-id"
import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifyLayers({ catalog, need, problems }: ContentVerification) {
  const data = catalog.data

  need(data.reached < data.layers.length, "reached が層の数を超えている")
  for (const layer of data.layers) {
    const stations = byId(layer.stations, `${layer.id} の地点`, problems)
    need(
      stations.has(layer.start),
      `${layer.id} の開始地点 ${layer.start} がない`
    )
    need(catalog.foe(layer.boss), `${layer.id} のボス ${layer.boss} がない`)
    for (const foe of layer.foes)
      need(catalog.foe(foe), `${layer.id} の敵 ${foe} がない`)
    if (layer.group)
      need(
        layer.group[0] <= layer.group[1],
        `${layer.id} の group は [少ない, 多い]`
      )
    for (const entry of layer.treasure.goods)
      need(catalog.good(entry.good), `${layer.id} の宝 ${entry.good} がない`)
    if (layer.treasure.mimic)
      need(
        catalog.foe(layer.treasure.mimic.foe),
        `${layer.id} のミミック ${layer.treasure.mimic.foe} がない`
      )
    need(
      layer.stations.filter((entry) => entry.boss).length === 1,
      `${layer.id} にはボスの地点がちょうど一つ必要`
    )
    for (const entry of layer.stations) {
      for (const next of entry.next)
        need(
          stations.has(next),
          `${layer.id} の ${entry.id} の次 ${next} がない`
        )
      need(
        entry.boss ? entry.next.length === 0 : entry.next.length > 0,
        `${layer.id} の ${entry.id} で道のりが途切れている`
      )
      for (const foe of entry.foes ?? [])
        need(catalog.foe(foe), `${layer.id} の ${entry.id} の敵 ${foe} がない`)
      if (entry.event === "midboss")
        need(
          entry.foes?.length,
          `${layer.id} の ${entry.id}（中ボス）に foes がない`
        )
      need(
        entry.event !== "boss" || entry.boss,
        `${layer.id} の ${entry.id}：ボスの出来事は終点（boss）の地点だけ`
      )
    }
    need(
      layer.weights.battle + layer.weights.treasure + layer.weights.trap > 0,
      `${layer.id} に出来事がない`
    )
  }
}
