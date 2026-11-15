import { z } from "zod"

export const framePresentationSchema = z.object({
  mode: z.enum(["view", "play"]).optional(),
  at: z.coerce.number().int().min(0).max(60000).default(0),
  guides: z.enum(["0", "1"]).default("0"),
})
