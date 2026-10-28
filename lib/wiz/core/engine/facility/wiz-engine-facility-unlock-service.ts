/**
 * 施設解放の判定 context。プラグイン条件タイプから参照される。
 */
export type WizEngineFacilityUnlockContext = {
  readonly areas: readonly { id: string; progress: number }[]
  readonly quests: readonly { id: string; completed: boolean }[]
  readonly alreadyUnlocked: readonly string[]
}

/**
 * 組み込みの施設解放条件。
 */
export type WizEngineFacilityBuiltInCondition =
  | {
      readonly facilityId: string
      readonly type: "area_progress"
      readonly areaId: string
      readonly requiredProgress: number
    }
  | {
      readonly facilityId: string
      readonly type: "quest"
      readonly questId: string
    }

/**
 * プラグイン条件用のカスタム述語。
 *
 * `type` を任意の文字列にし、`predicate` で解放判定ロジックを定義する。
 *
 * ```ts
 * const condition: WizEngineFacilityCustomCondition = {
 *   facilityId: "shrine",
 *   type: "all_areas_visited",
 *   predicate: (ctx) => ctx.areas.every((a) => a.progress > 0),
 * }
 * ```
 */
export type WizEngineFacilityCustomCondition = {
  readonly facilityId: string
  readonly type: string
  readonly predicate: (context: WizEngineFacilityUnlockContext) => boolean
}

export type WizEngineFacilityUnlockCondition =
  | WizEngineFacilityBuiltInCondition
  | WizEngineFacilityCustomCondition

const isBuiltInCondition = (
  condition: WizEngineFacilityUnlockCondition,
): condition is WizEngineFacilityBuiltInCondition =>
  condition.type === "area_progress" || condition.type === "quest"

export class WizEngineFacilityUnlockService {
  private readonly conditions: readonly WizEngineFacilityUnlockCondition[]

  constructor(conditions: readonly WizEngineFacilityUnlockCondition[]) {
    this.conditions = immutableConfig(conditions)
    Object.freeze(this)
  }

  getNewlyUnlocked(
    areas: readonly { id: string; progress: number }[],
    quests: readonly { id: string; completed: boolean }[],
    alreadyUnlocked: readonly string[],
  ): readonly string[] {
    const result: string[] = []
    const context: WizEngineFacilityUnlockContext = immutableConfig({
      areas,
      quests,
      alreadyUnlocked,
    })

    for (const condition of this.conditions) {
      if (alreadyUnlocked.includes(condition.facilityId)) continue
      if (isBuiltInCondition(condition)) {
        if (this.evaluateBuiltIn(condition, context)) {
          result.push(condition.facilityId)
        }
        continue
      }
      if (condition.predicate(context)) {
        result.push(condition.facilityId)
      }
    }
    return Object.freeze(result)
  }

  private evaluateBuiltIn(
    condition: WizEngineFacilityBuiltInCondition,
    context: WizEngineFacilityUnlockContext,
  ): boolean {
    if (condition.type === "area_progress") {
      const area = context.areas.find((a) => a.id === condition.areaId)
      return area !== undefined && area.progress >= condition.requiredProgress
    }
    const quest = context.quests.find((q) => q.id === condition.questId)
    return quest !== undefined && quest.completed
  }
}
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
