import { conceptEntries } from "@/concept/database"

export const nameOf = (id: string) =>
  conceptEntries.find((entry) => entry.id === id)?.name ?? id
