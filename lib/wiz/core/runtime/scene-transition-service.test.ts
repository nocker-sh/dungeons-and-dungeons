import { describe, expect, it } from "vite-plus/test"
import { DEFAULT_LEVEL_UP_CONFIG } from "@/lib/wiz/core/config/level-up/wiz-level-up-config"
import { WizEngineLevelUp } from "@/lib/wiz/core/engine/level-up"
import {
  MOCK_CONTENT,
  MOCK_INITIAL_STATE,
  MOCK_SHOP_DIALOGUE_SERVICE,
} from "@/lib/wiz/core/mocks/mock-vault"
import { WizSceneResultFactory } from "@/lib/wiz/core/runtime/scene-result"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { MOCK_BATTLE_AUTHORITIES } from "@/lib/wiz/core/mocks/mock-battle-authorities"
import { toVillageScene } from "@/lib/wiz/core/runtime/to-village-scene"
import type {
  WizSceneTransition,
  WizSceneTransitionRejectionReason,
} from "@/lib/wiz/core/runtime/scene-transition"
import type { WizState } from "@/lib/wiz/core/runtime/state"

const service = new WizSceneTransitionService({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})

const apply = (
  transition: WizSceneTransition,
  state: WizState = MOCK_INITIAL_STATE
) => service.applyResult(WizSceneResultFactory.accept(state, transition))

describe("WizSceneTransitionService", () => {
  it("transitionがない結果と既存の拒否理由をそのまま保つ", () => {
    const accepted = WizSceneResultFactory.accept(MOCK_INITIAL_STATE)
    const rejected = WizSceneResultFactory.reject(
      MOCK_INITIAL_STATE,
      "TRANSITION_REJECTED"
    )

    expect(service.applyResult(accepted)).toBe(accepted)
    expect(service.applyResult(rejected)).toBe(rejected)
  })

  it("current contentからshopの価格設定を解決する", () => {
    const result = apply({ type: "GO_TO_SHOP", shopId: "item_shop" })

    expect(result.accepted).toBe(true)
    expect(result.state.type).toBe("shop")
    if (result.state.type === "shop") {
      expect(result.state.shopId).toBe("item_shop")
      expect(result.state.buyPriceModifier).toBe(1)
    }
  })

  it("transition適用後もaccepted resultのsemantic eventsを保持する", () => {
    const result = service.applyResult(
      WizSceneResultFactory.accept(
        MOCK_INITIAL_STATE,
        { type: "GO_TO_SHOP", shopId: "item_shop" },
        [{ type: "SCENE_CHANGED", source: "test" }]
      )
    )

    expect(result.accepted).toBe(true)
    if (result.accepted === false) {
      throw new TypeError("Expected accepted transition result")
    }
    expect(result.events).toEqual([{ type: "SCENE_CHANGED", source: "test" }])
    expect(Object.isFrozen(result.events)).toBe(true)
  })

  it("current contentのmonster IDからbattleを構築する", () => {
    const result = apply({
      type: "START_BATTLE",
      areaId: "forest",
      monsterIds: ["goblin"],
    })

    expect(result.accepted).toBe(true)
    expect(result.state.type).toBe("battle")
    if (result.state.type === "battle") {
      expect(
        result.state.phase.context.enemies
          .getAllMonsters()
          .map((monster) => monster.groupId)
      ).toEqual(["goblin"])
    }
  })

  it("pluginが偽造したポイントを無視してlive authorityからポイントとログを構築する", () => {
    const readyState = toVillageScene(
      MOCK_INITIAL_STATE.vault.updatePlayer((player) =>
        player.addExp(player.expToNextLevel)
      )
    )
    const forgedTransition = {
      type: "GO_TO_LEVEL_UP",
      returnAreaId: null,
      points: 999,
    } as const

    const result = apply(
      forgedTransition as unknown as WizSceneTransition,
      readyState
    )

    expect(result.accepted).toBe(true)
    expect(result.state.type).toBe("level_up")
    if (result.state.type === "level_up") {
      expect(result.state.availablePoints).toBe(3)
      expect(result.state.vault.log.at(-1)).toEqual({
        key: "LEVEL_UP_POINTS_GRANTED",
        points: 3,
      })
    }
  })

  it("注入したlevel-up authorityの設定を遷移先へ反映する", () => {
    const configuredService = new WizSceneTransitionService({
      ...MOCK_BATTLE_AUTHORITIES,
      content: MOCK_CONTENT,
      shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
      levelUpService: new WizEngineLevelUp({
        ...DEFAULT_LEVEL_UP_CONFIG,
        pointsPerLevelUp: 5,
      }),
    })
    const readyState = toVillageScene(
      MOCK_INITIAL_STATE.vault.updatePlayer((player) =>
        player.addExp(player.expToNextLevel)
      )
    )

    const result = configuredService.applyResult(
      WizSceneResultFactory.accept(readyState, {
        type: "GO_TO_LEVEL_UP",
        returnAreaId: null,
      })
    )

    expect(result.state.type).toBe("level_up")
    if (result.state.type === "level_up") {
      expect(result.state.availablePoints).toBe(5)
      expect(result.state.vault.log.at(-1)).toEqual({
        key: "LEVEL_UP_POINTS_GRANTED",
        points: 5,
      })
    }
  })

  it.each<{
    transition: WizSceneTransition
    reason: WizSceneTransitionRejectionReason
  }>([
    {
      transition: { type: "GO_TO_EXPLORATION", areaId: "missing" },
      reason: "TRANSITION_AREA_NOT_FOUND",
    },
    {
      transition: { type: "GO_TO_EXPLORATION", areaId: "cave" },
      reason: "TRANSITION_AREA_LOCKED",
    },
    {
      transition: { type: "GO_TO_CONVERSATION", npcId: "missing" },
      reason: "TRANSITION_NPC_NOT_FOUND",
    },
    {
      transition: { type: "GO_TO_SHOP", shopId: "missing" },
      reason: "TRANSITION_SHOP_NOT_FOUND",
    },
    {
      transition: {
        type: "GO_TO_LEVEL_UP",
        returnAreaId: null,
      },
      reason: "TRANSITION_LEVEL_UP_NOT_AVAILABLE",
    },
    {
      transition: {
        type: "START_BATTLE",
        areaId: "forest",
        monsterIds: [],
      },
      reason: "TRANSITION_MONSTERS_REQUIRED",
    },
    {
      transition: {
        type: "START_BATTLE",
        areaId: "forest",
        monsterIds: ["slime"],
      },
      reason: "TRANSITION_MONSTER_NOT_IN_AREA",
    },
  ])(
    "invalid transitionを$reasonで原子的に拒否する",
    ({ transition, reason }) => {
      const result = apply(transition)

      expect(result).toMatchObject({
        accepted: false,
        reason,
      })
      expect(result.state).toBe(MOCK_INITIAL_STATE)
    }
  )

  it("単独applyTransitionを公開しない", () => {
    expect("applyTransition" in service).toBe(false)
    const verifyPrivateTransitionApplication = () => {
      // @ts-expect-error transition適用はapplyResultだけを公開入口にする。
      service.applyTransition(MOCK_INITIAL_STATE, { type: "GO_TO_VILLAGE" })
    }
    expect(verifyPrivateTransitionApplication).toBeTypeOf("function")
  })

  it("level-up transitionへポイントを指定できない", () => {
    const verifyAuthorityBoundary = () => {
      const transition: WizSceneTransition = {
        type: "GO_TO_LEVEL_UP",
        returnAreaId: null,
        // @ts-expect-error ポイントはlive authorityだけが決定する。
        points: 999,
      }
      return transition
    }
    expect(verifyAuthorityBoundary).toBeTypeOf("function")
  })
})
