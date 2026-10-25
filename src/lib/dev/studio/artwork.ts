import { contentSource, gameContent } from "@/lib/content/game-content"
import effects from "@/lib/concept/data/effects.json"
import { GameDefinition } from "@/lib/wiz"
import {
  battleSceneOf,
  DEMON_ART,
  FOE_ART,
  frameOf,
  layerLook,
  personFor,
  portraitOf,
  personOf,
  sceneOf,
  shopLook,
  street,
} from "@/lib/content/looks"
import type { PreviewStart } from "@/lib/game-client/start"

/** 選んだ隊列と実画面で使う絵だけ先読みする。無関係な資料画像を起動条件にしない。 */
export function studioArtwork(start: PreviewStart) {
  const paths = new Set<string>()
  const add = (path: string | null | undefined) => {
    if (path) paths.add(path)
  }
  const addPerson = (id: string, armor?: string) => {
    const frame = frameOf(id, armor)
    add(frame.img)
    add(frame.bust)
    for (const mode of personOf(id)?.contractModes ?? [])
      add(mode.battlePortrait)
    for (const expression of [
      "normal",
      "talk",
      "happy",
      "sigh",
      "angry",
      "surprised",
      "surprisedLarge",
      "thinking",
      "shy",
      "skill",
    ] as const)
      add(portraitOf(id, expression))
  }
  const definition = new GameDefinition(start.content ?? gameContent)
  const state = start.initialState ?? definition.initialState()
  for (const member of state.party) {
    const armor = state.gear.find(
      (gear) =>
        gear.owner === member &&
        definition.catalog.good(gear.good)?.kind === "armor"
    )
    const look = definition.catalog.member(member)?.hero
      ? state.hero.look
      : member
    addPerson(look, armor?.good)
  }
  for (const role of ["guide", "guild", "secret"]) addPerson(personFor(role))
  for (const role of [
    "town",
    "outskirts",
    "guild",
    "reception",
    "inn",
    "shop",
    "secret",
  ]) {
    add(sceneOf(role))
    add(sceneOf(role, true))
  }
  for (const room of contentSource.rooms) {
    add(sceneOf(room.id))
    add(sceneOf(room.id, true))
  }
  for (const layer of start.content?.layers ?? []) {
    add(layerLook(layer.id).art)
    add(battleSceneOf(layer.id))
    add(battleSceneOf(layer.id, true))
  }
  for (const quest of start.content?.quests ?? []) {
    if (!quest.encounter) continue
    add(battleSceneOf(quest.encounter.place))
    add(battleSceneOf(quest.encounter.place, true))
  }
  for (const shop of street()) {
    const look = shopLook(shop)
    add(look.scene)
    add(shopLook(shop, true).scene)
    for (const keeper of look.keepers) addPerson(keeper)
  }
  for (const foe of Object.values(FOE_ART)) {
    for (const individual of [foe, ...(foe.appearances ?? [])]) {
      add(individual.img)
      add(individual.attack)
      for (const image of Object.values(individual.skills ?? {})) add(image)
    }
  }
  for (const demon of Object.values(DEMON_ART)) add(demon.img)
  for (const effect of effects) add(effect.image)
  return [...paths]
}
