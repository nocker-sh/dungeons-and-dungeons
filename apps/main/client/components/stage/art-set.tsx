import { useCallback, useLayoutEffect, useRef } from "react"
import type { CSSProperties } from "react"
import { Camera } from "@/client/components/stage/camera"
import { CanvasImage } from "@/client/components/canvas/canvas-image"
import { REVERT } from "@/client/components/canvas/tokens"

/** カメラが動かす奥行きの層。 */
export const LAYER: CSSProperties = {
  ...REVERT,
  position: "absolute",
  inset: "-18%",
  willChange: "transform, filter",
  transformOrigin: "50% 55%",
  pointerEvents: "none",
}

export const LAYER_SVG: CSSProperties = {
  ...REVERT,
  display: "block",
  width: "100%",
  height: "100%",
}

/** 一枚絵の場面。絵を奥、光と手前の影を前に置いてカメラで撮る。 */
type Props = {
  src: string | null
  camera: Camera
  onArtboard: (element: HTMLDivElement | null) => void
}

export function ArtSet(props: Props) {
  const layers = useRef<(HTMLDivElement | null)[]>([])
  const registerArtboard = useCallback(
    (element: HTMLDivElement | null) => {
      layers.current[0] = element
      props.onArtboard(element)
    },
    [props.onArtboard]
  )
  useLayoutEffect(() => {
    const depths = [0.5, 0.9, 1.6]
    const offs = layers.current.map((el, i) =>
      el ? props.camera.add(el, depths[i]) : () => {}
    )
    return () => {
      for (const off of offs) off()
    }
  }, [props.camera, props.src])
  return (
    <>
      <div
        className="layer"
        ref={registerArtboard}
        style={{ ...LAYER, inset: "-7%" }}
      >
        {props.src ? (
          <CanvasImage
            src={props.src}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{ width: "100%", height: "100%", background: "#0b0c12" }}
          />
        )}
      </div>
      <div
        className="layer"
        ref={(el) => void (layers.current[1] = el)}
        style={LAYER}
      >
        <svg
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
          style={LAYER_SVG}
        >
          <polygon
            points="1000,0 1180,0 1560,1000 1260,1000"
            fill="#dcdee5"
            opacity=".08"
          />
        </svg>
      </div>
      <div
        className="layer"
        ref={(el) => void (layers.current[2] = el)}
        style={LAYER}
      >
        <svg
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
          style={LAYER_SVG}
        >
          <defs>
            <radialGradient id="vg" cx=".5" cy=".45" r=".7">
              <stop offset=".55" stopColor="#0b0c12" stopOpacity="0" />
              <stop offset="1" stopColor="#0b0c12" stopOpacity=".85" />
            </radialGradient>
          </defs>
          <rect width="1600" height="1000" fill="url(#vg)" />
        </svg>
      </div>
    </>
  )
}
