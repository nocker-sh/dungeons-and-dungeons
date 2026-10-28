import { z } from "zod"
import { zWizContentDialogueDefinition } from "@/lib/wiz/core/definition/npc/dialogue"

const addDuplicateIdIssues = (
  ids: readonly string[],
  path: "likes" | "dislikes",
  context: z.RefinementCtx,
): void => {
  const firstIndexById = new Map<string, number>()
  ids.forEach((id, index) => {
    const firstIndex = firstIndexById.get(id)
    if (firstIndex === undefined) {
      firstIndexById.set(id, index)
      return
    }
    context.addIssue({
      code: "custom",
      path: [path, index],
      message: `duplicate ID; first declared at index ${firstIndex}`,
    })
  })
}

export const addWizContentNpcGiftPreferenceIssues = (
  npc: Readonly<{
    likes: readonly string[]
    dislikes: readonly string[]
  }>,
  context: z.RefinementCtx,
): void => {
  addDuplicateIdIssues(npc.likes, "likes", context)
  addDuplicateIdIssues(npc.dislikes, "dislikes", context)

  const dislikedItemIds = new Set(npc.dislikes)
  npc.likes.forEach((itemId, index) => {
    if (!dislikedItemIds.has(itemId)) return
    context.addIssue({
      code: "custom",
      path: ["likes", index],
      message: "an item cannot be both liked and disliked",
    })
  })
}

export const zWizContentNpc = z
  .strictObject({
    id: z.string(),
    name: z.string(),
    occupation: z.string(),
    personality: z.string(),
    /**
     * 値域は利用するpresetが決める。content schemaは特定RPGの0..100へ固定しない。
     */
    initialAffinity: z.number().finite(),
    likes: z.array(z.string()),
    dislikes: z.array(z.string()),
    /** 好物の正規affinity bonus。省略時はpreset既定値を使う。 */
    likeBonus: z.number().finite().optional(),
    /** 苦手な品の正規affinity bonus。省略時はpreset既定値を使う。 */
    dislikeBonus: z.number().finite().optional(),
    /** その他の品の正規affinity bonus。省略時はpreset既定値を使う。 */
    neutralBonus: z.number().finite().optional(),
    dialogues: z.array(zWizContentDialogueDefinition),
  })
  .superRefine(addWizContentNpcGiftPreferenceIssues)

export type WizContentNpc = z.infer<typeof zWizContentNpc>
