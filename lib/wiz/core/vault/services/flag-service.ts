import type { WizFlags } from "@/lib/wiz/core/types"

export class WizVaultFlagService {
  constructor() {
    Object.freeze(this)
  }

  addFlag(flags: WizFlags, flag: string): WizFlags {
    if (flags.includes(flag)) return flags
    return Object.freeze([...flags, flag])
  }

  removeFlag(flags: WizFlags, flag: string): WizFlags {
    return Object.freeze(flags.filter((f) => f !== flag))
  }

  hasFlag(flags: WizFlags, flag: string): boolean {
    return flags.includes(flag)
  }

  hasAllFlags(flags: WizFlags, required: WizFlags): boolean {
    return required.every((flag) => flags.includes(flag))
  }
}
