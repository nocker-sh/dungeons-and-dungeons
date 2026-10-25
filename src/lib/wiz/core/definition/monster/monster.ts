import { z } from "zod"
import { zWizContentMonsterDrop } from "@/lib/wiz/core/definition/monster/monster-drop"

export const zWizContentMonster = z.strictObject({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  hp: z.number().finite().positive(),
  attack: z.number().finite().nonnegative(),
  defense: z.number().finite().nonnegative(),
  agility: z.number().finite().nonnegative(),
  expReward: z.number().finite().nonnegative(),
  goldReward: z.number().finite().nonnegative(),
  drops: z.array(zWizContentMonsterDrop),
})

export type WizContentMonster = z.infer<typeof zWizContentMonster>
