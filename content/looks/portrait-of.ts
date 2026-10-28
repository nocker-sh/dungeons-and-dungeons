import type { Portraits } from "@/content/looks/types"
import { personOf } from "@/content/looks/person-of"

/** 絵がまだない者の仮の影絵。 */
export const PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><path d="M100 28 L128 40 L136 78 L122 108 L160 124 L184 300 L16 300 L40 124 L78 108 L64 78 L72 40Z" fill="#1b2030" stroke="#eeebe3" stroke-width="5" stroke-linejoin="miter"/><path d="M80 70 L96 76 L82 80Z M120 70 L104 76 L118 80Z" fill="#eeebe3"/></svg>`
)}`

/** 立ち絵。表情がなければ通常。 */
export function portraitOf(
  id: string,
  state: keyof Portraits = "normal"
): string {
  const person = personOf(id)
  return (
    (state === "skill"
      ? person?.bustPortraits?.normal
      : (person?.bustPortraits?.[state] ?? person?.bustPortraits?.normal)) ??
    person?.portraits?.[state] ??
    person?.portraits?.normal ??
    person?.image ??
    PLACEHOLDER
  )
}
