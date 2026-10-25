export const WIZ_STANDARD_BUILT_IN_SCENE_TYPES = Object.freeze([
  "village",
  "shop",
  "inn",
  "exploration",
  "battle",
  "conversation",
  "crafting",
  "quest",
  "level_up",
] as const)

export type WizStandardBuiltInSceneType = (typeof WIZ_STANDARD_BUILT_IN_SCENE_TYPES)[number]

/**
 * standard runtimeが予約するscene名の唯一のauthority。
 */
export class WizStandardSceneName {
  private constructor() {
    throw new TypeError("WizStandardSceneName is a static-only validator")
  }

  static isBuiltIn(type: string): type is WizStandardBuiltInSceneType {
    return (WIZ_STANDARD_BUILT_IN_SCENE_TYPES as readonly string[]).includes(type)
  }

  static assertPlugin(type: string): void {
    if (type.trim().length === 0 || type !== type.trim()) {
      throw new RangeError(
        "Plugin scene type must not be empty or have leading/trailing whitespace",
      )
    }
    if (WizStandardSceneName.isBuiltIn(type)) {
      throw new RangeError(`Plugin scene type "${type}" is reserved by standard runtime`)
    }
  }
}

Object.freeze(WizStandardSceneName.prototype)
Object.freeze(WizStandardSceneName)
