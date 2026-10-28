import { useState } from "react"
import type { CSSProperties } from "react"
import { useReducedMotion } from "motion/react"
import { Play, Square } from "lucide-react"
import {
  ComicEffect,
  comicEffects,
} from "@/client/components/canvas/comic-effect"
import { CanvasBox } from "@/client/components/canvas/canvas-box"
import { PALETTE } from "@/client/components/canvas/tokens"
import { Button } from "@/client/components/ui/button"
import { Card } from "@/client/components/ui/card"
import { Input } from "@/client/components/ui/input"

export const backgrounds = [
  { id: "paper", name: "Light", style: { background: PALETTE.paper } },
  { id: "night", name: "Dark", style: { background: PALETTE.deep } },
  {
    id: "transparent",
    name: "Transparent",
    style: {
      backgroundColor: "#f5f5f5",
      backgroundImage:
        "conic-gradient(#ddd 25%, transparent 0 50%, #ddd 0 75%, transparent 0)",
      backgroundSize: "24px 24px",
    },
  },
] satisfies { id: string; name: string; style: CSSProperties }[]

type Props = { effect: (typeof comicEffects)[number] }

export function EffectDetails(props: Props) {
  const [background, setBackground] = useState(backgrounds[0])
  const [playing, setPlaying] = useState(false)
  const [text, setText] = useState(props.effect.sound)
  const reducedMotion = useReducedMotion() === true
  const animated = playing && !reducedMotion
  return (
    <article>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>{props.effect.name}</h1>
        <p>{props.effect.description}</p>
      </header>
      <div style={{ display: "grid", gap: 24 }}>
        <label style={{ display: "grid", gap: 8, maxWidth: 320 }}>
          Text
          <Input
            value={text}
            maxLength={16}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button
            variant="outline"
            disabled={reducedMotion}
            aria-label={`${animated ? "Stop" : "Play"} ${props.effect.name}`}
            onClick={() => setPlaying(!playing)}
          >
            {animated ? <Square /> : <Play />}
            {animated ? "Stop" : "Play"}
          </Button>
          <div
            role="group"
            aria-label="Preview background"
            className="flex flex-wrap gap-2"
          >
            {backgrounds.map((entry) => (
              <Button
                key={entry.id}
                variant={background.id === entry.id ? "secondary" : "outline"}
                aria-pressed={background.id === entry.id}
                onClick={() => setBackground(entry)}
              >
                {entry.name}
              </Button>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: 24,
            alignItems: "start",
          }}
        >
          {[
            { label: "Base", text: "" },
            { label: "With text", text },
          ].map((preview) => (
            <figure key={preview.label}>
              <Card className="p-0">
                <CanvasBox
                  data-effect-preview={props.effect.id}
                  data-preview-label={preview.label}
                  data-playing={animated}
                  style={{
                    ...background.style,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    aspectRatio: "1",
                    overflow: "hidden",
                  }}
                >
                  <ComicEffect
                    effect={props.effect}
                    text={preview.text}
                    still={!animated}
                    repeat
                  />
                </CanvasBox>
              </Card>
              <figcaption>{preview.label}</figcaption>
            </figure>
          ))}
        </div>
        {reducedMotion && (
          <p className="text-sm text-muted-foreground">
            Showing a still image because "Reduce motion" is on.
          </p>
        )}
      </div>
    </article>
  )
}
