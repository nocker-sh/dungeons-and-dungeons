import { expect, test } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { toVillageScene } from "@/lib/wiz/core/runtime/scene-transitions"
import { WizRuntimeAreaUnlockService } from "@/lib/wiz/core/runtime/services/area-unlock-service"
import type { WizVaultAreaState } from "@/lib/wiz/core/vault/states/area/schema"

const service = new WizRuntimeAreaUnlockService()

test("checkAndUnlock はアンロック条件を満たさないエリアをアンロックしない", () => {
  const scene = toVillageScene(MOCK_VAULT)

  const result = service.checkAndUnlock(scene)

  expect(result.unlockedAreas).toHaveLength(0)
})

test("checkAndUnlock はアンロック条件を満たすエリアをアンロックする", () => {
  // forest エリアの進捗を上げる
  const vaultWithProgress = MOCK_VAULT.updateArea("forest", (a) => ({
    ...a,
    progress: 100,
  }))
  const scene = toVillageScene(vaultWithProgress)

  const result = service.checkAndUnlock(scene)

  // cave が unlocked になるはず (forest の進捗が条件)
  const caveUnlocked = result.state.vault.areas.find((a) => a.id === "cave")
  if (caveUnlocked && caveUnlocked.unlockCondition?.areaId === "forest") {
    expect(result.unlockedAreas).toContain("cave")
    expect(caveUnlocked.unlocked).toBe(true)
  }
})

test("checkAndUnlock は既にアンロック済みのエリアはスキップする", () => {
  // 全エリアをアンロック済みにする
  let vault = MOCK_VAULT
  for (const area of vault.areas) {
    vault = vault.updateArea(area.id, (a) => ({ ...a, unlocked: true }))
  }
  const scene = toVillageScene(vault)

  const result = service.checkAndUnlock(scene)

  expect(result.unlockedAreas).toHaveLength(0)
})

test("checkAndUnlock は unlockCondition がないエリアはスキップする", () => {
  // unlockCondition なしのエリアを作成
  const mockAreas: WizVaultAreaState[] = [
    {
      id: "starting",
      name: "開始地点",
      description: "スタート地点",
      dangerLevel: 1,
      apCost: 1,
      progress: 0,
      unlocked: false,
      unlockCondition: undefined,
      availableGathering: [],
      monsters: [],
      events: [],
    },
  ]
  const vault = MOCK_VAULT.withAreas(mockAreas)
  const scene = toVillageScene(vault)

  const result = service.checkAndUnlock(scene)

  expect(result.unlockedAreas).toHaveLength(0)
})

test("checkAndUnlockWithLog はログを追加する", () => {
  // forest の進捗を上げて cave をアンロックできるようにする
  const vaultWithProgress = MOCK_VAULT.updateArea("forest", (a) => ({
    ...a,
    progress: 100,
  }))
  const scene = toVillageScene(vaultWithProgress)
  const initialLogLength = scene.vault.log.length

  const result = service.checkAndUnlockWithLog(scene)

  // cave がアンロックされたらログが追加される
  const caveArea = result.vault.areas.find((a) => a.id === "cave")
  if (caveArea && caveArea.unlockCondition?.areaId === "forest") {
    expect(result.vault.log.length).toBeGreaterThan(initialLogLength)
    const lastLog = result.vault.log[result.vault.log.length - 1]
    expect(lastLog.key).toBe("AREA_UNLOCKED")
  }
})
