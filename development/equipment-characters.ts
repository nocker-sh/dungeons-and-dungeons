import { gameContent } from "@/content/game-content"
import characters from "@/concept/data/characters.json"
import players from "@/concept/data/players.json"
import { catalog } from "@/development/outfits"

export const people = characters.flatMap((group) =>
  group.characters.map((person) => ({ id: person.id, slug: person.slug }))
)

export const subjects = [
  ...gameContent.recruits.map(({ member }) => ({
    member,
    look: member.id,
    name: member.name,
    job: member.job,
    href:
      "/dev/characters/" +
      (people.find((person) => person.id === member.id)?.slug ?? member.id),
  })),
  ...players.map((player) => ({
    member: gameContent.party[0],
    look: player.id,
    name: "主人公・" + player.name,
    job: gameContent.party[0].job,
    href: "/dev/player/" + player.slug,
  })),
]

export function equipmentCharacters(goodId: string) {
  const good = catalog.good(goodId)
  if (!good || (good.kind !== "armor" && good.kind !== "weapon")) return []
  if (good.kind === "weapon") {
    const fixedOwners = subjects.filter(
      ({ member }) => member.unique && member.weapon === goodId
    )
    if (fixedOwners.length) return fixedOwners
  }
  return subjects.filter(
    ({ member }) => !member.unique && catalog.canEquip(member.id, goodId)
  )
}
