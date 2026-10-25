import type { GameCatalog } from "@/lib/wiz/content"
import type { GameState } from "@/lib/wiz/state"

/** 地図の位置・道の解放・一度だけの採集を保存から求める。 */
export class WorldMapRules {
  constructor(private readonly catalog: GameCatalog) {}
  journey(state: GameState) {
    const start = this.catalog.data.worldMap?.start ?? ""
    return state.journey ?? { at: start, visited: [start], collected: [] }
  }
  visible(
    state: GameState,
    tile: NonNullable<GameCatalog["data"]["worldMap"]>["tiles"][number]
  ) {
    return (
      state.reached >= (tile.minimumReached ?? 1) &&
      (tile.requires ?? []).every((flag) =>
        state.conversation?.flags?.includes(flag)
      )
    )
  }
  view(state: GameState) {
    const map = this.catalog.data.worldMap
    if (!map) return null
    const journey = this.journey(state)
    const current = map.tiles.find((tile) => tile.id === journey.at)!
    const ready =
      state.phase.type === "town" &&
      state.reached >= 1 &&
      !state.wipe &&
      !state.hero.registrationPending &&
      !state.conversation?.active
    return {
      ...map,
      current,
      ready,
      tiles: map.tiles.map((tile) => ({
        ...tile,
        visible: this.visible(state, tile),
        current: tile.id === journey.at,
        visited: journey.visited.includes(tile.id),
        collected: journey.collected.includes(tile.id),
        canMove:
          ready &&
          this.visible(state, tile) &&
          Math.abs(tile.x - current.x) + Math.abs(tile.y - current.y) === 1,
        canTravel:
          ready &&
          !!tile.settlement &&
          journey.visited.includes(tile.id) &&
          tile.id !== journey.at,
      })),
      requests: this.catalog.data.demons.flatMap((demon) => {
        if (
          !demon.contract ||
          state.demons.some((owned) => owned.id === demon.id) ||
          !state.conversation?.seen.includes(demon.contract.encounter)
        )
          return []
        return [
          {
            demon: demon.name,
            materials: demon.contract.materials.map((entry) => ({
              name: this.catalog.good(entry.good)!.name,
              count: entry.count,
              locations: map.tiles
                .filter((tile) =>
                  tile.goods?.some((good) => good.good === entry.good)
                )
                .map((tile) => ({
                  name: this.visible(state, tile) ? tile.name : "村で道を聞く",
                  tile: tile.id,
                })),
            })),
          },
        ]
      }),
    }
  }
}
