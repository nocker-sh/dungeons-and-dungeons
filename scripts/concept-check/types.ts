import type { RecordValue } from "@/scripts/concept-check/object"

export type ConceptDocuments = Map<string, { file: string; data: RecordValue }>

export type ReferenceLookup = (
  file: string,
  target: unknown,
  field: string
) => RecordValue | undefined
