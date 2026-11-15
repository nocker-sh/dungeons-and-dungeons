import { comicEffects } from "@/client/components/canvas/comic-effect"
import { DevDataLayout } from "@/development/components/dev-data-layout"
import { EffectDetails } from "@/development/components/effect-details"

type Props = {
  selectedSlug?: string
  onEntryChange: (slug: string) => void
}

export function EffectsPage(props: Props) {
  const selected =
    comicEffects.find((effect) => effect.id === props.selectedSlug) ??
    comicEffects[0]
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
      onEntryChange={props.onEntryChange}
    >
      <EffectDetails key={selected.id} effect={selected} />
    </DevDataLayout>
  )
}
