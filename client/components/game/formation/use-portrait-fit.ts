import { useCallback, useLayoutEffect, type RefObject } from "react"
import type { Frame } from "@/content/looks/frame-of"
import type { FormationCards } from "@/client/components/game/formation-cards"

type Props = {
  cards: FormationCards
  frame: Frame
  wide: boolean
  useBust: boolean
  up: boolean
  card: RefObject<HTMLDivElement | null>
  picture: RefObject<HTMLImageElement | null>
}

/** 仲間の顔と数値を、札のうち実際に見える範囲へ収める。 */
export function usePortraitFit(props: Props) {
  const portraitScale = props.wide ? 0.6 : 0.38
  /**
   * 顔が必ず札の見えている範囲に収まるように置く。
   * 札の幅ではなく「画面に見えている高さ」から顔の大きさを決め、顔の中心を見えている範囲の中ほどへ置く。
   * 端末の縦横や札のはみ出しが変わっても、顔が切れない。
   * 持ち上げた（up）ときは立ち絵を大きく出すので、これまでどおり幅から決める。
   */
  const fit = useCallback(() => {
    const element = props.card.current
    const image = props.picture.current
    if (!element) return
    // 変形（登場の動き・傾き）の影響を受けないよう、配置の値（offset）で測る
    const container = element.parentElement
    const siblings = props.cards.all()
    const rightEdge = element.offsetLeft + element.offsetWidth
    /**
     * 札の右側が、画面の外や隣の札に隠れる幅。
     * HPや武器名は右寄せなので、この分だけ内側へ寄せないと3桁のHPが欠ける。
     */
    let hiddenRight = Math.max(
      0,
      rightEdge - (container?.offsetWidth ?? rightEdge)
    )
    for (const other of siblings.slice(siblings.indexOf(element) + 1)) {
      const sameRow =
        Math.min(
          element.offsetTop + element.offsetHeight,
          other.offsetTop + other.offsetHeight
        ) - Math.max(element.offsetTop, other.offsetTop)
      if (
        sameRow > element.offsetHeight * 0.4 &&
        other.offsetLeft > element.offsetLeft
      )
        hiddenRight = Math.max(hiddenRight, rightEdge - other.offsetLeft)
    }
    element.style.setProperty(
      "--hidden-right",
      `${Math.min(hiddenRight, element.offsetWidth * 0.5)}px`
    )
    if (!image) return
    if (props.up) {
      const imageHeight =
        props.frame.zoom *
        portraitScale *
        element.offsetWidth *
        props.frame.ratio
      Object.assign(image.style, {
        left: "36%",
        top: `${((0.45 * element.offsetHeight - props.frame.fy * imageHeight) / element.offsetHeight) * 100}%`,
        width: `${props.frame.zoom * portraitScale * 100}%`,
        height: "auto",
        translate: `${-props.frame.fx * 100}% 0`,
      })
      return
    }
    const top = element.offsetTop
    let bottom = Math.min(
      top + element.offsetHeight,
      container?.offsetHeight ?? top + element.offsetHeight
    )
    // 後ろに並ぶ札（DOMで後＝上に描かれる）が下から重なっていれば、そこまでを見えている範囲にする
    for (const other of siblings.slice(siblings.indexOf(element) + 1)) {
      const overlap =
        Math.min(
          other.offsetLeft + other.offsetWidth,
          element.offsetLeft + element.offsetWidth
        ) - Math.max(other.offsetLeft, element.offsetLeft)
      if (overlap > element.offsetWidth * 0.25 && other.offsetTop > top)
        bottom = Math.min(bottom, other.offsetTop)
    }
    const visible = Math.max(1, bottom - top)
    // 画面の左右へはみ出した分も除く
    const left = Math.max(0, -element.offsetLeft)
    const natural =
      image.naturalWidth && image.naturalHeight
        ? image.naturalHeight / image.naturalWidth
        : props.frame.ratio
    // 上半身の絵は見えている幅に合わせ、顔から胸までを見せる（顔の高さは見えている高さの4割まで）。
    // 立ち絵しかない者は、顔の高さ＝見えている高さの6割（顔が絵に占める割合は1/6.5）で切り抜く
    const shown = element.offsetWidth - left
    const imageHeight = props.useBust
      ? Math.min(shown * 1.05 * natural, (visible * 0.4) / (1 / 5))
      : (visible * 0.6) / (1 / 6.5)
    const imageWidth = imageHeight / natural
    // 顔の中心：上半身の絵は札の左から4割・上寄り、立ち絵は左から3割・半分より少し上
    const faceCenterX = left + shown * (props.useBust ? 0.4 : 0.3)
    const faceCenterY = visible * (props.useBust ? 0.34 : 0.46)
    Object.assign(image.style, {
      left: `${faceCenterX - props.frame.fx * imageWidth}px`,
      top: `${faceCenterY - props.frame.fy * imageHeight}px`,
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      translate: "0 0",
    })
  }, [
    props.cards,
    props.frame,
    portraitScale,
    props.up,
    props.useBust,
    props.card,
    props.picture,
  ])
  useLayoutEffect(() => {
    fit()
    const element = props.card.current
    if (!element) return
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    if (element.parentElement) observer.observe(element.parentElement)
    return () => observer.disconnect()
  }, [fit, props.wide, props.card])

  return fit
}
