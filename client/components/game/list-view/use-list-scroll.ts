import { useCallback, useLayoutEffect, type RefObject } from "react"
import { frame, cancelFrame } from "motion"
import { play } from "@/client/components/canvas/play"

type Props = {
  grid: RefObject<HTMLDivElement | null>
  bar: RefObject<HTMLDivElement | null>
  thumb: RefObject<HTMLElement | null>
  rowContent: RefObject<HTMLDivElement | null>
  tab: number
  open: boolean
}

/** スクロール位置と、行・画面の大きさに合わせてつまみを更新する。 */
export function useListScroll(props: Props) {
  const sync = useCallback(() => {
    const g = props.grid.current
    if (!g || !props.bar.current || !props.thumb.current) return
    const max = g.scrollHeight - g.clientHeight
    props.bar.current.style.display = max > 2 ? "block" : "none"
    const h = Math.max(0.14, g.clientHeight / Math.max(1, g.scrollHeight))
    props.thumb.current.style.height = `${h * 100}%`
    play(
      props.thumb.current,
      [
        { top: getComputedStyle(props.thumb.current).top },
        { top: `${max > 0 ? (g.scrollTop / max) * (1 - h) * 100 : 0}%` },
      ],
      { duration: 80, fill: "both", id: "scroll" }
    )
  }, [])
  const scheduleSync = useCallback(() => frame.postRender(sync), [sync])
  useLayoutEffect(() => {
    // 画面の高さ・文字の読み込み・行の増減でも、表示範囲とつまみを揃える。
    const observer = new ResizeObserver(scheduleSync)
    if (props.grid.current) observer.observe(props.grid.current)
    if (props.rowContent.current) observer.observe(props.rowContent.current)
    scheduleSync()
    return () => {
      observer.disconnect()
      cancelFrame(sync)
    }
  }, [scheduleSync, sync, props.tab, props.open])

  return { sync, scheduleSync }
}
