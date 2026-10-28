import { tuning } from "@/content/looks/data"

/** 役目（guide・guild・secret）から、その役の人の id。 */
export function personFor(role: string) {
  return tuning.people[role] ?? role
}
