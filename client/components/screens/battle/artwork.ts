import { loadArtwork } from "@/client/game/load-artwork"

/** 絵の失敗で、確定済みの行動結果や勝敗の表示を止めない。 */
export async function loadBattleArtwork(paths: readonly string[]) {
  try {
    await loadArtwork(paths)
    return true
  } catch {
    // 元の読み込み処理は失敗したキャッシュを外す。次の手番では再試行できる。
    return false
  }
}
