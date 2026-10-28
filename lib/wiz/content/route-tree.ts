import type { LayerDef } from "@/lib/wiz/content/content-schema"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"

type Layer = WizDeepReadonly<LayerDef>
type Station = Layer["stations"][number]

/** 複製した地点の id の区切り（元の地点 id + 区切り + 何本目の枝か）。 */
export const BRANCH_MARK = "~"

/**
 * 層の道のりを、合流しない木に広げる。
 * 作品データの道のりは分かれては合流する形でよい。合流する地点は、たどってきた枝ごとに先まで複製する。
 * 戻る線（祖先へ戻る地点）は複製せず、その枝の祖先へつなぐ。
 * 最初にたどった枝は元の id のまま（保存や依頼の参照を壊さない）、2本目からは `元のid~2` のように付ける。
 * 高さ（y）は木の形に付け直す。分かれ目で子を上下に振り、一本道ならそのまま。画面は今いる地点からの差で描く。
 */
export function expandRoute(layer: Layer): Layer {
  const byId = new Map(layer.stations.map((station) => [station.id, station]))
  const copies = new Map<string, number>()
  const out: Station[] = []
  // いまたどっている枝の祖先（戻る線は、その枝の祖先の地点へつなぐ）
  const path = new Map<string, string>()
  const visit = (id: string, y: number): string => {
    const station = byId.get(id)
    if (!station) return id
    const ancestor = path.get(id)
    if (ancestor) return ancestor
    const count = (copies.get(id) ?? 0) + 1
    copies.set(id, count)
    const newId = count === 1 ? id : `${id}${BRANCH_MARK}${count}`
    const index = out.length
    out.push(station)
    path.set(id, newId)
    const spread = station.next.length
    const next = station.next.map((entry, order) =>
      visit(entry, spread > 1 ? y + (order * 2 - (spread - 1)) : y)
    )
    path.delete(id)
    out[index] = { ...station, id: newId, y, next }
    return newId
  }
  visit(layer.start, 0)
  return { ...layer, stations: out }
}
