import { motion } from "motion/react"
import {
  BUTTON_BASE,
  PALETTE,
  REVERT,
  unit,
  STAGE_LAYER,
} from "@/client/components/canvas/tokens"
import { useFormation } from "@/client/components/game/formation/context"
import type { TargetRequest } from "@/client/components/game/formation/context"

/** 仲間を選んでいる間、上の場面を暗くして下の札に目を向けさせる。押すと取りやめ。 */
type Props = { request: TargetRequest }

export function TargetDim(props: Props) {
  const formation = useFormation()
  // 取りやめは有限オートマトンが受け、依頼の onCancel を呼ぶ
  const cancel = () => formation.requestTarget(null)
  return (
    <motion.div
      className="target-dim"
      onClick={cancel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{
        ...REVERT,
        display: "block",
        position: "absolute",
        inset: 0,
        zIndex: STAGE_LAYER.dim,
        background: "rgb(7 6 12 / 0.62)",
        cursor: "pointer",
      }}
    >
      {props.request.details?.length ? (
        <div
          role="region"
          aria-label={props.request.detailLabel ?? "着替え後の比較"}
          onClick={(event) => event.stopPropagation()}
          style={{
            ...REVERT,
            position: "absolute",
            left: "50%",
            top: "20%",
            bottom: "22%",
            translate: "-50% 0",
            width: "90%",
            maxWidth: unit(110),
            overflowY: "auto",
            color: PALETTE.paper,
            fontSize: unit(3.4),
            lineHeight: 1.5,
            cursor: "auto",
          }}
        >
          {props.request.details.map((entry) => (
            <div
              key={entry.member}
              id={`target-detail-${entry.member}`}
              style={{
                ...REVERT,
                padding: `${unit(1.4)} ${unit(2)}`,
                marginBottom: unit(1),
                background: PALETTE.ink,
              }}
            >
              <b style={{ ...REVERT, display: "block", fontWeight: 800 }}>
                {entry.name}
              </b>
              <span style={{ ...REVERT }}>
                {entry.description.split("　").map((part) => (
                  <span
                    key={part}
                    style={{
                      ...REVERT,
                      display: "inline-block",
                      maxWidth: "100%",
                      marginRight: unit(2),
                      wordBreak: "keep-all",
                    }}
                  >
                    {part}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <p
        style={{
          ...REVERT,
          position: "absolute",
          left: "50%",
          bottom: "6%",
          translate: "-50% 0",
          rotate: "-3deg",
          margin: 0,
          textAlign: "center",
          color: PALETTE.paper,
          whiteSpace: "nowrap",
        }}
      >
        <b
          style={{
            ...REVERT,
            display: "block",
            fontSize: unit(5),
            textShadow: `${unit(0.5)} ${unit(0.5)} 0 ${PALETTE.blood}`,
          }}
        >
          {props.request.label}
        </b>
        <span style={{ ...REVERT, fontSize: unit(2.6), fontWeight: 700 }}>
          下の仲間から選ぶ
        </span>
      </p>
      <button
        type="button"
        className="target-cancel"
        onClick={(event) => {
          event.stopPropagation()
          cancel()
        }}
        style={{
          ...BUTTON_BASE,
          position: "absolute",
          right: "4%",
          top: "6%",
          padding: "0.2em 0.9em",
          fontSize: unit(3.4),
          fontWeight: 800,
          color: PALETTE.ink,
          background: PALETTE.paper,
          clipPath: "polygon(6% 0, 100% 8%, 94% 100%, 0 90%)",
        }}
      >
        やめる
      </button>
    </motion.div>
  )
}
