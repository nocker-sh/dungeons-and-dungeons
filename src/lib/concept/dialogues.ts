import data from "./data/dialogues.json"
import { characterGroups } from "./characters"

export const dialogues = data.map((dialogue) => ({
  ...dialogue,
  speaker:
    characterGroups
      .flatMap((group) => group.characters)
      .find((character) => character.id === dialogue.speakerId)?.name ??
    dialogue.speakerId,
}))
