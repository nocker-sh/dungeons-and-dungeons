import { useSyncExternalStore } from "react"
import { subscribeResize } from "@/client/components/stage/subscribe-resize"

/** 縦長の画面か（CSS の max-aspect-ratio: 1/1 の代わり）。 */
export function usePortrait() {
  return useSyncExternalStore(
    subscribeResize,
    () => innerWidth <= innerHeight,
    () => true
  )
}
