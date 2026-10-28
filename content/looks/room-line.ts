import { lines } from "@/content/looks/data"

export function roomLine(id: string) {
  return lines.rooms[id] ?? ""
}
