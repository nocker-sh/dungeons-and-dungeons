import { WizStateQuest } from "@/lib/wiz/core/runtime/scenes/quest/state"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export function toQuestScene(vault: WizVaultValue): WizStateQuest {
  return new WizStateQuest({
    type: "quest",
    selectedQuest: null,
    message: null,
    vault,
  })
}
