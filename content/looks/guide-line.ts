import { lines } from "@/content/looks/data"

/** 案内人などの決まり文句。{names} を差し替える。 */
export function guideLine(key: string, names: string[] = []) {
  return (lines.guide[key] ?? "").replace("{names}", names.join("と"))
}
