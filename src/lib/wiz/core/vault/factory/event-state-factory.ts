import { z } from "zod"
import { type WizContentEvent, zWizContentEvent } from "@/lib/wiz/core/definition/event/event"
import {
  createWizImmutableRecord,
  getWizImmutableRecordValue,
} from "@/lib/wiz/core/immutable-record"
import { WizVaultMissingDefinitionError } from "@/lib/wiz/core/vault/factory/missing-definition-error"
import { ownWizVaultFactoryValue } from "@/lib/wiz/core/vault/factory/ownership"
import type { WizVaultEventState } from "@/lib/wiz/core/vault/states/event/schema"

/** 外部入力の期待形状: WizContentEvent[]。unknown を zod で実行時検証する。 */
type Properties = {
  readonly defs: unknown
}

export class WizVaultEventStateFactory {
  private readonly events: Readonly<Record<string, WizVaultEventState>>

  constructor(properties: Properties) {
    const parsed = z.array(zWizContentEvent).parse(properties.defs)
    this.events = createWizImmutableRecord(
      parsed.map((def) => {
        const event = ownWizVaultFactoryValue(this.fromDef(def))
        return [event.id, event] as const
      }),
    )
    Object.freeze(this)
  }

  private fromDef(def: WizContentEvent): WizVaultEventState {
    return {
      id: def.id,
      description: def.description,
      choices: def.choices,
    }
  }

  get(id: string): WizVaultEventState | undefined {
    return getWizImmutableRecordValue(this.events, id)
  }

  getAll(): Readonly<Record<string, WizVaultEventState>> {
    return this.events
  }

  getMany(ids: readonly string[]): readonly WizVaultEventState[] {
    const events = ids.map((id) => this.get(id))
    const missingIds = ids.filter((_, index) => events[index] === undefined)
    if (missingIds.length > 0) {
      throw new WizVaultMissingDefinitionError("event", missingIds)
    }
    return ownWizVaultFactoryValue(
      events.filter((event): event is WizVaultEventState => event !== undefined),
    )
  }
}
