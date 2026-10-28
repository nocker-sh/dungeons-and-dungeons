import data from "@/concept/data/dialogues.json"
import { characterGroups } from "@/concept/characters"

export const dialogues = data.map((dialogue) => ({
  ...dialogue,
  speaker:
    characterGroups
      .flatMap((group) => group.characters)
      .find((character) => character.id === dialogue.speakerId)?.name ??
    dialogue.speakerId,
}))
