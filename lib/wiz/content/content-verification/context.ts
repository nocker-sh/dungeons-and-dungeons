import type { GameCatalog } from "@/lib/wiz/content/game-catalog"

/** 同じ診断一覧へ、検証順に参照の誤りを追加する。 */
export type ContentVerification = Readonly<{
  catalog: GameCatalog
  problems: string[]
  need: (ok: unknown, message: string) => void
}>
