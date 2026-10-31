import { z } from "zod"

const integer = z
  .string()
  .regex(/^\d+$/, "整数で指定してください")
  .transform(Number)
const slugs = z
  .string()
  .min(1)
  .transform((value) => value.split(","))

export const previewQuerySchema = z.strictObject({
  scene: z.string().min(1).optional(),
  seed: integer.optional(),
  width: integer.optional(),
  height: integer.optional(),
  duration: integer.optional(),
  party: slugs.optional(),
  foes: slugs.optional(),
  hp: z
    .string()
    .regex(/^\d+(?:\.\d+)?(?:,\d+(?:\.\d+)?)*$/)
    .transform((value) => value.split(",").map(Number))
    .optional(),
  actions: z.string().min(1).optional(),
  at: integer.pipe(z.number().max(60000)).optional(),
  guides: z.enum(["0", "1"]).optional(),
})
