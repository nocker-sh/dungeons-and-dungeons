import { useSyncExternalStore } from "react"
import { subscribeResize } from "@/client/components/stage/subscribe-resize"

/** 隊列を横一列にする大きさか。 */
export function useWideFormation() {
  return useSyncExternalStore(
    subscribeResize,
    () => innerWidth / innerHeight > 1 && innerWidth >= 820,
    () => false
  )
}
