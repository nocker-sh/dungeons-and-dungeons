import { z } from "zod"
import type {
  WizContentDialogue,
  WizContentDialogueDefinition,
  WizContentDialogueInput,
  WizContentDialogueLine,
  WizContentDialogueTriggers,
} from "@/lib/wiz/core/definition/npc/dialogue"
import {
  type WizContentNpc,
  zWizContentNpc,
} from "@/lib/wiz/core/definition/npc/npc"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { ownWizVaultFactoryValue } from "@/lib/wiz/core/vault/factory/ownership"
import type { WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"

/** 外部入力の期待形状: WizContentNpc[]。unknown を zod で実行時検証する。 */
type Properties = {
  readonly defs: unknown
}

export class WizVaultNpcStateFactory {
  private readonly npcs: readonly WizDeepReadonly<WizVaultNpc>[]

  constructor(properties: Properties) {
    const parsed = z.array(zWizContentNpc).parse(properties.defs)
    this.npcs = ownWizVaultFactoryValue(parsed.map((def) => this.fromDef(def)))
    Object.freeze(this)
  }

  private fromDef(def: WizContentNpc): WizVaultNpc {
    return {
      id: def.id,
      name: def.name,
      occupation: def.occupation,
      personality: def.personality,
      affinity: def.initialAffinity,
      dialogues: def.dialogues.map((d) => this.convertDialogue(d, def.name)),
      giftPreferences: {
        likes: def.likes,
        dislikes: def.dislikes,
        ...(def.likeBonus === undefined ? {} : { likeBonus: def.likeBonus }),
        ...(def.dislikeBonus === undefined
          ? {}
          : { dislikeBonus: def.dislikeBonus }),
        ...(def.neutralBonus === undefined
          ? {}
          : { neutralBonus: def.neutralBonus }),
      },
    }
  }

  private convertDialogue(
    input: WizContentDialogueDefinition,
    speakerName: string
  ): WizContentDialogue {
    if (!this.isShorthand(input)) {
      return input
    }

    const lines: WizContentDialogueLine[] = input.lines.map((text) => ({
      speaker: speakerName,
      text,
    }))

    const triggers = this.convertTriggers(input)

    return {
      id: input.id,
      minAffinity: input.minAffinity,
      maxAffinity: input.maxAffinity,
      lines,
      triggers,
    }
  }

  private isShorthand(
    input: WizContentDialogueDefinition
  ): input is WizContentDialogueInput {
    return (
      input.lines.some((line) => typeof line === "string") ||
      "timeOfDay" in input ||
      "weather" in input ||
      "season" in input ||
      "afterQuest" in input
    )
  }

  private convertTriggers(
    input: WizContentDialogueInput
  ): WizContentDialogueTriggers | undefined {
    if (
      !input.timeOfDay &&
      !input.weather &&
      !input.season &&
      !input.afterQuest
    ) {
      return undefined
    }

    return {
      timeOfDay: input.timeOfDay,
      weather: input.weather,
      season: input.season,
      afterQuest: input.afterQuest,
    }
  }

  getAll(): readonly WizDeepReadonly<WizVaultNpc>[] {
    return this.npcs
  }
}
