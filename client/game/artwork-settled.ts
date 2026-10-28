import { loading } from "@/client/game/artwork"

/** 読み込み中の絵がなくなるまで待つ（失敗した読み込みも終わりとして数える）。 */
export async function artworkSettled() {
  while (loading.size) await Promise.allSettled(loading)
}
