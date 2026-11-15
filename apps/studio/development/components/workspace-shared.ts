import type { DevDataCategory } from "@/development/categories"

export type Props = {
  category: DevDataCategory
  selectedSlug?: string
  onEntryChange: (slug: string) => void
}
