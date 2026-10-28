import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifyInitialSupplies({ catalog, need }: ContentVerification) {
  const data = catalog.data

  need(
    catalog.good(data.junk)?.kind === "material",
    `ガラクタ ${data.junk} は素材の品物にする`
  )
  if (data.rareJunk)
    need(
      catalog.good(data.rareJunk)?.kind === "material" &&
        data.rareJunk !== data.junk,
      `光るガラクタ ${data.rareJunk} はガラクタと別の素材の品物にする`
    )
  for (const entry of data.startingBag)
    need(catalog.good(entry.good), `最初の持ち物 ${entry.good} がない`)
  for (const entry of data.summon.failure)
    need(catalog.good(entry.good), `召喚の失敗で得る ${entry.good} がない`)
}
