import { z } from "zod"

const identities = z.object({
  snapshot: z.object({
    gear: z.array(z.object({ id: z.string() })),
    phase: z.object({
      battle: z
        .object({
          foes: z.array(z.object({ appearanceId: z.string().optional() })),
        })
        .optional(),
    }),
  }),
})

/** Reserve identities before restoration can settle a battle; the real codec still validates the save. */
export function savedSessionIds(value: unknown): ReadonlySet<string> {
  const parsed = identities.safeParse(value)
  if (!parsed.success) return new Set()
  const snapshot = parsed.data.snapshot
  return new Set([
    ...snapshot.gear.map((gear) => gear.id),
    ...(snapshot.phase.battle?.foes.flatMap((foe) =>
      foe.appearanceId === undefined ? [] : [foe.appearanceId]
    ) ?? []),
  ])
}
