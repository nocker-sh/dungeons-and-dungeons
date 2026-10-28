import { object } from "@/scripts/concept-check/object"
import type { RecordValue } from "@/scripts/concept-check/object"

declare const Bun: {
  markdown: {
    render(
      source: string,
      callbacks: { heading: (title: string) => string; html: () => string }
    ): string
  }
}

function headingCounts(body: string): Map<string, number> {
  const counts = new Map<string, number>()
  Bun.markdown.render(body, {
    heading: (title) => {
      const name = title.trim()
      counts.set(name, (counts.get(name) ?? 0) + 1)
      return ""
    },
    html: () => "",
  })
  return counts
}

/** 本文を正とする生活文を複製せず、曖昧でない見出しへつなぐ。 */
export function verifySectionReferences(
  file: string,
  data: RecordValue,
  body: string,
  problems: string[]
): boolean {
  const references = ["livelihood", "handling", "ecology"].flatMap((field) => {
    const value = data[field]
    return object(value) && value.routine_section !== undefined
      ? [{ field, value }]
      : []
  })
  if (object(data.livelihood) && object(data.livelihood.lodging)) {
    references.push({
      field: "livelihood.lodging",
      value: data.livelihood.lodging,
    })
  }
  if (!references.length) return true
  const headings = headingCounts(body)
  let valid = true
  for (const { field, value } of references) {
    if (value.routine !== undefined) {
      problems.push(`${file}: ${field}のroutineとroutine_sectionを併記できない`)
      valid = false
    }
    const section = value.routine_section
    if (
      typeof section !== "string" ||
      !section.trim() ||
      headings.get(section) !== 1
    ) {
      problems.push(
        `${file}: ${field}.routine_sectionの見出しが一意に存在しない ${String(section)}`
      )
      valid = false
    }
  }
  return valid
}
