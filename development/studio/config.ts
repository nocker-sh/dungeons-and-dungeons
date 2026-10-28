import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import { z } from "zod"

export const viewportPresets = [
  { name: "スマホ", width: 390, height: 844 },
  { name: "横長", width: 1280, height: 800 },
  { name: "縦長", width: 768, height: 1024 },
] as const

export const studioConfigSchema = z.strictObject({
  scene: z.string().min(1).default("battle"),
  seed: z.number().int().min(0).max(0xffffffff).default(1),
  width: z.number().int().min(240).max(2560).default(390),
  height: z.number().int().min(240).max(2560).default(844),
  duration: z.number().int().min(100).max(60000).default(6000),
  party: z
    .array(z.string().min(1))
    .length(PARTY_SLOTS)
    .default(["hero", "alda", "mort"]),
  foes: z
    .array(z.string().min(1))
    .min(1)
    .max(4)
    .default(["kamokutsu", "hiyokobu"]),
  hp: z
    .array(z.number().min(0).max(100))
    .length(PARTY_SLOTS)
    .default([100, 100, 100]),
  actions: z
    .array(
      z.strictObject({
        at: z.number().int().min(0).max(60000),
        label: z.string().min(1),
      })
    )
    .max(100)
    .default([]),
})

export type StudioConfig = z.infer<typeof studioConfigSchema>

export const defaultStudioConfig = studioConfigSchema.parse({})
