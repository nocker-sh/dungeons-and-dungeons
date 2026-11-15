import { scaledMs } from "@/client/components/canvas/scaled-ms"

/** motion の秒。演出の待ち時間の倍率（プレビューの早送り）もかける。 */
export function seconds(ms: number) {
  return scaledMs(ms) / 1000
}
