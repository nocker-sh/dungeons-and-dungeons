import { ConversationsPage } from "@/client/components/dev/conversations-page"
import { useRouter } from "@void/react"
import { DevWorkspace } from "@/client/components/dev/dev-workspace"
import type { DevDataCategory } from "@/development/categories"
import { EffectsPage } from "@/client/components/dev/effects-page"

type Props = {
  category: string
  selectedSlug?: string
}

export function DevCategoryPage(props: Props) {
  const router = useRouter()
  const onEntryChange = (entry: string) => {
    void router.visit(`/dev/${props.category}/${entry}`)
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
