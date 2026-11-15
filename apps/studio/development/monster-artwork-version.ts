import type { ConceptEntry } from "@/concept/database"

/** 状態の枠は全版で共有し、選んだ版にない画像は補完しない。 */
export function monsterArtworkVersion(
  entry: ConceptEntry,
  version: string
): ConceptEntry {
  const variants = [entry, ...(entry.artworkVersions ?? [])]
  const artwork =
    version === "v0"
      ? entry
      : entry.artworkVersions?.find((item) => item.version === version)
  const attackCount = Math.max(
    0,
    ...variants.map((item) => item.attackImages?.length ?? 0)
  )
  const skills = new Set(
    variants.flatMap((item) => Object.keys(item.skillPortraits ?? {}))
  )
  return {
    ...entry,
    image: artwork?.image,
    attackImage: artwork?.attackImage ?? artwork?.attackImages?.[0],
    attackImages: Array.from(
      { length: attackCount },
      (_, index) => artwork?.attackImages?.[index] ?? ""
    ),
    skillPortraits: Object.fromEntries(
      [...skills].map((skill) => [
        skill,
        artwork?.skillPortraits?.[skill] ?? "",
      ])
    ),
    sleepingImage: artwork?.sleepingImage,
    defeatedImage: artwork?.defeatedImage,
  }
}
