import { ConversationsPage } from "@/development/components/conversations-page"
import { useRouter } from "@void/react"
import { DevWorkspace } from "@/development/components/dev-workspace"
import type { DevDataCategory } from "@/development/categories"
import { EffectsPage } from "@/development/components/effects-page"

type Props = {
  category: string
  selectedSlug?: string
}

export function DevCategoryPage(props: Props) {
  const router = useRouter()
  const onEntryChange = (entry: string) => {
    void router.visit(`/${props.category}/${entry}`)
  }
  if (props.category === "conversations")
    return (
      <ConversationsPage
        selectedSlug={props.selectedSlug}
        onEntryChange={onEntryChange}
      />
    )
  if (props.category === "effects")
    return (
      <EffectsPage
        selectedSlug={props.selectedSlug}
        onEntryChange={onEntryChange}
      />
    )
  return (
    <DevWorkspace
      category={props.category as DevDataCategory}
      selectedSlug={props.selectedSlug}
      onEntryChange={onEntryChange}
    />
  )
}
