import { CanvasBox } from "@/client/components/canvas/canvas-box"
import { PALETTE, STAGE_LAYER } from "@/client/components/canvas/tokens"

/**
 * 読めない保存を残して「このまま（保存しない）」を選んだあいだ、隅に小さく出し続ける。
 * 押せず、場面の操作を邪魔しない。
 */
export function UnsavedNotice() {
  return (
    <CanvasBox
      role="status"
      data-unsaved-notice
      style={{
        position: "absolute",
        top: 6,
        left: 6,
        zIndex: STAGE_LAYER.alert,
        pointerEvents: "none",
        padding: "2px 8px",
        background: PALETTE.ink,
        color: PALETTE.paper,
        border: `1px solid ${PALETTE.blood}`,
        fontSize: 11,
        lineHeight: 1.5,
        fontWeight: 700,
        opacity: 0.8,
        whiteSpace: "nowrap",
      }}
    >
      保存していません
    </CanvasBox>
  )
}
