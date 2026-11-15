import { GameCatalog } from "@/lib/wiz/content/game-catalog"

const catalogs = new WeakMap<object, GameCatalog>()

/**
 * テストで同じ作品データから何度も遊ぶとき、検証・凍結した定義を使い回す。
 * 作品データの検証と凍結は1回で数十msかかり、テストごとにやり直すと全体の大半を占める。
 * 定義（`GameCatalog`）は凍結されてプレイ間で共有する前提なので、同じ入力からは同じ定義を返す。
 * 入力は渡した後に書き換えないこと（テストは `aContent()` で新しいデータを作る）。
 * 誤った作品データは保存せず、呼ぶたびに同じ `ContentError` を投げる。
 */
export function catalogOf(content: unknown): GameCatalog {
  if (content instanceof GameCatalog) return content
  if (typeof content !== "object" || content === null)
    return new GameCatalog(content)
  const cached = catalogs.get(content)
  if (cached) return cached
  const catalog = new GameCatalog(content)
  catalogs.set(content, catalog)
  return catalog
}
