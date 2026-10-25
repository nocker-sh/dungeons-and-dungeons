import { conceptEntries, type ConceptEntry } from "@/lib/concept/database"

/** ゲームの個体抽選は維持し、devではデザインごとに独立して確認する。 */
export function individualConceptEntries(
  source: readonly ConceptEntry[]
): ConceptEntry[] {
  const registeredImages = new Set(
    source
      .filter((entry) => entry.category === "敵")
      .map((entry) => entry.image)
  )
  return source.flatMap((entry) => {
    if (entry.category !== "敵") return [entry]
    const { appearances, ...base } = entry
    return [
      base,
      ...(appearances ?? []).flatMap((appearance, index) => {
        if (registeredImages.has(appearance.image)) return []
        registeredImages.add(appearance.image)
        return [
          {
            id: `${entry.id}:${appearance.slug ?? index + 1}`,
            slug: appearance.slug ?? `${entry.slug}-individual-${index + 1}`,
            name: appearance.name ?? `${entry.name}（個体差 ${index + 1}）`,
            category: entry.category,
            section: entry.section,
            role: "個体差",
            image: appearance.image,
            attackImage: appearance.attackImage,
            attackImages: appearance.attackImages,
            attack: entry.attack,
            skillNames: entry.skillNames,
            skillPortraits: appearance.skillPortraits,
            sleepingImage: appearance.sleepingImage,
            defeatedImage: appearance.defeatedImage,
          },
        ]
      }),
    ]
  })
}

export const devConceptEntries = individualConceptEntries(conceptEntries)
