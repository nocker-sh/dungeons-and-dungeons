import type { ConceptEntry } from "@/concept/database"

/** 枠構造は共通。画像だけを選択版から取得し、別版では補完しない。 */
export function characterArtworkVersion(
  entry: ConceptEntry,
  version: string
): ConceptEntry {
  if (version === "v0") return entry
  const artwork = entry.bustPortraitVersions?.find(
    (item) => item.version === version
  )
  return {
    ...entry,
    image: artwork?.portraits.normal ?? undefined,
    portraits: {
      ...Object.fromEntries(
        Object.keys(entry.portraits ?? {}).map((key) => [key, null])
      ),
      normal: artwork?.portraits.normal ?? null,
      ...artwork?.portraits,
    },
    bustPortraits: {
      normal: null,
      talk: null,
      happy: null,
      sigh: null,
      angry: null,
      ...artwork?.portraits,
    },
    battleRearPortrait: entry.battleRearPortrait
      ? (artwork?.battleRearPortrait ?? "")
      : undefined,
    battleRearLookPortrait:
      entry.battleRearPortrait || entry.battleRearLookPortrait
        ? (artwork?.battleRearLookPortrait ?? "")
        : undefined,
    skillPortraits: Object.fromEntries(
      Object.keys(entry.skillPortraits ?? {}).map((key) => [key, ""])
    ),
    costumePortraits: entry.costumePortraits?.map((costume) => ({
      ...costume,
      image: "",
      portraits: Object.fromEntries(
        Object.keys(costume.portraits ?? {}).map((key) => [key, ""])
      ),
    })),
    contractModes: entry.contractModes?.map((mode) => ({
      ...mode,
      battlePortrait: artwork?.contractModePortraits?.[mode.weapon] ?? "",
    })),
  }
}
