import type { Game } from "@/lib/wiz"

export type RouteView = NonNullable<ReturnType<Game["queries"]["route"]>>
