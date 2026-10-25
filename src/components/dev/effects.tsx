import { useState, type CSSProperties } from "react"
import { useReducedMotion } from "motion/react"
import { Play, Square } from "lucide-react"
import { ComicEffect, comicEffects } from "@/components/canvas/comic-effect"
import { CanvasBox } from "@/components/canvas/primitives"
import { PALETTE } from "@/components/canvas/tokens"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DevDataLayout } from "./data-layout"

const backgrounds = [
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

function EffectDetails({ effect }: { effect: (typeof comicEffects)[number] }) {
  const [background, setBackground] = useState(backgrounds[0])
  const [playing, setPlaying] = useState(false)
  const [text, setText] = useState(effect.sound)
  const reducedMotion = useReducedMotion() === true
  const animated = playing && !reducedMotion
  return (
    <article>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>{effect.name}</h1>
        <p>{effect.description}</p>
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
            aria-label={`${animated ? "Stop" : "Play"} ${effect.name}`}
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
                  data-effect-preview={effect.id}
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
                    effect={effect}
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

export function EffectsPage({
  selectedSlug,
  onEntryChange,
}: {
  selectedSlug?: string
  onEntryChange: (slug: string) => void
}) {
  const selected =
    comicEffects.find((effect) => effect.id === selectedSlug) ?? comicEffects[0]
  return (
    <DevDataLayout
      category="effects"
      sections={Array.from(
        new Set(comicEffects.map((effect) => effect.group))
      ).map((group) => ({
        label: group,
        entries: comicEffects
          .filter((effect) => effect.group === group)
          .map((effect) => ({
            ...effect,
            slug: effect.id,
          })),
      }))}
      activeId={selected.id}
      onEntryChange={onEntryChange}
    >
      <EffectDetails key={selected.id} effect={selected} />
    </DevDataLayout>
  )
}
