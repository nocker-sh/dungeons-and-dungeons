import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifyRecruiting({ catalog, need }: ContentVerification) {
  const data = catalog.data

  for (const id of data.recruiting.initial)
    need(catalog.recruit(id), `最初の募集 ${id} がない`)
  need(
    data.recruiting.initial.length <= data.recruiting.slots,
    "最初の募集が枠の数より多い"
  )
  need(
    new Set(data.recruiting.initial).size === data.recruiting.initial.length,
    "最初の募集が重複している"
  )
}
