import type { LayerDef } from "@/lib/wiz/content/content-schema"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { Expedition } from "@/lib/wiz/state/state-schema"

type Layer = WizDeepReadonly<LayerDef>
type Station = Layer["stations"][number]

/** 地点の背景の種類。道中・宝箱・休める場所。 */
export type SceneKind = "path" | "treasure" | "rest"

/**
 * 層の中で、いまの地点に見せる背景を選ぶ。
 * 乱数も保存も使わず、通った地点の並びから決める（同じ探索なら読み込み直しても同じ絵）。
 * 同じ種類の背景は、その種類の地点を通るたびに候補を順に回す。
 */
export class LayerScenes {
  /** 地点の出来事から背景の種類を決める。発見は休む・手当ての選択肢があれば休憩。 */
  static kindOf(
    station: Station | undefined,
    event: Expedition["events"][number]["kind"] | null
  ): SceneKind {
    if (event === "treasure") return "treasure"
    if (
      event === "discovery" &&
      station?.discovery?.choices.some(
        (choice) => (choice.healRatio ?? 0) > 0 || (choice.fatigue ?? 0) > 0
      )
    )
      return "rest"
    return "path"
  }

  /** いまの地点の背景。層に候補がなければ null。 */
  static pick(
    layer: Layer,
    expedition: Pick<Expedition, "at" | "visited" | "events">
  ): { kind: SceneKind; key: string } | null {
    const scenes = layer.scenes
    if (!scenes) return null
    const candidates = (kind: SceneKind) =>
      (kind === "path" ? scenes.path : scenes[kind]) ?? scenes.path
    const kindAt = (stationId: string) =>
      LayerScenes.kindOf(
        layer.stations.find((station) => station.id === stationId),
        expedition.events.find((event) => event.station === stationId)?.kind ??
          null
      )
    const position = expedition.visited.lastIndexOf(expedition.at)
    const passed =
      position >= 0
        ? expedition.visited.slice(0, position)
        : [...expedition.visited]
    const kind = kindAt(expedition.at)
    const list = candidates(kind)
    // 同じ候補の並びを使う種類の地点を数える（宝箱の候補がない層では宝箱も道中として数える）
    const order = passed.filter(
      (stationId) => candidates(kindAt(stationId)) === list
    ).length
    return { kind, key: list[order % list.length] }
  }
}
