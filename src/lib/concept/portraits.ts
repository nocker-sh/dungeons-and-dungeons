import { characterGroups } from "./characters"
import { resolvePortrait, type PortraitState } from "./portrait-types"

export function portraitFor(
  id: string,
  state: PortraitState = "normal",
  costume?: string
) {
  const character = characterGroups
    .flatMap((group) => group.characters)
    .find((entry) => entry.id === id)
  const costumePortrait = character?.costumePortraits?.find(
    (entry) => entry.slug === costume
  )
  if (costumePortrait?.image)
    return resolvePortrait(
      { ...costumePortrait.portraits, normal: costumePortrait.image },
      state
    )
  return character?.portraits
    ? resolvePortrait(character.portraits, state, character.bustPortraits)
    : character?.image
}
