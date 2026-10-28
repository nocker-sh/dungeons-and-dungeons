export const WIZ_BATTLE_EFFECT_TAG = Object.freeze({
  blocksAction: "battle.blocks-action",
  dead: "battle.dead",
  defending: "battle.defending",
  fled: "battle.fled",
  silenced: "battle.silenced",
})

export const standardTags = (effectId: string): readonly string[] => {
  const tags: string[] = []
  if (
    effectId === "paralysis" ||
    effectId === "sleep" ||
    effectId === "dead" ||
    effectId === "fled"
  ) {
    tags.push(WIZ_BATTLE_EFFECT_TAG.blocksAction)
  }
  if (effectId === "dead") tags.push(WIZ_BATTLE_EFFECT_TAG.dead)
  if (effectId === "defending") tags.push(WIZ_BATTLE_EFFECT_TAG.defending)
  if (effectId === "fled") tags.push(WIZ_BATTLE_EFFECT_TAG.fled)
  if (effectId === "silence") tags.push(WIZ_BATTLE_EFFECT_TAG.silenced)
  return Object.freeze(tags)
}
