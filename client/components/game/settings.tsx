import { useRef, useState } from "react"
import { unit } from "@/client/components/canvas/tokens"
import { Word } from "@/client/components/stage/word"
import { useWide } from "@/client/components/stage/use-wide"
import { StageChrome } from "@/client/components/stage/stage-chrome"
import { SettingsPanel } from "@/client/components/game/settings-panel"

/** 街の右上の「設定」と、開いたときの板。 */
type Props = { onOpen?: () => void }

export function Settings(props: Props) {
  const wide = useWide()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <StageChrome>
      <Word
        text="設定"
        buttonRef={trigger}
        size={wide ? 4 : 4.6}
        tilt={2}
        rotate={4}
        from="right"
        delay={300}
        style={{
          position: "absolute",
          top: unit(1.2),
          right: wide ? "4vmin" : "3%",
        }}
        onClick={() => {
          props.onOpen?.()
          setOpen(true)
        }}
      />
      {open ? (
        <SettingsPanel onClose={() => setOpen(false)} trigger={trigger} />
      ) : null}
    </StageChrome>
  )
}
