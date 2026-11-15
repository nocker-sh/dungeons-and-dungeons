import { useRef, useState } from "react"
import type { CSSProperties } from "react"
import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"

/**
 * 名前を入れる欄。Canvas の中で使うので CSS ファイルは使わず style 属性で書く。
 * スマホの仮想キーボードでも使えるようにふつうの `<input>` を置き、
 * 日本語の変換中に Enter で決まらないよう、変換中は Enter を無視する（決定はボタン）。
 */
type Props = {
  value: string
  onChange: (value: string) => void
  /** 変換を終えた文字を整える（ひらがなをカタカナへ寄せるなど）。変換中は触らない。 */
  normalize?: (value: string) => string
  /** 変換中でない Enter。決定と同じ扱いにする。 */
  onSubmit?: () => void
  maxLength: number
  label: string
  placeholder?: string
  style?: CSSProperties
}

export function NameField(props: Props) {
  const composing = useRef(false)
  const [focused, setFocused] = useState(false)
  const left = props.maxLength - Array.from(props.value).length
  return (
    <div
      style={{
        ...REVERT,
        display: "block",
        pointerEvents: "auto",
        ...props.style,
      }}
    >
      <label
        style={{
          ...REVERT,
          display: "block",
          fontSize: unit(2.4),
          letterSpacing: ".3em",
          color: PALETTE.sage,
          marginBottom: unit(0.8),
        }}
      >
        {props.label}
        <input
          value={props.value}
          // 変換中も打った文字をそのまま見せる（変換の途中を消さない）
          onChange={(event) => {
            const typed = event.target.value
            const settled =
              !composing.current &&
              !(event.nativeEvent as InputEvent).isComposing
            props.onChange(
              settled && props.normalize ? props.normalize(typed) : typed
            )
          }}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={(event) => {
            composing.current = false
            if (props.normalize)
              props.onChange(props.normalize(event.currentTarget.value))
          }}
          onKeyDown={(event) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return
            if (event.key !== "Enter") return
            // 変換中の Enter は変換の確定。名前の決定にはしない
            // compositionendがkeydownより先に来るIMEでは、isComposingがfalseでも229が残る。
            if (
              composing.current ||
              event.nativeEvent.isComposing ||
              event.nativeEvent.keyCode === 229
            )
              return
            event.preventDefault()
            props.onSubmit?.()
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          type="text"
          inputMode="text"
          enterKeyHint="done"
          autoComplete="off"
          maxLength={props.maxLength}
          placeholder={props.placeholder}
          style={{
            ...REVERT,
            display: "block",
            width: "100%",
            marginTop: unit(1),
            padding: `${unit(1.2)} ${unit(1.6)}`,
            border: 0,
            outline: 0,
            borderRadius: 0,
            background: PALETTE.paper,
            color: PALETTE.ink,
            fontFamily: "inherit",
            fontSize: unit(6),
            lineHeight: 1.2,
            letterSpacing: ".08em",
            boxShadow: `inset 0 0 0 ${unit(0.5)} ${focused ? PALETTE.blood : PALETTE.ink}`,
            clipPath: "polygon(0.6% 6%, 100% 0, 99.4% 96%, 0 100%)",
          }}
        />
      </label>
      <div
        style={{
          ...REVERT,
          display: "block",
          marginTop: unit(0.8),
          fontSize: unit(2.2),
          color: left < 0 ? PALETTE.blood : PALETTE.stone,
        }}
      >
        あと{Math.max(0, left)}文字（{props.maxLength}文字まで）
      </div>
    </div>
  )
}
