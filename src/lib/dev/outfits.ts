import { GameCatalog } from "@/lib/wiz"
import { gameContent } from "@/lib/content/game-content"
import { goodsCatalog } from "./goods"
import characters from "@/lib/concept/data/characters.json"
import players from "@/lib/concept/data/players.json"

const catalog = new GameCatalog(gameContent)

export function wearableArmor(memberId: string, lookId?: string) {
  if (players.some((player) => player.id === lookId)) {
    return goodsCatalog.filter(
      (good) =>
        good.kind === "armor" && gameContent.hero.outfits?.includes(good.id)
    )
  }
  if (catalog.member(memberId)?.unique) return []
  return goodsCatalog.filter(
    (good) => good.kind === "armor" && catalog.canEquip(memberId, good.id)
  )
}

const people = characters.flatMap((group) =>
  group.characters.map((person) => ({ id: person.id, slug: person.slug }))
)
const subjects = [
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
