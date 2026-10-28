import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifyDiscoveries({ catalog, need }: ContentVerification) {
  const data = catalog.data

  for (const layer of data.layers)
    for (const station of layer.stations) {
      need(
        (station.event === "discovery" ||
          (station.weights?.discovery ?? 0) > 0) === !!station.discovery,
        `地点 ${station.id} のイベント定義が合わない`
      )
      if (station.weights) {
        need(
          !station.event && !station.boss,
          `地点 ${station.id} の抽選と固定イベントが重複`
        )
        need(
          Object.values(station.weights).some((weight) => weight > 0),
          `地点 ${station.id} の抽選が空`
        )
      }
      for (const choice of station.discovery?.choices ?? [])
        for (const id of choice.blessings ?? [])
          need(
            catalog.skill(id)?.blessing,
            `祭壇 ${station.id} の祝福 ${id} がない`
          )
      if (station.discovery)
        need(
          new Set(station.discovery.choices.map((choice) => choice.id)).size ===
            station.discovery.choices.length,
          `地点 ${station.id} の選択肢が重複`
        )
      for (const reward of [
        ...(station.rewardGoods ?? []),
        ...(station.discovery?.choices.flatMap(
          (choice) => choice.goods ?? []
        ) ?? []),
        ...(station.discovery?.choices.flatMap(
          (choice) => choice.costGoods ?? []
        ) ?? []),
      ])
        need(
          data.goods.some(
            (good) =>
              good.id === reward.good &&
              (good.kind === "item" || good.kind === "material")
          ),
          `地点 ${station.id} の報酬が不正`
        )
    }
}
