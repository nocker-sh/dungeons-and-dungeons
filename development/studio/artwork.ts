import { gameContent } from "@/content/game-content"
import effects from "@/concept/data/effects.json"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { foeAppearance } from "@/content/foe-appearance"
import { foeImagePaths } from "@/content/foe-image-paths"
import { battleSceneOf } from "@/content/looks/battle-scene-of"
import { layerSceneArt } from "@/content/looks/layer-scene-art"
import { sceneOf } from "@/content/looks/scene-of"
import { frameOf } from "@/content/looks/frame-of"
import { portraitOf } from "@/content/looks/portrait-of"
import { personOf } from "@/content/looks/person-of"
import { personFor } from "@/content/looks/person-for"
import { shopLook } from "@/content/looks/shop-look"
import type { PreviewStart } from "@/client/dev/preview-start"

/** 現在の画面・隊列・敵と共通演出を先読みする。別施設の絵を起動条件にしない。 */
export function studioArtwork(start: PreviewStart) {
  const paths = new Set<string>()
  const add = (path: string | null | undefined) => {
    if (path) paths.add(path)
  }
  const addPerson = (id: string, armor?: string, mode?: number) => {
    const frame = frameOf(id, armor, mode)
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
  // 表示用の読み取りは独立した環境で行い、本番フレームの乱数・IDを消費しない。
  const game = definition.create(undefined, start.initialState)
  if (!start.initialState && start.save !== undefined) {
    const failed = game.restore(start.save)
    if (failed) throw failed
  }
  const { state, queries } = game
  for (const id of state.party) {
    const member = queries.member(state, id)
    if (member)
      addPerson(
        member.look,
        member.armor?.good,
        member.pact?.find((mode) => mode.current)?.index
      )
  }
  const addScene = (role: string) => {
    add(sceneOf(role))
    add(sceneOf(role, true))
  }
  const screen = start.screen
  const battle = queries.battle(state)
  if (screen.name === "expedition") {
    const scene = queries.scene(state)
    if (scene) {
      add(layerSceneArt(scene.layer, scene.key))
      add(layerSceneArt(scene.layer, scene.key, true))
    } else addScene("outskirts")
  }
  if (battle) {
    add(battleSceneOf(battle.place))
    add(battleSceneOf(battle.place, true))
  } else if (screen.name === "shop") {
    const look = shopLook(screen.shop)
    add(look.scene)
    add(shopLook(screen.shop, true).scene)
    for (const keeper of look.keepers) addPerson(keeper)
  } else if (screen.name === "place") {
    addScene(screen.place)
    if (screen.place === "reception") addPerson(personFor("guild"))
  } else if (screen.name === "room") {
    add(sceneOf(screen.room) ?? sceneOf("inn"))
    add(sceneOf(screen.room, true) ?? sceneOf("inn", true))
  } else if (screen.name === "outskirts") {
    addScene("outskirts")
    addPerson(personFor("guide"))
  } else if (screen.name === "quests") addScene("reception")
  else if (screen.name === "create") addScene("attic")
  else if (screen.name === "prologue") {
    addScene("guild")
    addPerson(personFor("guild"))
  } else if (screen.name === "town" || screen.name === "world-map") {
    addScene("town")
  }
  if (state.phase.type === "battle")
    for (const foe of state.phase.battle.foes)
      for (const path of foeImagePaths(foe.foe, foe.appearanceId)) add(path)
  // 依頼一覧・バッグの依頼欄には敵の通常姿を使う。戦闘用の差分はまだ要らない。
  for (const quest of (start.content ?? gameContent).quests)
    if (
      start.screen.name === "quests" ||
      (start.overlay?.kind === "bag" &&
        state.quests.some((entry) => entry.id === quest.id && !entry.claimed))
    )
      add(foeAppearance(quest.foe)?.img)
  for (const effect of effects) add(effect.image)
  return [...paths]
}
