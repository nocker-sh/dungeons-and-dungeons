import { describe, expect, test } from "vite-plus/test"
import { WizEngineFacilityUnlockService } from "@/lib/wiz/core/engine/facility/wiz-engine-facility-unlock-service"
import type { WizEngineFacilityUnlockCondition } from "@/lib/wiz/core/engine/facility/wiz-engine-facility-unlock-service"

describe("WizEngineFacilityUnlockService", () => {
  const conditions: readonly WizEngineFacilityUnlockCondition[] = [
    { facilityId: "blacksmith", type: "area_progress", areaId: "road", requiredProgress: 50 },
    { facilityId: "alchemy", type: "area_progress", areaId: "forest", requiredProgress: 50 },
    { facilityId: "church", type: "quest", questId: "church_aid" },
  ]
  const service = new WizEngineFacilityUnlockService(conditions)

  test("エリア進捗が条件を満たすと施設が解放される", () => {
    const areas = [{ id: "road", progress: 50 }]
    const quests: readonly { id: string; completed: boolean }[] = []
    const alreadyUnlocked: readonly string[] = []
    const result = service.getNewlyUnlocked(areas, quests, alreadyUnlocked)
    expect(result).toEqual(["blacksmith"])
  })

  test("クエスト完了で施設が解放される", () => {
    const areas: readonly { id: string; progress: number }[] = []
    const quests = [{ id: "church_aid", completed: true }]
    const alreadyUnlocked: readonly string[] = []
    const result = service.getNewlyUnlocked(areas, quests, alreadyUnlocked)
    expect(result).toEqual(["church"])
  })

  test("既に解放済みなら重複しない", () => {
    const areas = [{ id: "road", progress: 50 }]
    const quests: readonly { id: string; completed: boolean }[] = []
    const alreadyUnlocked = ["blacksmith"]
    const result = service.getNewlyUnlocked(areas, quests, alreadyUnlocked)
    expect(result).toEqual([])
  })

  test("条件未達なら解放されない", () => {
    const areas = [{ id: "road", progress: 30 }]
    const quests: readonly { id: string; completed: boolean }[] = []
    const alreadyUnlocked: readonly string[] = []
    const result = service.getNewlyUnlocked(areas, quests, alreadyUnlocked)
    expect(result).toEqual([])
  })

  test("カスタム条件タイプを predicate で評価できる", () => {
    const customConditions: readonly WizEngineFacilityUnlockCondition[] = [
      {
        facilityId: "shrine",
        type: "all_areas_visited",
        predicate: (ctx) => ctx.areas.every((a) => a.progress > 0),
      },
    ]
    const customService = new WizEngineFacilityUnlockService(customConditions)

    const areasNotAllVisited = [
      { id: "a", progress: 10 },
      { id: "b", progress: 0 },
    ]
    expect(customService.getNewlyUnlocked(areasNotAllVisited, [], [])).toEqual([])

    const areasAllVisited = [
      { id: "a", progress: 10 },
      { id: "b", progress: 5 },
    ]
    expect(customService.getNewlyUnlocked(areasAllVisited, [], [])).toEqual(["shrine"])
  })

  test("入力条件を所有し、結果とpredicate contextをimmutableにする", () => {
    const condition = {
      facilityId: "forge",
      type: "area_progress" as const,
      areaId: "mine",
      requiredProgress: 10,
    }
    const source: WizEngineFacilityUnlockCondition[] = [condition]
    const ownedService = new WizEngineFacilityUnlockService(source)
    condition.requiredProgress = 99
    source.splice(0)

    const result = ownedService.getNewlyUnlocked([{ id: "mine", progress: 10 }], [], [])

    expect(result).toEqual(["forge"])
    expect(Object.isFrozen(result)).toBe(true)

    let contextWasFrozen = false
    const customService = new WizEngineFacilityUnlockService([
      {
        facilityId: "archive",
        type: "immutable_context",
        predicate: (context) => {
          contextWasFrozen =
            Object.isFrozen(context) &&
            Object.isFrozen(context.areas) &&
            Object.isFrozen(context.areas[0])
          return true
        },
      },
    ])

    customService.getNewlyUnlocked([{ id: "library", progress: 1 }], [], [])
    expect(contextWasFrozen).toBe(true)
  })
})
