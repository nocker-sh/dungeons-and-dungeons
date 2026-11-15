import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { QuestDef } from "@/lib/wiz/content/content-schema"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"

/**
 * 討伐依頼の敵が出る層のうち、到達済み（`reached` 以下）のもの。
 * `bossOnly` ではボスとして出る層だけを数える（既定はボス勝利が条件の依頼だけ）。
 */
export function questLayers(
  catalog: GameCatalog,
  quest: WizDeepReadonly<QuestDef>,
  reached: number,
  bossOnly = !!quest.requiresBossVictory
) {
  return catalog.data.layers
    .filter((_layer, index) => index <= reached)
    .filter((layer) =>
      bossOnly
        ? layer.boss === quest.foe
        : layer.boss === quest.foe ||
          layer.foes.includes(quest.foe) ||
          layer.stations.some((station) => station.foes?.includes(quest.foe)) ||
          (layer.treasure.mimic?.foe === quest.foe &&
            layer.treasure.mimic.chance > 0)
    )
}
