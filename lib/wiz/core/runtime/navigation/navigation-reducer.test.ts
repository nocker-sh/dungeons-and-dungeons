import { describe, expect, it } from "vite-plus/test"
import {
  MOCK_CONTENT,
  MOCK_SHOP_DIALOGUE_SERVICE,
  MOCK_VAULT,
} from "@/lib/wiz/core/mocks/mock-vault"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { MOCK_BATTLE_AUTHORITIES } from "@/lib/wiz/core/mocks/mock-battle-authorities"
import { toExplorationScene } from "@/lib/wiz/core/runtime/to-exploration-scene"
import { toInnScene } from "@/lib/wiz/core/runtime/to-inn-scene"
import { toVillageScene } from "@/lib/wiz/core/runtime/to-village-scene"
import { WizSceneNavigationReducer } from "@/lib/wiz/core/runtime/navigation/navigation-reducer"

const transitionService = new WizSceneTransitionService({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})
const applyResult = (result: ReturnType<WizSceneNavigationReducer["reduce"]>) =>
  transitionService.applyResult(result).state

describe("ENCOUNTER_MONSTER", () => {
  it("指定したモンスターと戦闘を開始する", () => {
    const reducer = new WizSceneNavigationReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest")
    const action = {
      type: "ENCOUNTER_MONSTER" as const,
      areaId: "forest",
      monsterId: "goblin",
    }

    const result = applyResult(reducer.reduce(state, action))

    expect(result.type).toBe("battle")
  })

  it("探索フェーズ以外からの遭遇をsemantic reason付きで拒否する", () => {
    const reducer = new WizSceneNavigationReducer()
    const villageState = toVillageScene(MOCK_VAULT)
    const action = {
      type: "ENCOUNTER_MONSTER" as const,
      areaId: "forest",
      monsterId: "goblin",
    }

    const sceneResult = reducer.reduce(villageState, action)
    const result = applyResult(sceneResult)

    expect(sceneResult).toMatchObject({
      accepted: false,
      reason: "ENCOUNTER_REQUIRES_EXPLORATION",
    })
    expect(result).toBe(villageState)
  })

  it("現在のareaに存在しないmonster IDからdefinitionを注入できない", () => {
    const reducer = new WizSceneNavigationReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest")

    const sceneResult = reducer.reduce(state, {
      type: "ENCOUNTER_MONSTER",
      areaId: "forest",
      monsterId: "missing",
    })
    const result = applyResult(sceneResult)

    expect(sceneResult).toMatchObject({
      accepted: false,
      reason: "ENCOUNTER_TARGET_NOT_IN_AREA",
    })
    expect(result).toBe(state)
  })

  it("別areaにのみ存在するmonsterをcanonical解決しない", () => {
    const reducer = new WizSceneNavigationReducer()
    const state = toExplorationScene(MOCK_VAULT, "cave")

    const sceneResult = reducer.reduce(state, {
      type: "ENCOUNTER_MONSTER",
      areaId: "cave",
      monsterId: "goblin",
    })

    expect(sceneResult).toMatchObject({
      accepted: false,
      reason: "ENCOUNTER_TARGET_NOT_IN_AREA",
    })
    expect(applyResult(sceneResult)).toBe(state)
  })

  it("存在しない現在areaからの遭遇を拒否する", () => {
    const reducer = new WizSceneNavigationReducer()
    const state = toExplorationScene(MOCK_VAULT, "missing-area")

    const sceneResult = reducer.reduce(state, {
      type: "ENCOUNTER_MONSTER",
      areaId: "missing-area",
      monsterId: "goblin",
    })

    expect(sceneResult).toMatchObject({
      accepted: false,
      reason: "ENCOUNTER_AREA_NOT_FOUND",
    })
    expect(applyResult(sceneResult)).toBe(state)
  })
})

describe("RETURN_TO_VILLAGE", () => {
  it("探索フェーズから村に戻る", () => {
    const reducer = new WizSceneNavigationReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest")
    const action = { type: "RETURN_TO_VILLAGE" as const }

    const result = applyResult(reducer.reduce(state, action))

    expect(result.type).toBe("village")
  })

  it("RETURNED_TO_VILLAGE ログが記録される", () => {
    const reducer = new WizSceneNavigationReducer()
    const state = toExplorationScene(MOCK_VAULT, "forest")
    const action = { type: "RETURN_TO_VILLAGE" as const }

    const result = applyResult(reducer.reduce(state, action))

    const hasLog = result.vault.log.some(
      (log) => log.key === "RETURNED_TO_VILLAGE"
    )
    expect(hasLog).toBe(true)
  })

  it("探索以外のフェーズからは原子的に拒否する", () => {
    const reducer = new WizSceneNavigationReducer()
    const innState = toInnScene(MOCK_VAULT)
    const action = { type: "RETURN_TO_VILLAGE" as const }

    const sceneResult = reducer.reduce(innState, action)
    const result = applyResult(sceneResult)

    expect(sceneResult).toMatchObject({
      accepted: false,
      reason: "ACTION_NOT_ALLOWED_IN_SCENE",
    })
    expect(result).toBe(innState)
  })
})
