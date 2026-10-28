import { useSyncExternalStore } from "react"
import { subscribeResize } from "@/client/components/stage/subscribe-resize"

/** 横長の画面か。配置とサイズの切り替えに使う（モックの wide()）。 */
export function useWide() {
  return useSyncExternalStore(
    subscribeResize,
    () =>
      innerWidth /
        Math.max(
          1,
          innerHeight -
            (innerWidth / innerHeight > 1 && innerWidth >= 820
              ? innerHeight * 0.13
              : innerHeight * 0.24)
        ) >
      1.2,
    () => false
  )
}
