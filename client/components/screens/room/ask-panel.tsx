import { useRef, useState } from "react"
import { COLOR } from "@/client/components/stage/kit"
import { SlantPanel } from "@/client/components/stage/slant-panel"
import type { PanelHandle } from "@/client/components/stage/slant-panel"
import { LeavingContext } from "@/client/components/stage/use-leaving"
import { Word } from "@/client/components/stage/word"
import { useWide } from "@/client/components/stage/use-wide"

/** 「〇〇たちが、まだ起きて話している……」 */
type Props = {
  onChat: () => void
  onSleep: () => void
}

export function AskPanel(props: Props) {
  const wide = useWide()
  const panel = useRef<PanelHandle>(null)
  const [closing, setClosing] = useState(false)
  const pick = (then: () => void) => async () => {
    setClosing(true)
    await panel.current?.close()
    then()
  }
  return (
    <LeavingContext.Provider value={closing}>
      <SlantPanel
        ref={panel}
        z={33}
        tone="#12101a"
        inset={{ top: "4%", bottom: "2%" }}
        rotate={-3}
      >
        <div
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            top: "30%",
            textAlign: "center",
            color: COLOR.paper,
            fontSize: "calc(var(--u)*4)",
            fontWeight: 900,
            rotate: "-3deg",
            textShadow: `0 0 8px ${COLOR.ink}`,
          }}
        >
          まだ起きている人の話し声が聞こえる……
        </div>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <Word
            text="雑談する"
            size={wide ? 13 : 12}
            paper
            big
            tilt={-4}
            rotate={-6}
            style={{
              pointerEvents: "auto",
              ...(wide
                ? { right: "8vw", bottom: "16%" }
                : { right: "3vw", bottom: "14%" }),
            }}
            onClick={pick(props.onChat)}
          />
          <Word
            text="寝る"
            size={8}
            big
            tilt={3}
            rotate={4}
            from="left"
            delay={90}
            style={{
              pointerEvents: "auto",
              ...(wide
                ? { left: "10vw", bottom: "18%" }
                : { left: "4vw", bottom: "30%" }),
            }}
            onClick={pick(props.onSleep)}
          />
        </div>
      </SlantPanel>
    </LeavingContext.Provider>
  )
}
