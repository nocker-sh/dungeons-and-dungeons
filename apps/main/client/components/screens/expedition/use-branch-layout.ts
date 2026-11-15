import { useEffect, useState, type RefObject } from "react"
import type { Game } from "@/lib/wiz/game/game"
import type { StageApi } from "@/client/components/stage/use-stage"

type Props = {
  wide: boolean
  showLeft: boolean
  carryingText: string
  buttons: boolean
  buttonsKey: number
  hideButtons: boolean
  route: Pick<
    NonNullable<ReturnType<Game["queries"]["route"]>>,
    "at" | "surveyLeft"
  >
  leftRef: RefObject<HTMLDivElement | null>
  selectedPathDetails: RefObject<HTMLDivElement | null>
  carryingSummary: RefObject<HTMLDivElement | null>
  stage: Pick<StageApi, "canvas">
}

/** 入場後の実寸から、スマホの分岐説明と持ち帰る物の重なりを避ける。 */
export function useBranchLayout(props: Props) {
  const [branchTop, setBranchTop] = useState<number | null>(null)
  const [branchDetailsHeight, setBranchDetailsHeight] = useState<number | null>(
    null
  )
  useEffect(() => {
    const details = props.selectedPathDetails.current
    const summary = props.carryingSummary.current
    if (props.wide || !details || !summary) {
      setBranchDetailsHeight(null)
      setBranchTop(null)
      return
    }
    let disposed = false
    const resize = () => {
      if (disposed) return
      const status = props.leftRef.current
      const canvas = props.stage.canvas.current
      if (
        status &&
        canvas &&
        !status
          .getAnimations()
          .some((animation) => animation.playState === "running")
      ) {
        const bounds = canvas.getBoundingClientRect()
        const scale = canvas.clientHeight / bounds.height
        setBranchTop(
          Math.ceil(
            (status.getBoundingClientRect().bottom - bounds.top) * scale + 8
          )
        )
      }
      const available =
        summary.getBoundingClientRect().top -
        details.getBoundingClientRect().top -
        8
      setBranchDetailsHeight(Math.min(150, Math.max(40, Math.floor(available))))
    }
    const observer = new ResizeObserver(resize)
    observer.observe(summary)
    if (props.leftRef.current) {
      observer.observe(props.leftRef.current)
      // 入場の移動中は位置が変わるので、演出が終わった位置でも測り直す。
      void Promise.allSettled(
        props.leftRef.current
          .getAnimations()
          .map((animation) => animation.finished)
      ).then(resize)
    }
    if (details.previousElementSibling)
      observer.observe(details.previousElementSibling)
    if (props.stage.canvas.current) observer.observe(props.stage.canvas.current)
    resize()
    return () => {
      disposed = true
      observer.disconnect()
    }
  }, [
    props.wide,
    props.showLeft,
    branchTop,
    props.carryingText,
    props.buttons,
    props.buttonsKey,
    props.hideButtons,
    props.route.at,
    props.route.surveyLeft,
  ])
  return { branchTop, branchDetailsHeight }
}
