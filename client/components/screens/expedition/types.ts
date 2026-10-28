import type { Game } from "@/lib/wiz/game/game"

export type RouteView = NonNullable<ReturnType<Game["queries"]["route"]>>
