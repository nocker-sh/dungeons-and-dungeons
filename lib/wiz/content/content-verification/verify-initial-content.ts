import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifyInitialContent({ catalog, need }: ContentVerification) {
  const data = catalog.data

  const companions = data.startingCompanions ?? []
  need(
    new Set(companions).size === companions.length &&
      companions.length + data.party.length <= PARTY_SLOTS,
    "初期編成が重複または出撃の人数を超えている"
  )
  for (const companion of companions)
    need(
      catalog.member(companion) &&
        !data.party.some((member) => member.id === companion),
      "初期の仲間が不明または重複"
    )
  if (data.worldMap) {
    const map = data.worldMap
    const tiles = new Set(map.tiles.map((tile) => tile.id))
    need(
      tiles.size === map.tiles.length && tiles.has(map.start),
      "世界地図の地点が重複または開始地点が不明"
    )
    need(
      new Set(map.tiles.map((tile) => `${tile.x},${tile.y}`)).size ===
        map.tiles.length,
      "世界地図の座標が重複"
    )
    need(
      map.tiles.find((tile) => tile.id === map.start)?.settlement,
      "世界地図の開始地点は拠点にする"
    )
    for (const tile of map.tiles) {
      need(tile.x < map.width && tile.y < map.height, "世界地図の座標が範囲外")
      for (const entry of tile.goods ?? [])
        need(catalog.good(entry.good), "世界地図の採集品が不明")
      need(
        !tile.place || data.conversationPlaces?.includes(tile.place),
        "世界地図の会話場所が不明"
      )
      need(
        !tile.dungeon || catalog.layer(tile.dungeon),
        "世界地図のダンジョンが不明"
      )
    }
  }
  need(
    !data.startingDemon || catalog.demon(data.startingDemon),
    "最初の悪魔が不明"
  )
  for (const outfit of data.hero.outfits ?? [])
    need(
      catalog.good(outfit)?.kind === "armor",
      `主人公の衣装 ${outfit} が不明`
    )
}
