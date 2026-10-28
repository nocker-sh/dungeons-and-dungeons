import { foeAppearance } from "@/content/foe-appearance"

/** この個体が戦闘で切り替える画像。通常姿から退場まで、同じ選択で先読みする。 */
export function foeImagePaths(foe: string, appearanceId?: string) {
  const art = foeAppearance(foe, appearanceId)
  return [
    ...new Set(
      [
        art?.img,
        art?.attack,
        ...(art?.attacks ?? []),
        ...Object.values(art?.skills ?? {}),
        art?.sleeping,
        art?.defeated,
      ].filter((path): path is string => !!path)
    ),
  ]
}
