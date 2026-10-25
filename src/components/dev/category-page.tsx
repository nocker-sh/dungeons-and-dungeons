import { ConversationsPage } from "./conversations-page"
import { useRouter } from "@void/react"
import { DevWorkspace } from "./workspace"
import type { DevDataCategory } from "@/lib/dev/categories"
import { EffectsPage } from "./effects"

export function DevCategoryPage({
  category,
  selectedSlug,
}: {
  category: string
  selectedSlug?: string
}) {
  const router = useRouter()
  const onEntryChange = (entry: string) => {
    void router.visit(`/dev/${category}/${entry}`)
  }
  if (category === "conversations")
    return (
      <ConversationsPage
        selectedSlug={selectedSlug}
        onEntryChange={onEntryChange}
      />
    )
  if (category === "effects")
    return (
      <EffectsPage selectedSlug={selectedSlug} onEntryChange={onEntryChange} />
    )
  return (
    <DevWorkspace
      category={category as DevDataCategory}
      selectedSlug={selectedSlug}
      onEntryChange={onEntryChange}
    />
  )
}
