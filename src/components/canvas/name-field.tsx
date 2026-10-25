import { useRef, useState, type CSSProperties } from "react"
import { BUTTON_BASE, PALETTE, REVERT, unit } from "@/components/canvas/tokens"

/**
 * 名前を入れる欄。Canvas の中で使うので CSS ファイルは使わず style 属性で書く。
 * スマホの仮想キーボードでも使えるようにふつうの `<input>` を置き、
 * 日本語の変換中に Enter で決まらないよう、変換中は Enter を無視する（決定はボタン）。
 */
export function NameField({
  value,
  onChange,
  onSubmit,
  maxLength,
  label,
  placeholder,
  normalize,
  style,
}: {
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
}) {
  const composing = useRef(false)
  const [focused, setFocused] = useState(false)
  const left = maxLength - Array.from(value).length
  return (
    <div
      style={{
        ...REVERT,
        display: "block",
        pointerEvents: "auto",
        ...style,
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
        {label}
        <input
          value={value}
          // 変換中も打った文字をそのまま見せる（変換の途中を消さない）
          onChange={(event) => {
            const typed = event.target.value
            const settled =
              !composing.current &&
              !(event.nativeEvent as InputEvent).isComposing
            onChange(settled && normalize ? normalize(typed) : typed)
          }}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={(event) => {
            composing.current = false
            if (normalize) onChange(normalize(event.currentTarget.value))
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            // 変換中の Enter は変換の確定。名前の決定にはしない
            if (composing.current || event.nativeEvent.isComposing) return
            event.preventDefault()
            onSubmit?.()
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          type="text"
          inputMode="text"
          enterKeyHint="done"
          autoComplete="off"
          maxLength={maxLength}
          placeholder={placeholder}
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
        あと{Math.max(0, left)}文字（{maxLength}文字まで）
      </div>
    </div>
  )
}

/** 名前の欄に添える小さなボタン（「おまかせ」など）。 */
export function NameFieldButton({
  label,
  onClick,
  style,
}: {
  label: string
  onClick: () => void
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        ...BUTTON_BASE,
        padding: `${unit(0.5)} ${unit(1.6)}`,
        fontSize: unit(2.6),
        fontWeight: 800,
        color: PALETTE.paper,
        boxShadow: `inset 0 0 0 ${unit(0.35)} ${PALETTE.paper}`,
        clipPath: "polygon(5% 0, 100% 7%, 95% 100%, 0 92%)",
        ...style,
      }}
    >
      {label}
    </button>
  )
}
