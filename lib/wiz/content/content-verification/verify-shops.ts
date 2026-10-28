import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifyShops({ catalog, need }: ContentVerification) {
  const data = catalog.data

  for (const shop of data.shops) {
    for (const good of [...shop.goods, ...(shop.appraise ?? [])])
      need(catalog.good(good), `店 ${shop.id} の品物 ${good} がない`)
    for (const good of shop.goods)
      need(catalog.good(good)?.price, `店 ${shop.id} の ${good} に値段がない`)
  }
}
