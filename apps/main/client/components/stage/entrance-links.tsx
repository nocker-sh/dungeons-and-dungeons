import { useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import { CanvasBox } from "@/client/components/canvas/canvas-box"
import { useStage } from "@/client/components/stage/use-stage"
import type {
  EntranceLink,
  ArtworkGeometry,
} from "@/client/components/stage/entrance-links-shared"
import { FallbackEntrance } from "@/client/components/stage/fallback-entrance"
import { EntranceBubble } from "@/client/components/stage/entrance-bubble"

/** object-fit: cover と同じ画像座標の面を、背景のカメラ層に重ねる。 */
type Props = {
  links: readonly EntranceLink[]
  wide: boolean
}

export function EntranceLinks(props: Props) {
  const { artboard, canvas } = useStage()
  const [geometry, setGeometry] = useState<ArtworkGeometry | null>(null)
  useLayoutEffect(() => {
    setGeometry(null)
    const viewport = canvas.current
    if (!artboard || !viewport) return
    const measure = () => {
      const image = artboard.querySelector("img")
      // 背景が読めなくても入口を消さない。画像が戻ったら実寸で測り直す。
      const imageWidth = image?.naturalWidth || artboard.clientWidth
      const imageHeight = image?.naturalHeight || artboard.clientHeight
      if (!imageWidth || !imageHeight) return
      const scale = Math.max(
        artboard.clientWidth / imageWidth,
        artboard.clientHeight / imageHeight
      )
      const width = imageWidth * scale
      const height = imageHeight * scale
      const left = (artboard.clientWidth - width) / 2
      const top = (artboard.clientHeight - height) / 2
      setGeometry({
        loaded: !!image?.naturalWidth && !!image.naturalHeight,
        width,
        height,
        left,
        top,
        visibleLeft: (artboard.clientWidth - viewport.clientWidth) / 2 - left,
        visibleTop: (artboard.clientHeight - viewport.clientHeight) / 2 - top,
        viewportWidth: viewport.clientWidth,
        viewportHeight: viewport.clientHeight,
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(artboard)
    observer.observe(viewport)
    // imgが差し替わる場合も、背景層で読み込みと失敗を受け取る。
    artboard.addEventListener("load", measure, true)
    artboard.addEventListener("error", measure, true)
    measure()
    return () => {
      observer.disconnect()
      artboard.removeEventListener("load", measure, true)
      artboard.removeEventListener("error", measure, true)
    }
  }, [artboard, canvas])
  if (!artboard || !geometry) return null
  if (!geometry.loaded) {
    const width = Math.min(520, geometry.viewportWidth - 48)
    return createPortal(
      <CanvasBox
        data-entrance-links
        data-entrance-fallback
        style={{
          position: "absolute",
          left: geometry.visibleLeft + (geometry.viewportWidth - width) / 2,
          top: geometry.visibleTop + geometry.viewportHeight * 0.12,
          width,
          display: "grid",
          gridTemplateColumns: props.wide ? "1fr 1fr" : "1fr",
          gap: 12,
          pointerEvents: "none",
        }}
      >
        {props.links.map((link) => (
          <FallbackEntrance key={link.id} link={link} />
        ))}
      </CanvasBox>,
      artboard
    )
  }
  return createPortal(
    <CanvasBox
      data-entrance-links
      style={{
        position: "absolute",
        left: geometry.left,
        top: geometry.top,
        width: geometry.width,
        height: geometry.height,
        pointerEvents: "none",
      }}
    >
      {props.links.map((link, index) => (
        <EntranceBubble
          key={link.id}
          link={link}
          geometry={geometry}
          wide={props.wide}
          index={index}
        />
      ))}
    </CanvasBox>,
    artboard
  )
}
